import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../services/api";
import { socket } from "../services/socket";
import Team from "../components/Team";
import Board from "../components/Board";
import Sprints from "../components/Sprints";
import Backlog from "../components/Backlog";
import ItemModal from "../components/ItemModal";
import Reports from "../components/Reports";
import NotificationBell from "../components/NotificationBell";
import Activity from "../components/Activity";

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [sprints, setSprints] = useState([]);
  const [version, setVersion] = useState(0);
  const [openItemId, setOpenItemId] = useState(null);
  const [online, setOnline] = useState([]);
  const [live, setLive] = useState(socket.connected);
  const [searchParams, setSearchParams] = useSearchParams();

  // A notification link looks like /projects/ID?item=ITEM_ID: open that item
  useEffect(() => {
    const itemParam = searchParams.get("item");
    if (itemParam) {
      setOpenItemId(itemParam);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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

  // Several notices can arrive together, so wait a moment and reload once
  const refreshTimer = useRef(null);
  const scheduleRefresh = useCallback(() => {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => setVersion((v) => v + 1), 150);
  }, []);
  useEffect(() => () => clearTimeout(refreshTimer.current), []);

  const closeModal = useCallback(() => setOpenItemId(null), []);

  // Live connection for this project
  useEffect(() => {
    let needsResync = false;

    function join() {
      socket.emit("project:join", id, (res) => {
        if (!res?.ok) console.warn("Live updates unavailable:", res?.message);
      });
    }
    function onConnect() {
      setLive(true);
      join();
      // After a dropped connection we may have missed changes
      if (needsResync) {
        needsResync = false;
        scheduleRefresh();
      }
    }
    function onDisconnect() {
      setLive(false);
      needsResync = true;
    }
    function onEvent(evt) {
      // Comment notices are handled by the open item panel
      if (evt.type !== "comments") scheduleRefresh();
    }
    function onPresence(p) {
      if (p.projectId === id) setOnline(p.users);
    }
    function onRevoked(p) {
      if (p.projectId === id) {
        window.alert("You no longer have access to this project.");
        navigate("/dashboard");
      }
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onDisconnect);
    socket.on("project:event", onEvent);
    socket.on("project:presence", onPresence);
    socket.on("project:revoked", onRevoked);

    if (!socket.connected) socket.connect();
    else join();
    setLive(socket.connected);

    return () => {
      socket.emit("project:leave", id);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onDisconnect);
      socket.off("project:event", onEvent);
      socket.off("project:presence", onPresence);
      socket.off("project:revoked", onRevoked);
      setOnline([]);
    };
  }, [id, navigate, scheduleRefresh]);

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
        <div>
          <NotificationBell />
          <div className="presence">
            <span
              className={`live-dot ${live ? "on" : ""}`}
              title={live ? "Live updates on" : "Offline: reconnecting..."}
            />
            <small>{live ? "Live" : "Offline"}</small>
            {online.map((u) => (
              <span key={u.id} className="avatar small" title={`${u.name} is online`}>
                {u.name.charAt(0).toUpperCase()}
              </span>
            ))}
          </div>
          <span>Your role: {myRole.replace("_", " ")}</span>
        </div>
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
          onOpen={setOpenItemId}
        />
        <Sprints
          project={project}
          myRole={myRole}
          sprints={sprints}
          onChange={refresh}
        />
        <Reports 
          project={project} 
          sprints={sprints} 
          version={version} 
        />
        <Backlog
          project={project}
          myRole={myRole}
          sprints={sprints}
          version={version}
          onChange={refresh}
          onOpen={setOpenItemId}
        />
        <Activity 
          project={project}
          onOpen={setOpenItemId}
        />
      </main>

      {openItemId && (
        <ItemModal
          key={openItemId}
          project={project}
          myRole={myRole}
          itemId={openItemId}
          onClose={closeModal}
          onChange={refresh}
        />
      )}
    </div>
  );
}