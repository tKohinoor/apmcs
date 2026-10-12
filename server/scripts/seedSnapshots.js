import mongoose from "mongoose";
import Sprint from "../src/models/Sprint.js";
import SprintSnapshot from "../src/models/SprintSnapshot.js";
import { dayKey } from "../src/utils/snapshots.js";

const [sprintId, flag] = process.argv.slice(2);

if (!mongoose.isValidObjectId(sprintId)) {
  console.error(
    "Usage: node --env-file=.env scripts/seedSnapshots.js <sprintId> [--clear]"
  );
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);

const sprint = await Sprint.findById(sprintId);
if (!sprint || sprint.state === "planned") {
  console.error("Sprint not found, or it has not been started yet.");
  await mongoose.disconnect();
  process.exit(1);
}

if (flag === "--clear") {
  const result = await SprintSnapshot.deleteMany({ sprint: sprint._id });
  console.log(`Deleted ${result.deletedCount} snapshot(s).`);
  await mongoose.disconnect();
  process.exit(0);
}

const DAY_MS = 86400000;
const startKey = sprint.startDate.toISOString().slice(0, 10);
const endKey = sprint.endDate.toISOString().slice(0, 10);
const span = (Date.parse(`${endKey}T00:00:00Z`) - Date.parse(`${startKey}T00:00:00Z`)) / DAY_MS + 1;
const total = sprint.committedPoints || 20;
const today = dayKey();

let written = 0;
for (let i = 0; i < span; i++) {
  const day = new Date(Date.parse(`${startKey}T00:00:00Z`) + i * DAY_MS)
    .toISOString()
    .slice(0, 10);
  if (day >= today) break; // today's real point comes from your live data

  const noise = Math.round(Math.random() * 4 - 2);
  const remaining = Math.min(
    total,
    Math.max(0, Math.round(total * (1 - i / (span - 1))) + noise)
  );

  await SprintSnapshot.updateOne(
    { sprint: sprint._id, day },
    {
      $set: {
        project: sprint.project,
        totalPoints: total,
        completedPoints: total - remaining,
        remainingPoints: remaining,
      },
    },
    { upsert: true }
  );
  written++;
}

console.log(`Wrote ${written} fake snapshot(s) for "${sprint.name}".`);
await mongoose.disconnect();