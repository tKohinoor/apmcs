import mongoose from "mongoose";
import Notification from "../models/Notification.js";

export async function listNotifications(req, res) {
  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ user: req.user._id })
      .sort({ _id: -1 })
      .limit(30)
      .populate("project", "name key"),
    Notification.countDocuments({ user: req.user._id, read: false }),
  ]);
  res.json({ notifications, unreadCount });
}

export async function markRead(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ message: "Notification not found" });
  }

  // The user filter means nobody can touch someone else's notifications
  const result = await Notification.updateOne(
    { _id: id, user: req.user._id },
    { read: true }
  );
  if (result.matchedCount === 0) {
    return res.status(404).json({ message: "Notification not found" });
  }
  res.json({ message: "Marked as read" });
}

export async function markAllRead(req, res) {
  await Notification.updateMany(
    { user: req.user._id, read: false },
    { read: true }
  );
  res.json({ message: "All marked as read" });
}