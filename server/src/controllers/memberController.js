import mongoose from "mongoose";
import Project from "../models/Project.js";
import User from "../models/User.js";
import WorkItem from "../models/WorkItem.js";
import { notifyProject, revokeAccess } from "../sockets/io.js";

const ALL_ROLES = ["product_owner", "scrum_master", "member", "viewer"];
const ADD_ROLES = ["scrum_master", "member", "viewer"];

export async function addMember(req, res) {
  const { email, role = "member" } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }
  if (!ADD_ROLES.includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  // String() makes sure a sneaky object can't be used as a database query
  const user = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (!user) {
    return res.status(404).json({
      message: "No registered user with that email. Ask them to sign up first.",
    });
  }

  // Adds the member only if they are not already in the list (one atomic step)
  const result = await Project.updateOne(
    { _id: req.project._id, "members.user": { $ne: user._id } },
    { $push: { members: { user: user._id, role } } }
  );

  if (result.modifiedCount === 0) {
    return res.status(409).json({ message: "Already a member of this project" });
  }

  notifyProject(req, "members");
  res.status(201).json({ message: `${user.name} added as ${role}` });
}

export async function updateMemberRole(req, res) {
  const { userId } = req.params;
  const { role } = req.body;

  if (!mongoose.isValidObjectId(userId)) {
    return res.status(404).json({ message: "Member not found" });
  }
  if (!ALL_ROLES.includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  const target = req.project.members.find((m) => m.user.equals(userId));
  if (!target) {
    return res.status(404).json({ message: "Member not found" });
  }
  if (req.project.owner.equals(userId)) {
    return res
      .status(400)
      .json({ message: "The project owner's role cannot be changed" });
  }

  await Project.updateOne(
    { _id: req.project._id, "members.user": userId },
    { $set: { "members.$.role": role } }
  );

  notifyProject(req, "members");
  res.json({ message: "Role updated" });
}

export async function removeMember(req, res) {
  const { userId } = req.params;

  if (!mongoose.isValidObjectId(userId)) {
    return res.status(404).json({ message: "Member not found" });
  }

  const target = req.project.members.find((m) => m.user.equals(userId));
  if (!target) {
    return res.status(404).json({ message: "Member not found" });
  }
  if (req.project.owner.equals(userId)) {
    return res.status(400).json({ message: "The project owner cannot be removed" });
  }

  const isSelf = req.user._id.equals(userId);
  const isPO = req.memberRole === "product_owner";
  const isSM = req.memberRole === "scrum_master";
  const allowed =
    isSelf || isPO || (isSM && ["member", "viewer"].includes(target.role));

  if (!allowed) {
    return res
      .status(403)
      .json({ message: "You are not allowed to remove this member" });
  }

  await Project.updateOne(
    { _id: req.project._id },
    { $pull: { members: { user: userId } } }
  );

  // Their work is not lost, just unassigned
  await WorkItem.updateMany(
    { project: req.project._id, assignee: userId },
    { assignee: null }
  );

      // Remove them from the live room first, so they don't receive the next notice
  revokeAccess(req.project._id, userId, !isSelf);
  notifyProject(req, "members");
  res.json({ message: isSelf ? "You left the project" : "Member removed" });
}