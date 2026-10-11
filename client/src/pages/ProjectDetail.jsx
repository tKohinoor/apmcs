import Backlog from "../components/Backlog";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../services/api";

export default function ProjectDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/projects/${id}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [id]);

  if (error) {
    return (
      <div className="dashboard">
        <main>
          <p className="error">{error}</p>
          <Link to="/dashboard">Back to projects</Link>
        </main>
      </div>
    );
  }

  if (!data) return <p style={{ padding: 24 }}>Loading...</p>;

  const { project, myRole } = data;

  return (
    <div className="dashboard">
      <header>
        <h2>
          <Link to="/dashboard" className="plain-link">APMCS</Link> / {project.key}
        </h2>
        <span>Your role: {myRole.replace("_", " ")}</span>
      </header>
      <main>
        <h1>{project.name}</h1>
        <p>{project.description || "No description"}</p>

        <h3>Team members</h3>
        <ul>
          {project.members.map((m) => (
            <li key={m.user._id}>
              {m.user.name} ({m.user.email}) - {m.role.replace("_", " ")}
            </li>
          ))}
        </ul>

        <Backlog project={project} myRole={myRole} />
      </main>
    </div>
  );
}