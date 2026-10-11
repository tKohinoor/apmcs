import { useEffect, useState } from "react";
import { api } from "../services/api";

const TYPES = ["epic", "story", "task", "bug"];
const PRIORITIES = ["low", "medium", "high", "critical"];
const STATUSES = ["todo", "in_progress", "in_review", "done"];
const label = (s) => s.replace("_", " ");

export default function Backlog({ project, myRole }) {
  const canEdit = myRole !== "viewer";
  const base = `/projects/${project._id}/items`;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [title, setTitle] = useState("");
  const [type, setType] = useState("task");
  const [priority, setPriority] = useState("medium");
  const [points, setPoints] = useState("");
  const [assignee, setAssignee] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    const query = typeFilter ? `?type=${typeFilter}` : "";
    api(`${base}${query}`)
      .then((data) => setItems(data.items))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [base, typeFilter]);

  async function handleCreate(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const data = await api(base, {
        method: "POST",
        body: {
          title,
          type,
          priority,
          storyPoints: points === "" ? null : Number(points),
          assignee: assignee || null,
        },
      });
      if (!typeFilter || typeFilter === data.item.type) {
        setItems([...items, data.item]);
      }
      setTitle("");
      setPoints("");
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(item, status) {
    try {
      const data = await api(`${base}/${item._id}`, {
        method: "PATCH",
        body: { status },
      });
      setItems(items.map((i) => (i._id === item._id ? data.item : i)));
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(item) {
    if (!window.confirm(`Delete ${project.key}-${item.number}?`)) return;
    try {
      await api(`${base}/${item._id}`, { method: "DELETE" });
      setItems(items.filter((i) => i._id !== item._id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="backlog">
      <div className="page-title">
        <h2>Backlog</h2>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
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
          <button type="submit" disabled={saving}>
            {saving ? "Adding..." : "Add"}
          </button>
        </form>
      )}
      {formError && <p className="error">{formError}</p>}
      {error && <p className="error">{error}</p>}

      {loading && <p>Loading backlog...</p>}
      {!loading && items.length === 0 && <p>No items yet. Add your first one above.</p>}

      <div className="item-list">
        {items.map((item) => (
          <div className="item-row" key={item._id}>
            <span className={`badge type-${item.type}`}>{item.type}</span>
            <span className="item-key">{project.key}-{item.number}</span>
            <span className="item-title">
              {item.title}
              {item.epic && <small className="epic-tag"> in {item.epic.title}</small>}
            </span>
            <span className={`badge prio-${item.priority}`}>{item.priority}</span>
            <span className="points">{item.storyPoints ?? "-"}</span>
            <span className="assignee">{item.assignee ? item.assignee.name : "Unassigned"}</span>
            <select
              value={item.status}
              disabled={!canEdit}
              onChange={(e) => changeStatus(item, e.target.value)}
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