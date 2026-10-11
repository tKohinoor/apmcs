import { useState } from "react";
import { api } from "../services/api";

const fmt = (d) => new Date(d).toLocaleDateString();

export default function Sprints({ project, myRole, sprints, onChange }) {
  const isLead = ["product_owner", "scrum_master"].includes(myRole);
  const base = `/projects/${project._id}/sprints`;

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [moveTo, setMoveTo] = useState("backlog");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const planned = sprints.filter((s) => s.state === "planned");
  const active = sprints.filter((s) => s.state === "active");
  const closed = sprints.filter((s) => s.state === "closed");

  async function run(action) {
    setError("");
    try {
      await action();
      onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api(base, {
        method: "POST",
        body: { name, goal, startDate, endDate },
      });
      setName("");
      setGoal("");
      setStartDate("");
      setEndDate("");
      setShowForm(false);
      onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const start = (s) =>
    run(() => api(`${base}/${s._id}/start`, { method: "POST" }));

  const complete = (s) => {
    if (!window.confirm(`Complete "${s.name}"? Unfinished items will be moved.`)) return;
    run(async () => {
      await api(`${base}/${s._id}/complete`, {
        method: "POST",
        body: { moveTo },
      });
      setMoveTo("backlog");
    });
  };

  const remove = (s) => {
    if (!window.confirm(`Delete "${s.name}"? Its items return to the backlog.`)) return;
    run(() => api(`${base}/${s._id}`, { method: "DELETE" }));
  };

  function renderSprint(s) {
    const { count, points, donePoints } = s.stats;
    return (
      <div key={s._id} className={`sprint-card sprint-${s.state}`}>
        <div className="sprint-head">
          <strong>{s.name}</strong>
          <span className={`badge state-${s.state}`}>{s.state}</span>
          <span className="sprint-dates">
            {fmt(s.startDate)} - {fmt(s.endDate)}
          </span>
        </div>
        {s.goal && <p className="sprint-goal">Goal: {s.goal}</p>}
        <p className="sprint-stats">
          {count} item(s) - {points} pts
          {s.state === "active" && ` - ${donePoints} pts done`}
          {s.state === "closed" &&
            ` - committed ${s.committedPoints}, completed ${s.completedPoints}`}
        </p>

        {isLead && s.state === "planned" && (
          <div className="sprint-actions">
            <button onClick={() => start(s)}>Start sprint</button>
            <button className="danger" onClick={() => remove(s)}>Delete</button>
          </div>
        )}

        {isLead && s.state === "active" && (
          <div className="sprint-actions">
            <label>
              Move unfinished items to{" "}
              <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                <option value="backlog">Backlog</option>
                {planned.map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </label>
            <button onClick={() => complete(s)}>Complete sprint</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="sprints">
      <div className="page-title">
        <h2>Sprints</h2>
        {isLead && (
          <button onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ Create sprint"}
          </button>
        )}
      </div>

      {showForm && (
        <form className="item-form" onSubmit={handleCreate}>
          <input
            placeholder="Sprint name (e.g. Sprint 1)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            required
          />
          <input
            placeholder="Sprint goal (optional)"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            maxLength={300}
          />
          <label>
            Start{" "}
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </label>
          <label>
            End{" "}
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </label>
          <button type="submit" disabled={saving}>
            {saving ? "Creating..." : "Create"}
          </button>
        </form>
      )}

      {error && <p className="error">{error}</p>}

      {sprints.length === 0 && (
        <p>No sprints yet.{isLead ? " Create your first one above." : ""}</p>
      )}

      {active.map(renderSprint)}
      {planned.map(renderSprint)}

      {closed.length > 0 && (
        <details>
          <summary>Completed sprints ({closed.length})</summary>
          {closed.map(renderSprint)}
        </details>
      )}
    </section>
  );
}