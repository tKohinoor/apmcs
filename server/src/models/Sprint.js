import mongoose from "mongoose";

const sprintSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    goal: { type: String, trim: true, maxlength: 300, default: "" },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    state: {
      type: String,
      enum: ["planned", "active", "closed"],
      default: "planned",
    },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    committedPoints: { type: Number, default: 0 },
    completedPoints: { type: Number, default: 0 },
  },
  { timestamps: true }
);

sprintSchema.index({ project: 1, state: 1 });

// Database-level rule: at most one ACTIVE sprint per project
sprintSchema.index(
  { project: 1 },
  { unique: true, partialFilterExpression: { state: "active" } }
);

export default mongoose.model("Sprint", sprintSchema);