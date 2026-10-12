import { useEffect, useState } from "react";
import { api } from "../services/api";

const TYPES = ["epic", "story", "task", "bug"];
const PRIORITIES = ["low", "medium", "high", "critical"];
const STATUSES = ["todo", "in_progress", "in_review", "done"];
const label = (s) => s.replace("_", " ");

export default function Backlog({ project, myRole, sprints, version, onChange, onOpen }) {
  const canEdit = myRole !== "viewer";
  const base = `/projects/${project._id}/items`;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sprintFilter, setSprintFilter] = useState("");

  const [title, setTitle] = useState("");
  const [type, setType] = useState("task");
  const [priority, setPriority] = useState("medium");
  const [points, setPoints] = useState("");
  const [assignee, setAssignee] = useState("");
  const [sprint, setSprint] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const openSprints = sprints.filter((s) => s.state !== "closed");
  const findSprint = (id) => sprints.find((s) => s._id === id);

  useEffect(() => {
    const params = new URLSearchParams();
    if (typeFilter) params.set("type", typeFilter);
    if (sprintFilter) params.set("sprint", sprintFilter);
    const query = params.toString() ? `?${params}` : "";

    api(`${base}${query}`)
      .then((data) => setItems(data.items))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [base, typeFilter, sprintFilter, version]);

  async function handleCreate(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      await api(base, {
        method: "POST",
        body: {
          title,
          type,
          priority,
          storyPoints: points === "" ? null : Number(points),
          assignee: assignee || null,
          sprint: type === "epic" ? null : sprint || null,
        },
      });
      setTitle("");
      setPoints("");
      onChange(); // reloads items and sprint totals
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function update(item, changes) {
    setError("");
    try {
      await api(`${base}/${item._id}`, { method: "PATCH", body: changes });
      onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(item) {
    if (!window.confirm(`Delete ${project.key}-${item.number}?`)) return;
    try {
      await api(`${base}/${item._id}`, { method: "DELETE" });
      onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  function sprintCell(item) {
    if (item.type === "epic") return <span className="sprint-cell">-</span>;

    const current = item.sprint ? findSprint(item.sprint) : null;
    if (current?.state === "closed") {
      return <span className="sprint-cell">{current.name}</span>;
    }

    return (
      <select
        className="sprint-cell"
        value={item.sprint || ""}
        disabled={!canEdit}
        onChange={(e) => update(item, { sprint: e.target.value || null })}
      >
        <option value="">Backlog</option>
        {openSprints.map((s) => (
          <option key={s._id} value={s._id}>{s.name}</option>
        ))}
      </select>
    );
  }

  return (
    <section className="backlog">
      <div className="page-title">
        <h2>Backlog</h2>
        <div className="filters">
          <select value={sprintFilter} onChange={(e) => setSprintFilter(e.target.value)}>
            <option value="">All sprints</option>
            <option value="backlog">Backlog only</option>
            {sprints.map((s) => (
              <option key={s._id} value={s._id}>{s.name}</option>
            ))}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {canEdit && (
        <form className="item-form" onSubmit={handleCreate}>
          <input
            placeholder="What needs to be done?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={140}
            required
          />
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <input
            type="number"
            min="0"
            max="100"
            placeholder="Points"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            style={{ width: 80 }}
          />
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Unassigned</option>
            {project.members.map((m) => (
              <option key={m.user._id} value={m.user._id}>{m.user.name}</option>
            ))}
          </select>
          <select
            value={sprint}
            onChange={(e) => setSprint(e.target.value)}
            disabled={type === "epic"}
          >
            <option value="">Backlog</option>
            {openSprints.map((s) => (
              <option key={s._id} value={s._id}>{s.name}</option>
            ))}
          </select>
          <button type="submit" disabled={saving}>
            {saving ? "Adding..." : "Add"}
          </button>
        </form>
      )}
      {formError && <p className="error">{formError}</p>}
      {error && <p className="error">{error}</p>}

      {loading && <p>Loading backlog...</p>}
      {!loading && items.length === 0 && <p>No items match. Add one above.</p>}

      <div className="item-list">
        {items.map((item) => (
          <div className="item-row" key={item._id}>
            <span className={`badge type-${item.type}`}>{item.type}</span>
            <span className="item-key">{project.key}-{item.number}</span>
            <span className="item-title">
              <button className="link-button" onClick={() => onOpen(item._id)}>
                {item.title}
              </button>
              {item.epic && <small className="epic-tag"> in {item.epic.title}</small>}
            </span>
            <span className={`badge prio-${item.priority}`}>{item.priority}</span>
            <span className="points">{item.storyPoints ?? "-"}</span>
            <span className="assignee">{item.assignee ? item.assignee.name : "Unassigned"}</span>
            {sprintCell(item)}
            <select
              value={item.status}
              disabled={!canEdit}
              onChange={(e) => update(item, { status: e.target.value })}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{label(s)}</option>
              ))}
            </select>
            {canEdit && (
              <button className="danger" onClick={() => remove(item)}>Delete</button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}