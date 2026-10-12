import mongoose from "mongoose";
import Comment from "../models/Comment.js";
import WorkItem from "../models/WorkItem.js";
import { notifyProject } from "../sockets/io.js";

// The item must exist AND belong to the project the user has access to
async function findItem(req) {
  const { itemId } = req.params;
  if (!mongoose.isValidObjectId(itemId)) return null;
  return WorkItem.findOne({ _id: itemId, project: req.project._id });
}

export async function listComments(req, res) {
  const item = await findItem(req);
  if (!item) return res.status(404).json({ message: "Item not found" });

  const comments = await Comment.find({ item: item._id })
    .sort({ createdAt: 1 })
    .populate("author", "name");

  res.json({ comments });
}

export async function createComment(req, res) {
  const item = await findItem(req);
  if (!item) return res.status(404).json({ message: "Item not found" });

  // Only accept plain text, whatever else the client sends
  const body = typeof req.body.body === "string" ? req.body.body.trim() : "";

  if (!body) {
    return res.status(400).json({ message: "Comment cannot be empty" });
  }
  if (body.length > 2000) {
    return res
      .status(400)
      .json({ message: "Comment must be 2000 characters or fewer" });
  }

  const comment = await Comment.create({
    project: req.project._id,
    item: item._id,
    author: req.user._id,
    body,
  });
  await comment.populate("author", "name");

  notifyProject(req, "comments", item._id);
  res.status(201).json({ comment });
}

export async function deleteComment(req, res) {
  const { itemId, commentId } = req.params;

  if (!mongoose.isValidObjectId(itemId) || !mongoose.isValidObjectId(commentId)) {
    return res.status(404).json({ message: "Comment not found" });
  }

  const comment = await Comment.findOne({
    _id: commentId,
    item: itemId,
    project: req.project._id,
  });
  if (!comment) {
    return res.status(404).json({ message: "Comment not found" });
  }

  const isLead = ["product_owner", "scrum_master"].includes(req.memberRole);
  if (!isLead && !comment.author.equals(req.user._id)) {
    return res
      .status(403)
      .json({ message: "You can only delete your own comments" });
  }

  await comment.deleteOne();
  notifyProject(req, "comments", itemId);
  res.json({ message: "Comment deleted" });
}