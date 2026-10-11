import mongoose from "mongoose";
import Project from "../models/Project.js";

export async function createProject(req, res) {
  const { name, key, description } = req.body;

  if (!name || !key) {
    return res.status(400).json({ message: "Name and key are required" });
  }

  try {
    const project = await Project.create({
      name,
      key,
      description,
      owner: req.user._id,
      members: [{ user: req.user._id, role: "product_owner" }],
    });
    res.status(201).json({ project });
  } catch (err) {
    if (err.name === "ValidationError") {
      const message = Object.values(err.errors)[0].message;
      return res.status(400).json({ message });
    }
    throw err;
  }
}

export async function listProjects(req, res) {
  const projects = await Project.find({ "members.user": req.user._id }).sort({
    createdAt: -1,
  });
  res.json({ projects });
}

export async function getProject(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ message: "Project not found" });
  }

  const project = await Project.findById(id).populate("members.user", "name email");

  // Same answer whether the project doesn't exist or you aren't a member,
  // so outsiders can't discover which project IDs exist
  const isMember =
    project && project.members.some((m) => m.user._id.equals(req.user._id));

  if (!isMember) {
    return res.status(404).json({ message: "Project not found" });
  }

  const me = project.members.find((m) => m.user._id.equals(req.user._id));
  res.json({ project, myRole: me.role });
}