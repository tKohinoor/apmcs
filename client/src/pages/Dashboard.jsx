import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import NotificationBell from "../components/NotificationBell";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api("/projects")
      .then((data) => setProjects(data.projects))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const data = await api("/projects", {
        method: "POST",
        body: { name, key, description },
      });
      setProjects([data.project, ...projects]);
      setName("");
      setKey("");
      setDescription("");
      setShowForm(false);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dashboard">
      <header>
        <h2>APMCS</h2>
        <div>
          <NotificationBell />
          <span>Hello, {user.name}</span>
          <button onClick={logout}>Log out</button>
        </div>
      </header>

      <main>
        <div className="page-title">
          <h1>Your projects</h1>
          <button onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ Create project"}
          </button>
        </div>

        {showForm && (
          <form className="project-form" onSubmit={handleCreate}>
            {formError && <p className="error">{formError}</p>}
            <input
              placeholder="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              placeholder="Key (2-5 letters, e.g. LIB)"
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase())}
              maxLength={5}
              required
            />
            <input
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <button type="submit" disabled={saving}>
              {saving ? "Creating..." : "Create"}
            </button>
          </form>
        )}

        {loading && <p>Loading projects...</p>}
        {error && <p className="error">{error}</p>}
        {!loading && !error && projects.length === 0 && (
          <p>No projects yet. Create your first one.</p>
        )}

        <div className="project-grid">
          {projects.map((p) => (
            <Link key={p._id} to={`/projects/${p._id}`} className="project-card">
              <span className="project-key">{p.key}</span>
              <h3>{p.name}</h3>
              <p>{p.description || "No description"}</p>
              <small>{p.members.length} member(s)</small>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}