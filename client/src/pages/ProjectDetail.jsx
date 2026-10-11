import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../services/api";
import Team from "../components/Team";
import Sprints from "../components/Sprints";
import Backlog from "../components/Backlog";
import Board from "../components/Board";

export default function ProjectDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [sprints, setSprints] = useState([]);
  const [version, setVersion] = useState(0);

  // Reload the project and its sprints whenever something changes
  useEffect(() => {
    api(`/projects/${id}`)
      .then(setData)
      .catch((err) => setError(err.message));
    api(`/projects/${id}/sprints`)
      .then((d) => setSprints(d.sprints))
      .catch(() => {});
  }, [id, version]);

  const refresh = () => setVersion((v) => v + 1);

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

        <Team project={project} myRole={myRole} onChange={refresh} />
        <Board
          project={project}
          myRole={myRole}
          sprints={sprints}
          version={version}
          onChange={refresh}
        />
        <Sprints
          project={project}
          myRole={myRole}
          sprints={sprints}
          onChange={refresh}
        />
        <Backlog
          project={project}
          myRole={myRole}
          sprints={sprints}
          version={version}
          onChange={refresh}
        />
      </main>
    </div>
  );
}