import mongoose from "mongoose";
import Sprint from "../models/Sprint.js";
import WorkItem from "../models/WorkItem.js";
import { notifyProject } from "../sockets/io.js";
import { recordSnapshots } from "../utils/snapshots.js";

const toDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const sumPoints = (items) =>
  items.reduce((total, item) => total + (item.storyPoints || 0), 0);

async function findSprint(req) {
  const { sprintId } = req.params;
  if (!mongoose.isValidObjectId(sprintId)) return null;
  return Sprint.findOne({ _id: sprintId, project: req.project._id });
}

export async function listSprints(req, res) {
  const sprints = await Sprint.find({ project: req.project._id }).sort({
    startDate: 1,
  });

  // One database query that counts items and points per sprint
  const rows = await WorkItem.aggregate([
    { $match: { project: req.project._id, sprint: { $ne: null } } },
    {
      $group: {
        _id: "$sprint",
        count: { $sum: 1 },
        points: { $sum: { $ifNull: ["$storyPoints", 0] } },
        donePoints: {
          $sum: {
            $cond: [
              { $eq: ["$status", "done"] },
              { $ifNull: ["$storyPoints", 0] },
              0,
            ],
          },
        },
      },
    },
  ]);

  const stats = new Map(rows.map((r) => [String(r._id), r]));

  res.json({
    sprints: sprints.map((s) => {
      const r = stats.get(String(s._id));
      return {
        ...s.toObject(),
        stats: {
          count: r?.count ?? 0,
          points: r?.points ?? 0,
          donePoints: r?.donePoints ?? 0,
        },
      };
    }),
  });
}

export async function createSprint(req, res) {
  const { name, goal, startDate, endDate } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ message: "Sprint name is required" });
  }
  const start = toDate(startDate);
  const end = toDate(endDate);
  if (!start || !end) {
    return res
      .status(400)
      .json({ message: "Valid start and end dates are required" });
  }
  if (end <= start) {
    return res.status(400).json({ message: "End date must be after start date" });
  }

  try {
    const sprint = await Sprint.create({
      project: req.project._id,
      name,
      goal,
      startDate: start,
      endDate: end,
    });
    notifyProject(req, "sprints");
    res.status(201).json({ sprint });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res
        .status(400)
        .json({ message: Object.values(err.errors)[0].message });
    }
    throw err;
  }
}

export async function updateSprint(req, res) {
  const sprint = await findSprint(req);
  if (!sprint) return res.status(404).json({ message: "Sprint not found" });
  if (sprint.state === "closed") {
    return res.status(400).json({ message: "A closed sprint cannot be edited" });
  }

  const { name, goal, startDate, endDate } = req.body;

  if (name !== undefined) {
    if (!String(name).trim()) {
      return res.status(400).json({ message: "Sprint name cannot be empty" });
    }
    sprint.name = name;
  }
  if (goal !== undefined) sprint.goal = goal;
  if (startDate !== undefined) {
    const d = toDate(startDate);
    if (!d) return res.status(400).json({ message: "Invalid start date" });
    sprint.startDate = d;
  }
  if (endDate !== undefined) {
    const d = toDate(endDate);
    if (!d) return res.status(400).json({ message: "Invalid end date" });
    sprint.endDate = d;
  }
  if (sprint.endDate <= sprint.startDate) {
    return res.status(400).json({ message: "End date must be after start date" });
  }

  try {
    await sprint.save();
    notifyProject(req, "sprints");
    res.json({ sprint });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res
        .status(400)
        .json({ message: Object.values(err.errors)[0].message });
    }
    throw err;
  }
}

export async function startSprint(req, res) {
  const sprint = await findSprint(req);
  if (!sprint) return res.status(404).json({ message: "Sprint not found" });
  if (sprint.state !== "planned") {
    return res.status(400).json({ message: "Only a planned sprint can be started" });
  }

  const alreadyActive = await Sprint.findOne({
    project: req.project._id,
    state: "active",
  });
  if (alreadyActive) {
    return res
      .status(409)
      .json({ message: `Complete "${alreadyActive.name}" before starting another sprint` });
  }

  const items = await WorkItem.find({ sprint: sprint._id });
  if (items.length === 0) {
    return res
      .status(400)
      .json({ message: "Add at least one item to the sprint before starting it" });
  }

  sprint.state = "active";
  sprint.startedAt = new Date();
  sprint.committedPoints = sumPoints(items);

  try {
    await sprint.save();
  } catch (err) {
    // The unique index caught a simultaneous start
    if (err.code === 11000) {
      return res.status(409).json({ message: "Another sprint is already active" });
    }
    throw err;
  }
  await recordSnapshots(sprint._id);
  notifyProject(req, "sprints");
  res.json({ sprint });
}

export async function completeSprint(req, res) {
  const sprint = await findSprint(req);
  if (!sprint) return res.status(404).json({ message: "Sprint not found" });
  if (sprint.state !== "active") {
    return res.status(400).json({ message: "Only an active sprint can be completed" });
  }

  // Where should unfinished items go: "backlog" (default) or a planned sprint id
  const { moveTo } = req.body;
  let targetId = null;

  if (moveTo && moveTo !== "backlog") {
    const target = mongoose.isValidObjectId(moveTo)
      ? await Sprint.findOne({
          _id: moveTo,
          project: req.project._id,
          state: "planned",
        })
      : null;
    if (!target) {
      return res.status(400).json({ message: "Target sprint must be a planned sprint" });
    }
    targetId = target._id;
  }

  const items = await WorkItem.find({ sprint: sprint._id });
  const done = items.filter((i) => i.status === "done");
  // Save the final picture while the unfinished items are still in the sprint,
  // so the chart ends at what was really left, not at zero
  await recordSnapshots(sprint._id);

  // Unfinished items leave; finished items stay as the sprint's history
  const moved = await WorkItem.updateMany(
    { sprint: sprint._id, status: { $ne: "done" } },
    { sprint: targetId }
  );

  sprint.state = "closed";
  sprint.completedAt = new Date();
  sprint.completedPoints = sumPoints(done);
  await sprint.save();

  notifyProject(req, "sprints");
  res.json({ sprint, movedCount: moved.modifiedCount });
}

export async function deleteSprint(req, res) {
  const sprint = await findSprint(req);
  if (!sprint) return res.status(404).json({ message: "Sprint not found" });
  if (sprint.state !== "planned") {
    return res.status(400).json({ message: "Only a planned sprint can be deleted" });
  }

  // Its items go back to the backlog
  await WorkItem.updateMany({ sprint: sprint._id }, { sprint: null });
  await sprint.deleteOne();
  notifyProject(req, "sprints");
  res.json({ message: "Sprint deleted" });
}