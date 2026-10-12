import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { socket } from "../services/socket";
import { timeAgo } from "../services/timeAgo";

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState("");
  const boxRef = useRef(null);

  const load = useCallback(() => {
    api("/notifications")
      .then((d) => {
        setItems(d.notifications);
        setUnread(d.unreadCount);
        setError("");
      })
      .catch((err) => setError(err.message));
  }, []);

  // Load now, and again whenever the server says something new arrived
  useEffect(() => {
    load();
    socket.on("notification:new", load);
    socket.on("connect", load); // catch up after a dropped connection
    if (!socket.connected) socket.connect();
    return () => {
      socket.off("notification:new", load);
      socket.off("connect", load);
    };
  }, [load]);

  // Click outside the panel to close it
  useEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function openNotification(n) {
    setOpen(false);
    if (!n.read) {
      setItems((list) => list.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      api(`/notifications/${n._id}/read`, { method: "PATCH" }).catch(load);
    }
    if (n.project) {
      navigate(`/projects/${n.project._id}${n.item ? `?item=${n.item}` : ""}`);
    }
  }

  function markAll() {
    api("/notifications/read-all", { method: "POST" }).then(load).catch(load);
  }

  return (
    <div className="bell-wrap" ref={boxRef}>
      <button
        className="bell-btn"
        onClick={() => setOpen(!open)}
        aria-label={`Notifications, ${unread} unread`}
      >
        🔔
        {unread > 0 && <span className="bell-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="bell-panel">
          <div className="bell-panel-head">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button className="link-button" onClick={markAll}>
                Mark all read
              </button>
            )}
          </div>
          {error && <p className="error">{error}</p>}
          {items.length === 0 && !error && (
            <p className="board-hint bell-empty">You're all caught up.</p>
          )}
          {items.map((n) => (
            <button
              key={n._id}
              className={`notif ${n.read ? "" : "unread"}`}
              onClick={() => openNotification(n)}
            >
              {n.message}
              <small>
                {n.project ? `${n.project.key} - ` : ""}
                {timeAgo(n.createdAt)}
              </small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}