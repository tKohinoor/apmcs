import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";

const ROLES = ["product_owner", "scrum_master", "member", "viewer"];
const ADD_ROLES = ["scrum_master", "member", "viewer"];
const label = (s) => s.replace("_", " ");

export default function Team({ project, myRole, onChange }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const base = `/projects/${project._id}/members`;

  const isLead = ["product_owner", "scrum_master"].includes(myRole);
  const isPO = myRole === "product_owner";

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const isOwner = (m) => String(project.owner) === m.user._id;
  const isSelf = (m) => user.id === m.user._id;

  // Same rule as the server: it decides again anyway, this only hides buttons
  const canRemove = (m) =>
    !isOwner(m) &&
    (isSelf(m) || isPO || (myRole === "scrum_master" && ["member", "viewer"].includes(m.role)));

  async function handleAdd(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const data = await api(base, { method: "POST", body: { email, role } });
      setNotice(data.message);
      setEmail("");
      onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function changeRole(m, newRole) {
    setError("");
    setNotice("");
    try {
      await api(`${base}/${m.user._id}`, { method: "PATCH", body: { role: newRole } });
      onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(m) {
    const self = isSelf(m);
    const question = self
      ? `Leave "${project.name}"? You will lose access.`
      : `Remove ${m.user.name} from this project?`;
    if (!window.confirm(question)) return;

    setError("");
    setNotice("");
    try {
      await api(`${base}/${m.user._id}`, { method: "DELETE" });
      if (self) {
        navigate("/dashboard");
      } else {
        onChange();
      }
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="team">
      <h2>Team ({project.members.length})</h2>

      {isLead && (
        <form className="item-form" onSubmit={handleAdd}>
          <input
            type="email"
            placeholder="Teammate's registered email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {ADD_ROLES.map((r) => (
              <option key={r} value={r}>{label(r)}</option>
            ))}
          </select>
          <button type="submit" disabled={saving}>
            {saving ? "Adding..." : "Add member"}
          </button>
        </form>
      )}

      {error && <p className="error">{error}</p>}
      {notice && <p className="notice">{notice}</p>}

      <div className="item-list">
        {project.members.map((m) => (
          <div className="item-row" key={m.user._id}>
            <span className="avatar">{m.user.name.charAt(0).toUpperCase()}</span>
            <span className="item-title">
              {m.user.name}
              {isSelf(m) && <small> (you)</small>}
              {isOwner(m) && <small className="epic-tag"> owner</small>}
              <small className="member-email"> {m.user.email}</small>
            </span>
            <select
              value={m.role}
              disabled={!isPO || isOwner(m)}
              onChange={(e) => changeRole(m, e.target.value)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{label(r)}</option>
              ))}
            </select>
            {canRemove(m) && (
              <button className="danger" onClick={() => remove(m)}>
                {isSelf(m) ? "Leave" : "Remove"}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}