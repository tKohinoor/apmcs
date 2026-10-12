import mongoose from "mongoose";
import Sprint from "../models/Sprint.js";
import WorkItem from "../models/WorkItem.js";
import User from "../models/User.js";
import SprintSnapshot from "../models/SprintSnapshot.js";
import { dayKey, recordSnapshots } from "../utils/snapshots.js";

const DAY_MS = 86400000;
const MAX_DAYS = 120;
const round1 = (n) => Math.round(n * 10) / 10;
const utcDay = (key) => Date.parse(`${key}T00:00:00Z`);

export async function burndown(req, res) {
  let sprint = null;

  if (req.query.sprint) {
    const id = String(req.query.sprint);
    sprint = mongoose.isValidObjectId(id)
      ? await Sprint.findOne({ _id: id, project: req.project._id })
      : null;
    if (!sprint) return res.status(404).json({ message: "Sprint not found" });
  } else {
    // Default: the active sprint, otherwise the most recently closed one
    sprint =
      (await Sprint.findOne({ project: req.project._id, state: "active" })) ||
      (await Sprint.findOne({ project: req.project._id, state: "closed" }).sort({
        completedAt: -1,
      }));
  }

  if (!sprint) return res.json({ sprint: null, rows: [] });
  if (sprint.state === "planned") {
    return res
      .status(400)
      .json({ message: "This sprint has not started yet" });
  }

  const startKey = sprint.startDate.toISOString().slice(0, 10);
  const endKey = sprint.endDate.toISOString().slice(0, 10);
  const span = (utcDay(endKey) - utcDay(startKey)) / DAY_MS + 1;
  if (span > MAX_DAYS) {
    return res
      .status(400)
      .json({ message: "This sprint is too long to chart (over 120 days)" });
  }

  // Makes sure today's point exists, even for sprints started before reports existed
  if (sprint.state === "active") await recordSnapshots(sprint._id);

  const snapshots = await SprintSnapshot.find({ sprint: sprint._id })
    .sort({ day: 1 })
    .lean();

  const days = [];
  for (let i = 0; i < span; i++) {
    days.push(new Date(utcDay(startKey) + i * DAY_MS).toISOString().slice(0, 10));
  }

  // The chart stops at today (active sprint) or at the completion day (closed sprint)
  const lastKey =
    sprint.state === "active"
      ? dayKey()
      : dayKey(sprint.completedAt || new Date());

  const committed = sprint.committedPoints || 0;
  let pointer = -1;

  const rows = days.map((date, i) => {
    // Use the latest snapshot taken on or before this day (ISO dates compare as text)
    while (pointer + 1 < snapshots.length && snapshots[pointer + 1].day <= date) {
      pointer++;
    }
    const snap = pointer >= 0 ? snapshots[pointer] : null;
    const show = snap && date <= lastKey;

    return {
      date,
      ideal: round1(committed * (1 - i / (days.length - 1))),
      remaining: show ? snap.remainingPoints : null,
      scope: show ? snap.totalPoints : null,
    };
  });

  res.json({
    sprint: {
      _id: sprint._id,
      name: sprint.name,
      goal: sprint.goal,
      state: sprint.state,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      committedPoints: sprint.committedPoints,
      completedPoints: sprint.completedPoints,
    },
    today: dayKey(),
    rows,
  });
}

export async function velocity(req, res) {
  const recent = await Sprint.find({ project: req.project._id, state: "closed" })
    .sort({ completedAt: -1 })
    .limit(8)
    .lean();

  const rows = recent.reverse().map((s) => ({
    name: s.name,
    committed: s.committedPoints,
    completed: s.completedPoints,
  }));

  const average = rows.length
    ? round1(rows.reduce((sum, r) => sum + r.completed, 0) / rows.length)
    : 0;

  res.json({ rows, average });
}

export async function workload(req, res) {
  const sprint = await Sprint.findOne({
    project: req.project._id,
    state: "active",
  });
  if (!sprint) return res.json({ sprint: null, rows: [] });

  const grouped = await WorkItem.aggregate([
    { $match: { project: req.project._id, sprint: sprint._id } },
    {
      $group: {
        _id: "$assignee",
        items: { $sum: 1 },
        openItems: { $sum: { $cond: [{ $ne: ["$status", "done"] }, 1, 0] } },
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

  const ids = grouped.map((g) => g._id).filter(Boolean);
  const users = await User.find({ _id: { $in: ids } }).select("name");
  const names = new Map(users.map((u) => [String(u._id), u.name]));

  const rows = grouped
    .map((g) => ({
      userId: g._id ? String(g._id) : null,
      name: g._id ? names.get(String(g._id)) || "Former member" : "Unassigned",
      items: g.items,
      openItems: g.openItems,
      points: g.points,
      donePoints: g.donePoints,
      openPoints: g.points - g.donePoints,
    }))
    .sort((a, b) => b.openPoints - a.openPoints || a.name.localeCompare(b.name));

  res.json({ sprint: { _id: sprint._id, name: sprint.name }, rows });
}