import { useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";

const COLUMNS = [
  { id: "todo", title: "To do" },
  { id: "in_progress", title: "In progress" },
  { id: "in_review", title: "In review" },
  { id: "done", title: "Done" },
];

// How a card looks (used in the column and in the floating drag preview)
function CardBody({ item, projectKey }) {
  return (
    <>
      <div className="card-top">
        <span className={`badge type-${item.type}`}>{item.type}</span>
        <span className="item-key">{projectKey}-{item.number}</span>
      </div>
      <p className="card-title">{item.title}</p>
      <div className="card-bottom">
        <span className={`badge prio-${item.priority}`}>{item.priority}</span>
        <span className="points">{item.storyPoints ?? "-"}</span>
        {item.assignee ? (
          <span className="avatar small" title={item.assignee.name}>
            {item.assignee.name.charAt(0).toUpperCase()}
          </span>
        ) : (
          <span className="avatar small empty" title="Unassigned">?</span>
        )}
      </div>
    </>
  );
}

function DraggableCard({ item, projectKey, canEdit, onOpen }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item._id,
    disabled: !canEdit,
  });

  return (
    <div
      ref={setNodeRef}
      className={`board-card ${isDragging ? "is-dragging" : ""} ${canEdit ? "can-drag" : ""}`}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(item._id)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(item._id);
      }}
    >
      <CardBody item={item} projectKey={projectKey} />
    </div>
  );
}

function Column({ column, items, projectKey, canEdit, onOpen }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const points = items.reduce((sum, i) => sum + (i.storyPoints || 0), 0);

  return (
    <div ref={setNodeRef} className={`board-column ${isOver ? "is-over" : ""}`}>
      <div className="column-head">
        <strong>{column.title}</strong>
        <span className="points">{items.length}</span>
        <small>{points} pts</small>
      </div>
      <div className="column-body">
        {items.map((item) => (
          <DraggableCard
            key={item._id}
            item={item}
            projectKey={projectKey}
            canEdit={canEdit}
            onOpen={onOpen}
          />
        ))}
        {items.length === 0 && <p className="column-empty">Drop items here</p>}
      </div>
    </div>
  );
}

export default function Board({ project, myRole, sprints, version, onChange, onOpen }) {
  const { user } = useAuth();
  const canEdit = myRole !== "viewer";
  const sprint = sprints.find((s) => s.state === "active");
  const sprintId = sprint?._id;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [draggingId, setDraggingId] = useState(null);

  // A drag only starts after the pointer moves 6px, so normal clicks still work
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  useEffect(() => {
    if (!sprintId) {
      setItems([]);
      setLoading(false);
      return;
    }
    api(`/projects/${project._id}/items?sprint=${sprintId}`)
      .then((data) => setItems(data.items))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [project._id, sprintId, version]);

  async function handleDragEnd({ active, over }) {
    setDraggingId(null);
    if (!over) return;

    const item = items.find((i) => i._id === active.id);
    if (!item || item.status === over.id) return;

    setError("");
    const previous = items;
    // Move the card right away, undo it if the server says no
    setItems(items.map((i) => (i._id === item._id ? { ...i, status: over.id } : i)));

    try {
      await api(`/projects/${project._id}/items/${item._id}`, {
        method: "PATCH",
        body: { status: over.id },
      });
      onChange(); // refreshes sprint progress and the backlog list
    } catch (err) {
      setItems(previous);
      setError(err.message);
    }
  }

  const visible = mineOnly
    ? items.filter((i) => i.assignee && i.assignee._id === user.id)
    : items;

  const totalPoints = items.reduce((sum, i) => sum + (i.storyPoints || 0), 0);
  const donePoints = items
    .filter((i) => i.status === "done")
    .reduce((sum, i) => sum + (i.storyPoints || 0), 0);
  const percent = totalPoints ? Math.round((donePoints / totalPoints) * 100) : 0;

  const draggingItem = items.find((i) => i._id === draggingId);

  return (
    <section className="board">
      <div className="page-title">
        <h2>Board{sprint ? `: ${sprint.name}` : ""}</h2>
        {sprint && (
          <label className="mine-toggle">
            <input
              type="checkbox"
              checked={mineOnly}
              onChange={(e) => setMineOnly(e.target.checked)}
            />
            Only my items
          </label>
        )}
      </div>

      {!sprint && (
        <p className="board-hint">
          There is no active sprint. Add items to a sprint and click
          &quot;Start sprint&quot; to see the board.
        </p>
      )}

      {sprint && (
        <>
          {sprint.goal && <p className="sprint-goal">Goal: {sprint.goal}</p>}
          <div className="progress-row">
            <div className="progress">
              <div className="progress-fill" style={{ width: `${percent}%` }} />
            </div>
            <small>{donePoints} / {totalPoints} pts done ({percent}%)</small>
          </div>
          {!canEdit && <p className="board-hint">Viewers can see the board but not move cards.</p>}
          {error && <p className="error">{error}</p>}
          {loading && <p>Loading board...</p>}

          <DndContext
            sensors={sensors}
            onDragStart={({ active }) => setDraggingId(active.id)}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDraggingId(null)}
          >
            <div className="board-columns">
              {COLUMNS.map((col) => (
                <Column
                  key={col.id}
                  column={col}
                  items={visible.filter((i) => i.status === col.id)}
                  projectKey={project.key}
                  canEdit={canEdit}
                  onOpen={onOpen}
                />
              ))}
            </div>
            <DragOverlay>
              {draggingItem ? (
                <div className="board-card overlay">
                  <CardBody item={draggingItem} projectKey={project.key} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </>
      )}
    </section>
  );
}