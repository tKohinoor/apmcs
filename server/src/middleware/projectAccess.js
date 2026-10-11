import mongoose from "mongoose";
import Project from "../models/Project.js";

// Loads the project and checks that the logged-in user is a member
export async function loadProject(req, res, next) {
  const { projectId } = req.params;

  if (!mongoose.isValidObjectId(projectId)) {
    return res.status(404).json({ message: "Project not found" });
  }

  const project = await Project.findById(projectId);
  const member = project?.members.find((m) => m.user.equals(req.user._id));

  if (!member) {
    return res.status(404).json({ message: "Project not found" });
  }

  req.project = project;
  req.memberRole = member.role;
  next();
}

// Blocks viewers from changing anything
export function requireWrite(req, res, next) {
  if (req.memberRole === "viewer") {
    return res.status(403).json({ message: "Viewers have read-only access" });
  }
  next();
}

// Only product owners and scrum masters may continue
export function requireLead(req, res, next) {
  if (!["product_owner", "scrum_master"].includes(req.memberRole)) {
    return res
      .status(403)
      .json({ message: "Only a product owner or scrum master can do this" });
  }
  next();
}

// Only product owners may continue
export function requireProductOwner(req, res, next) {
  if (req.memberRole !== "product_owner") {
    return res
      .status(403)
      .json({ message: "Only a product owner can do this" });
  }
  next();
}