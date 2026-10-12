import mongoose from "mongoose";

const snapshotSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    sprint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sprint",
      required: true,
    },
    day: {
      type: String, // calendar day like "2026-10-12"
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    totalPoints: { type: Number, default: 0 },
    completedPoints: { type: Number, default: 0 },
    remainingPoints: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// One snapshot per sprint per day
snapshotSchema.index({ sprint: 1, day: 1 }, { unique: true });

export default mongoose.model("SprintSnapshot", snapshotSchema);