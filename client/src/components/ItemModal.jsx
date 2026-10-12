import { useEffect, useState } from "react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { socket } from "../services/socket";

const PRIORITIES = ["low", "medium", "high", "critical"];
const STATUSES = ["todo", "in_progress", "in_review", "done"];
const label = (s) => s.replace("_", " ");
const when = (d) => new Date(d).toLocaleString();

// The editable form values, built from the item
function toDraft(item) {
  return {
    title: item.title,
    description: item.description || "",
    priority: item.priority,
    status: item.status,
    storyPoints: item.storyPoints ?? "",
    assignee: item.assignee?._id || "",
    epic: item.epic?._id || "",
  };
}

export default function ItemModal({ project, myRole, itemId, onClose, onChange }) {
  const { user } = useAuth();
  const canEdit = myRole !== "viewer";
  const isLead = ["product_owner", "scrum_master"].includes(myRole);
  const base = `/projects/${project._id}/items/${itemId}`;

  const [item, setItem] = useState(null);
  const [draft, setDraft] = useState(null);
  const [epics, setEpics] = useState([]);
  const [comments, setComments] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [remoteItem, setRemoteItem] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api(base),
      api(`${base}/comments`),
      api(`/projects/${project._id}/items?type=epic`),
    ])
      .then(([i, c, e]) => {
        if (cancelled) return;
        setItem(i.item);
        setDraft(toDraft(i.item));
        setComments(c.comments);
        setEpics(e.items);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [base, project._id]);

  const dirty =
    item && draft && JSON.stringify(draft) !== JSON.stringify(toDraft(item));
      // Live updates for this item from other people
  useEffect(() => {
    function onEvent(evt) {
      if (evt.itemId !== itemId) return;

      if (evt.type === "comments") {
        api(`${base}/comments`)
          .then((c) => setComments(c.comments))
          .catch(() => {});
      }

      // Ignore our own changes: our screen is already up to date
      if (evt.type === "items" && evt.actorId !== user.id) {
        api(base)
          .then((i) => setRemoteItem(i.item))
          .catch(() => {
            window.alert("This item was deleted by someone else.");
            onClose();
          });
      }
    }

    socket.on("project:event", onEvent);
    return () => socket.off("project:event", onEvent);
  }, [base, itemId, user.id, onClose]);

  // If we have no unsaved edits, show the other person's version straight away
  useEffect(() => {
    if (remoteItem && !dirty) {
      setItem(remoteItem);
      setDraft(toDraft(remoteItem));
      setRemoteItem(null);
    }
  }, [remoteItem, dirty]);

  function requestClose() {
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    onClose();
  }

  // Escape closes the panel
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const set = (field) => (e) => {
    setSaved(false);
    setDraft({ ...draft, [field]: e.target.value });
  };

  async function handleSave(e) {
    e.preventDefault();
    if (!draft.title.trim()) {
      setError("Title cannot be empty");
      return;
    }
    setError("");
    setSaving(true);
    setSaved(false);
    try {
      const data = await api(base, {
        method: "PATCH",
        body: {
          title: draft.title,
          description: draft.description,
          priority: draft.priority,
          status: draft.status,
          storyPoints: draft.storyPoints === "" ? null : Number(draft.storyPoints),
          assignee: draft.assignee || null,
          epic: draft.epic || null,
        },
      });
      // The update response does not include reporter or sprint names, keep ours
      const updated = { ...data.item, reporter: item.reporter, sprint: item.sprint };
      setItem(updated);
      setDraft(toDraft(updated));
      setSaved(true);
      setRemoteItem(null);
      onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function postComment(e) {
    e.preventDefault();
    const body = newComment.trim();
    if (!body) return;
    setError("");
    setPosting(true);
    try {
      const data = await api(`${base}/comments`, { method: "POST", body: { body } });
      setComments([...comments, data.comment]);
      setNewComment("");
    } catch (err) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  }

  async function removeComment(c) {
    if (!window.confirm("Delete this comment?")) return;
    setError("");
    try {
      await api(`${base}/comments/${c._id}`, { method: "DELETE" });
      setComments(comments.filter((x) => x._id !== c._id));
    } catch (err) {
      setError(err.message);
    }
  }

  const canDeleteComment = (c) =>
    canEdit && (isLead || c.author?._id === user.id);

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true">
        {loadError && (
          <>
            <p className="error">{loadError}</p>
            <button onClick={onClose}>Close</button>
          </>
        )}

        {!loadError && !item && <p>Loading...</p>}

        {item && draft && (
          <>
            <div className="modal-head">
              <span className={`badge type-${item.type}`}>{item.type}</span>
              <span className="item-key">
                {project.key}-{item.number}
              </span>
              <button className="modal-close" onClick={requestClose} aria-label="Close">
                &times;
              </button>
            </div>

            {error && <p className="error">{error}</p>}
            {remoteItem && dirty && (
              <div className="banner">
                Someone else changed this item while you were editing. Saving
                now will overwrite their changes.
                <button
                  onClick={() => {
                    setItem(remoteItem);
                    setDraft(toDraft(remoteItem));
                    setRemoteItem(null);
                  }}
                >
                  Load their version
                </button>
              </div>
            )}            

            <div className="modal-grid">
              <div className="modal-main">
                <form onSubmit={handleSave}>
                  <input
                    className="title-input"
                    value={draft.title}
                    onChange={set("title")}
                    maxLength={140}
                    disabled={!canEdit}
                    required
                  />

                  <label className="field">
                    Description
                    <textarea
                      rows={6}
                      value={draft.description}
                      onChange={set("description")}
                      maxLength={5000}
                      placeholder={canEdit ? "Add a description..." : "No description"}
                      disabled={!canEdit}
                    />
                  </label>

                  {canEdit && (
                    <div className="modal-actions">
                      <button type="submit" disabled={saving || !dirty}>
                        {saving ? "Saving..." : "Save changes"}
                      </button>
                      {saved && !dirty && <span className="saved-note">Saved</span>}
                      {dirty && <span className="unsaved-note">Unsaved changes</span>}
                    </div>
                  )}
                </form>

                <h3>Comments ({comments.length})</h3>

                <div className="comment-list">
                  {comments.length === 0 && (
                    <p className="board-hint">No comments yet.</p>
                  )}
                  {comments.map((c) => (
                    <div className="comment" key={c._id}>
                      <span className="avatar small">
                        {(c.author?.name || "?").charAt(0).toUpperCase()}
                      </span>
                      <div className="comment-body">
                        <div className="comment-meta">
                          <strong>{c.author?.name || "Unknown"}</strong>
                          <small>{when(c.createdAt)}</small>
                          {canDeleteComment(c) && (
                            <button
                              className="link-button danger-text"
                              onClick={() => removeComment(c)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                        <p>{c.body}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {canEdit && (
                  <form className="comment-form" onSubmit={postComment}>
                    <textarea
                      rows={3}
                      placeholder="Write a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      maxLength={2000}
                    />
                    <button type="submit" disabled={posting || !newComment.trim()}>
                      {posting ? "Posting..." : "Comment"}
                    </button>
                  </form>
                )}
              </div>

              <aside className="modal-side">
                <label className="field">
                  Status
                  <select value={draft.status} onChange={set("status")} disabled={!canEdit}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{label(s)}</option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  Assignee
                  <select value={draft.assignee} onChange={set("assignee")} disabled={!canEdit}>
                    <option value="">Unassigned</option>
                    {project.members.map((m) => (
                      <option key={m.user._id} value={m.user._id}>{m.user.name}</option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  Priority
                  <select value={draft.priority} onChange={set("priority")} disabled={!canEdit}>
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  Story points
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={draft.storyPoints}
                    onChange={set("storyPoints")}
                    disabled={!canEdit}
                  />
                </label>

                {item.type !== "epic" && (
                  <label className="field">
                    Epic
                    <select value={draft.epic} onChange={set("epic")} disabled={!canEdit}>
                      <option value="">No epic</option>
                      {epics.map((ep) => (
                        <option key={ep._id} value={ep._id}>{ep.title}</option>
                      ))}
                    </select>
                  </label>
                )}

                <div className="meta-block">
                  <p><strong>Sprint:</strong> {item.sprint ? item.sprint.name : "Backlog"}</p>
                  <p><strong>Reporter:</strong> {item.reporter?.name || "Unknown"}</p>
                  <p><strong>Created:</strong> {when(item.createdAt)}</p>
                  <p><strong>Updated:</strong> {when(item.updatedAt)}</p>
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  );
}