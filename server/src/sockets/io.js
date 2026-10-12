let io = null;

export function setIo(instance) {
  io = instance;
}

// Sends an event to everyone who has this project open
export function emitToProject(projectId, payload) {
  if (!io) return;
  io.to(`project:${projectId}`).emit("project:event", payload);
}

// Convenience wrapper used by controllers: type is "items", "sprints",
// "members" or "comments"; refId is the item the change is about (optional)
export function notifyProject(req, type, refId = null) {
  emitToProject(req.project._id, {
    type,
    itemId: refId ? String(refId) : null,
    actorId: String(req.user._id),
  });
}

// Tells everyone in the project who is currently online
export async function broadcastPresence(projectId, excludeSocketId = null) {
  if (!io) return;
  try {
    const room = `project:${projectId}`;
    const sockets = await io.in(room).fetchSockets();
    const users = new Map();

    for (const s of sockets) {
      if (s.id === excludeSocketId) continue;
      const u = s.data.user;
      if (u) users.set(u.id, u.name);
    }

    io.to(room).emit("project:presence", {
      projectId: String(projectId),
      users: [...users].map(([id, name]) => ({ id, name })),
    });
  } catch (err) {
    console.error("Presence error:", err.message);
  }
}

// Removes a person's connections from a project room (used when they are removed)
export function revokeAccess(projectId, userId, notifyUser = true) {
  if (!io) return;
  if (notifyUser) {
    io.to(`user:${userId}`).emit("project:revoked", {
      projectId: String(projectId),
    });
  }
  io.in(`user:${userId}`).socketsLeave(`project:${projectId}`);
  broadcastPresence(projectId);
}

// Tells one user (in all their open tabs) that something new arrived
export function emitToUser(userId) {
  if (!io) return;
  io.to(`user:${userId}`).emit("notification:new");
}