import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { api } from "../services/api";

const shortDate = (d) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

// Loads one report, and reloads it whenever `version` changes (live updates)
function useReport(url, version) {
  const [state, setState] = useState({ data: null, error: "", loading: true });

  useEffect(() => {
    let cancelled = false;
    api(url)
      .then((data) => {
        if (!cancelled) setState({ data, error: "", loading: false });
      })
      .catch((err) => {
        if (!cancelled) setState({ data: null, error: err.message, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [url, version]);

  return state;
}

function BurndownCard({ project, sprints, version }) {
  const [selected, setSelected] = useState("");
  const query = selected ? `?sprint=${selected}` : "";
  const { data, error, loading } = useReport(
    `/projects/${project._id}/reports/burndown${query}`,
    version
  );

  const options = sprints.filter((s) => s.state !== "planned");

  let status = null;
  if (data?.sprint?.state === "active") {
    const row = data.rows.find((r) => r.date === data.today);
    if (row && row.remaining !== null) {
      const diff = Math.round((row.remaining - row.ideal) * 10) / 10;
      status =
        diff <= 0
          ? { ok: true, text: `On track: ${row.remaining} pts left, ideal is ${row.ideal}` }
          : { ok: false, text: `Behind by ${diff} pts: ${row.remaining} left, ideal is ${row.ideal}` };
    }
  }

  const todayVisible = data?.rows?.some((r) => r.date === data.today);

  return (
    <div className="report-card wide">
      <div className="report-head">
        <h3>Burndown{data?.sprint ? `: ${data.sprint.name}` : ""}</h3>
        {options.length > 0 && (
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Current sprint</option>
            {options.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} ({s.state})
              </option>
            ))}
          </select>
        )}
      </div>

      {error && <p className="error">{error}</p>}
      {loading && !data && <p className="board-hint">Loading...</p>}

      {data && !data.sprint && (
        <p className="board-hint">Start a sprint to see its burndown chart.</p>
      )}

      {data?.sprint && (
        <>
          {status && (
            <p className={status.ok ? "status-ok" : "status-warn"}>{status.text}</p>
          )}
          <p className="board-hint">
            Committed {data.sprint.committedPoints} pts
            {data.sprint.state === "closed" &&
              `, completed ${data.sprint.completedPoints} pts`}
            . The blue line should stay at or below the dashed line.
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.rows} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={shortDate} />
              <YAxis allowDecimals={false} domain={[0, "auto"]} />
              <Tooltip labelFormatter={shortDate} />
              <Legend />
              <Line
                type="linear"
                dataKey="ideal"
                name="Ideal"
                stroke="#8993a4"
                strokeDasharray="6 4"
                dot={false}
              />
              <Line
                type="stepAfter"
                dataKey="scope"
                name="Total scope"
                stroke="#c1c7d0"
                dot={false}
              />
              <Line
                type="linear"
                dataKey="remaining"
                name="Remaining"
                stroke="#0052cc"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              {todayVisible && (
                <ReferenceLine
                  x={data.today}
                  stroke="#de350b"
                  strokeDasharray="3 3"
                  label="Today"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}

function VelocityCard({ project, version }) {
  const { data, error, loading } = useReport(
    `/projects/${project._id}/reports/velocity`,
    version
  );

  return (
    <div className="report-card">
      <h3>Velocity</h3>
      {error && <p className="error">{error}</p>}
      {loading && !data && <p className="board-hint">Loading...</p>}

      {data && data.rows.length === 0 && (
        <p className="board-hint">Complete a sprint to see velocity.</p>
      )}

      {data && data.rows.length > 0 && (
        <>
          <p className="board-hint">
            Average completed per sprint: <strong>{data.average} pts</strong>
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="committed" name="Committed" fill="#c1c7d0" />
              <Bar dataKey="completed" name="Completed" fill="#36b37e" />
              <ReferenceLine
                y={data.average}
                stroke="#6554c0"
                strokeDasharray="4 4"
                label="Avg"
              />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}

function WorkloadCard({ project, version }) {
  const { data, error, loading } = useReport(
    `/projects/${project._id}/reports/workload`,
    version
  );

  return (
    <div className="report-card">
      <h3>Workload{data?.sprint ? `: ${data.sprint.name}` : ""}</h3>
      {error && <p className="error">{error}</p>}
      {loading && !data && <p className="board-hint">Loading...</p>}

      {data && !data.sprint && (
        <p className="board-hint">Workload appears while a sprint is active.</p>
      )}

      {data?.sprint && data.rows.length > 0 && (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="donePoints" name="Done pts" stackId="pts" fill="#36b37e" />
              <Bar dataKey="openPoints" name="Open pts" stackId="pts" fill="#0052cc" />
            </BarChart>
          </ResponsiveContainer>
          <ul className="workload-list">
            {data.rows.map((r) => (
              <li key={r.userId || "none"}>
                <strong>{r.name}</strong>: {r.openItems} open item(s), {r.openPoints} open pts
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default function Reports({ project, sprints, version }) {
  return (
    <section className="reports">
      <h2>Reports</h2>
      <div className="report-grid">
        <BurndownCard project={project} sprints={sprints} version={version} />
        <VelocityCard project={project} version={version} />
        <WorkloadCard project={project} version={version} />
      </div>
    </section>
  );
}