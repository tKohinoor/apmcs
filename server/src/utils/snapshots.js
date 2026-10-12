import Sprint from "../models/Sprint.js";
import WorkItem from "../models/WorkItem.js";
import SprintSnapshot from "../models/SprintSnapshot.js";

const ZONE = process.env.REPORT_TIMEZONE || "Asia/Kolkata";

function makeFormatter(zone) {
  // The "en-CA" locale prints dates as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

let formatter;
try {
  formatter = makeFormatter(ZONE);
} catch {
  console.warn(`Unknown REPORT_TIMEZONE "${ZONE}", using UTC`);
  formatter = makeFormatter("UTC");
}

// The calendar day of a moment, in the report time zone
export const dayKey = (date = new Date()) => formatter.format(date);

async function recordOne(sprintId) {
  const sprint = await Sprint.findById(sprintId).select("project state");
  if (!sprint || sprint.state !== "active") return; // only active sprints are tracked

  const items = await WorkItem.find({ sprint: sprint._id }).select(
    "storyPoints status"
  );

  let total = 0;
  let done = 0;
  for (const item of items) {
    const points = item.storyPoints || 0;
    total += points;
    if (item.status === "done") done += points;
  }

  const values = {
    project: sprint.project,
    totalPoints: total,
    completedPoints: done,
    remainingPoints: total - done,
  };
  const filter = { sprint: sprint._id, day: dayKey() };

  // Two requests at the same instant can collide on the unique index: try again once
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await SprintSnapshot.updateOne(filter, { $set: values }, { upsert: true });
      return;
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }
}

// Safe to call with nulls and duplicates. A reporting problem must never
// break the user's real action, so errors are logged, not thrown.
export async function recordSnapshots(...sprintIds) {
  const unique = [...new Set(sprintIds.filter(Boolean).map(String))];
  for (const id of unique) {
    try {
      await recordOne(id);
    } catch (err) {
      console.error("Snapshot error:", err.message);
    }
  }
}