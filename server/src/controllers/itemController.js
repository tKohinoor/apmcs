import Sprint from "../models/Sprint.js";
import mongoose from "mongoose";
import Project from "../models/Project.js";
import WorkItem from "../models/WorkItem.js";
import Comment from "../models/Comment.js";
import { notifyProject } from "../sockets/io.js";
import { recordSnapshots } from "../utils/snapshots.js";
import { logActivity, notifyUsers } from "../utils/activity.js";

const UPDATABLE = [
  "title",
  "description",
  "type",
  "status",
  "priority",
  "storyPoints",
  "assignee",
  "epic",
  "sprint",
];

const isMember = (project, userId) =>
  project.members.some((m) => m.user.equals(userId));

// Returns an error message, or null if assignee and epic are valid
async function checkRelations(project, { assignee, epic }) {
  if (assignee) {
    if (!mongoose.isValidObjectId(assignee) || !isMember(project, assignee)) {
      return "Assignee must be a member of this project";
    }
  }
  if (epic) {
    if (!mongoose.isValidObjectId(epic)) return "Invalid epic";
    const found = await WorkItem.findOne({
      _id: epic,
      project: project._id,
      type: "epic",
    });
    if (!found) return "Epic not found in this project";
  }
  return null;
}

// Returns an error message, or null if the sprint choice is valid
async function checkSprint(project, sprintId, itemType) {
  if (!sprintId) return null;
  if (!mongoose.isValidObjectId(sprintId)) return "Invalid sprint";
  if (itemType === "epic") return "Epics cannot be added to a sprint";

  const sprint = await Sprint.findOne({ _id: sprintId, project: project._id });
  if (!sprint) return "Sprint not found in this project";
  if (sprint.state === "closed") return "Cannot add items to a closed sprint";
  return null;
}

function validationMessage(err) {
  return Object.values(err.errors)[0].message;
}

export async function listItems(req, res) {
  const filter = { project: req.project._id };

  for (const field of ["type", "status", "priority"]) {
    if (req.query[field]) filter[field] = String(req.query[field]);
  }
  if (req.query.assignee && mongoose.isValidObjectId(req.query.assignee)) {
    filter.assignee = req.query.assignee;
  }
    if (req.query.sprint === "backlog") {
    filter.sprint = null;
  } else if (req.query.sprint && mongoose.isValidObjectId(req.query.sprint)) {
    filter.sprint = req.query.sprint;
  }

  const items = await WorkItem.find(filter)
    .sort({ rank: 1 })
    .populate("assignee", "name")
    .populate("epic", "title number");

  res.json({ items });
}

export async function getItem(req, res) {
  const item = await findItem(req);
  if (!item) return res.status(404).json({ message: "Item not found" });

  await item.populate([
    { path: "assignee", select: "name" },
    { path: "epic", select: "title number" },
    { path: "reporter", select: "name" },
    { path: "sprint", select: "name state" },
  ]);

  res.json({ item });
}

export async function createItem(req, res) {
  const { title, description, type, priority, storyPoints, assignee, epic, sprint } =
    req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ message: "Title is required" });
  }

  const problem = await checkRelations(req.project, { assignee, epic });
  if (problem) return res.status(400).json({ message: problem });

  const sprintProblem = await checkSprint(req.project, sprint, type);
  if (sprintProblem) return res.status(400).json({ message: sprintProblem });

  // Atomically take the next number for this project (LIB-1, LIB-2, ...)
  const updated = await Project.findByIdAndUpdate(
    req.project._id,
    { $inc: { itemCounter: 1 } },
    { new: true }
  );

  try {
    const item = await WorkItem.create({
      project: req.project._id,
      number: updated.itemCounter,
      rank: updated.itemCounter,
      title,
      description,
      type,
      priority,
      storyPoints,
      assignee: assignee || null,
      epic: epic || null,
      sprint: sprint || null,
      reporter: req.user._id,
    });
    await recordSnapshots(item.sprint);
    await item.populate([
      { path: "assignee", select: "name" },
      { path: "epic", select: "title number" },
    ]);
    const ref = `${req.project.key}-${item.number}`;
    await logActivity(req, `created ${item.type} ${ref}: ${item.title}`, item._id);
    if (item.assignee) {
      await notifyUsers(req, [item.assignee._id], {
        type: "assigned",
        message: `${req.user.name} assigned you ${ref}: ${item.title}`,
        itemId: item._id,
      });
    }
    notifyProject(req, "items", item._id);
    res.status(201).json({ item });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: validationMessage(err) });
    }
    throw err;
  }
}

async function findItem(req) {
  const { itemId } = req.params;
  if (!mongoose.isValidObjectId(itemId)) return null;
  return WorkItem.findOne({ _id: itemId, project: req.project._id });
}

export async function updateItem(req, res) {
  const item = await findItem(req);
  if (!item) return res.status(404).json({ message: "Item not found" });

  // Only copy fields we allow; ignore everything else the client sends
  const updates = {};
  for (const field of UPDATABLE) {
    if (field in req.body) updates[field] = req.body[field];
  }

  if ("title" in updates && !String(updates.title).trim()) {
    return res.status(400).json({ message: "Title cannot be empty" });
  }
  if (updates.assignee === "") updates.assignee = null;
  if (updates.epic === "") updates.epic = null;
  if (updates.sprint === "") updates.sprint = null;
  if (updates.type === "epic") updates.sprint = null; // epics never live in sprints
  if (updates.epic && item._id.equals(updates.epic)) {
    return res.status(400).json({ message: "An item cannot be its own epic" });
  }

  const problem = await checkRelations(req.project, updates);
  if (problem) return res.status(400).json({ message: problem });

  if ("sprint" in updates) {
    if (item.sprint) {
      const current = await Sprint.findById(item.sprint);
      if (current?.state === "closed") {
        return res
          .status(400)
          .json({ message: "This item belongs to a closed sprint" });
      }
    }
    const sprintProblem = await checkSprint(
      req.project,
      updates.sprint,
      updates.type || item.type
    );
    if (sprintProblem) return res.status(400).json({ message: sprintProblem });
  }

  const previousSprint = item.sprint;
  const before = {
    status: item.status,
    assignee: item.assignee ? String(item.assignee) : null,
  };
  item.set(updates);
  const hasChanges = item.isModified();

  try {
    await item.save();
    await recordSnapshots(previousSprint, item.sprint);
    await item.populate([
      { path: "assignee", select: "name" },
      { path: "epic", select: "title number" },
    ]);
    if (hasChanges) {
      const ref = `${req.project.key}-${item.number}`;
      const newAssignee = item.assignee ? String(item.assignee._id) : null;

      if (item.status !== before.status) {
        const where = item.status.replace("_", " ");
        await logActivity(req, `moved ${ref} to ${where}`, item._id);
        await notifyUsers(req, [item.assignee?._id, item.reporter], {
          type: "status",
          message: `${req.user.name} moved ${ref} to ${where}: ${item.title}`,
          itemId: item._id,
        });
      } else if (newAssignee !== before.assignee) {
        await logActivity(
          req,
          newAssignee ? `assigned ${ref} to ${item.assignee.name}` : `unassigned ${ref}`,
          item._id
        );
      } else {
        await logActivity(req, `updated ${ref}`, item._id);
      }

      if (newAssignee && newAssignee !== before.assignee) {
        await notifyUsers(req, [newAssignee], {
          type: "assigned",
          message: `${req.user.name} assigned you ${ref}: ${item.title}`,
          itemId: item._id,
        });
      }
    }
    notifyProject(req, "items", item._id);
    res.json({ item });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: validationMessage(err) });
    }
    throw err;
  }
}

export async function deleteItem(req, res) {
  const item = await findItem(req);
  if (!item) return res.status(404).json({ message: "Item not found" });

  const isLead = ["product_owner", "scrum_master"].includes(req.memberRole);
  if (!isLead && !item.reporter.equals(req.user._id)) {
    return res
      .status(403)
      .json({ message: "Only the reporter or a project lead can delete this" });
  }

  // If an epic is deleted, detach its children instead of leaving broken links
  if (item.type === "epic") {
    await WorkItem.updateMany({ epic: item._id }, { epic: null });
  }

  await Comment.deleteMany({ item: item._id });
  await item.deleteOne();
  await recordSnapshots(item.sprint);
  await logActivity(
    req,
    `deleted ${item.type} ${req.project.key}-${item.number}: ${item.title}`
  );
  notifyProject(req, "items", item._id);
  res.json({ message: "Item deleted" });
}