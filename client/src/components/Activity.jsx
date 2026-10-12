import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import { socket } from "../services/socket";
import { timeAgo } from "../services/timeAgo";

export default function Activity({ project, onOpen }) {
  const [rows, setRows] = useState([]);
  const [limit, setLimit] = useState(20);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const timer = useRef(null);

  const load = useCallback(() => {
    api(`/projects/${project._id}/activity?limit=${limit}`)
      .then((d) => {
        setRows(d.activity);
        setHasMore(d.hasMore);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [project._id, limit]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh when anything happens in the project (wait a moment, load once)
  useEffect(() => {
    function onEvent() {
      clearTimeout(timer.current);
      timer.current = setTimeout(load, 300);
    }
    socket.on("project:event", onEvent);
    return () => {
      socket.off("project:event", onEvent);
      clearTimeout(timer.current);
    };
  }, [load]);

  return (
    <section className="activity">
      <h2>Activity</h2>
      {error && <p className="error">{error}</p>}
      {loading && <p className="board-hint">Loading...</p>}
      {!loading && rows.length === 0 && (
        <p className="board-hint">No activity yet.</p>
      )}

      <div className="item-list">
        {rows.map((a) => (
          <div className="item-row" key={a._id}>
            <span className="avatar small">
              {(a.actor?.name || "?").charAt(0).toUpperCase()}
            </span>
            <span className="item-title">
              <strong>{a.actor?.name || "Someone"}</strong>{" "}
              {a.item ? (
                <button className="link-button" onClick={() => onOpen(a.item)}>
                  {a.text}
                </button>
              ) : (
                a.text
              )}
            </span>
            <small className="activity-time">{timeAgo(a.createdAt)}</small>
          </div>
        ))}
      </div>

      {hasMore && limit < 100 && (
        <button className="show-more" onClick={() => setLimit(limit + 20)}>
          Show more
        </button>
      )}
    </section>
  );
}