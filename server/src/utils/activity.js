import Activity from "../models/Activity.js";
import Notification from "../models/Notification.js";
import { emitToUser } from "../sockets/io.js";

const clip = (text) => String(text).slice(0, 300);

// Adds a line to the project's activity feed.
// Never throws: a logging problem must not break the user's real action.
export async function logActivity(req, text, itemId = null) {
  try {
    await Activity.create({
      project: req.project._id,
      actor: req.user._id,
      item: itemId,
      text: clip(text),
    });
  } catch (err) {
    console.error("Activity error:", err.message);
  }
}

// Creates a notification for each user, skipping the person who did the action
// and any duplicates. Pass projectId: null for messages that should not link to
// a project (for example "you were removed").
export async function notifyUsers(
  req,
  userIds,
  { type, message, itemId = null, projectId = req.project._id }
) {
  const actorId = String(req.user._id);
  const targets = [...new Set(userIds.filter(Boolean).map(String))].filter(
    (id) => id !== actorId
  );
  if (targets.length === 0) return;

  try {
    await Notification.insertMany(
      targets.map((user) => ({
        user,
        project: projectId,
        item: itemId,
        actor: req.user._id,
        type,
        message: clip(message),
      }))
    );
    for (const id of targets) emitToUser(id);
  } catch (err) {
    console.error("Notification error:", err.message);
  }
}