import mongoose from "mongoose";

const workItemSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    number: { type: Number, required: true },
    type: {
      type: String,
      enum: ["epic", "story", "task", "bug"],
      default: "task",
    },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, trim: true, maxlength: 5000, default: "" },
    status: {
      type: String,
      enum: ["todo", "in_progress", "in_review", "done"],
      default: "todo",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    storyPoints: { type: Number, min: 0, max: 100, default: null },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    epic: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkItem",
      default: null,
    },
    sprint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sprint",
      default: null, // null means the item is in the backlog
    },
    rank: { type: Number, default: 0 }, // order in the backlog (we'll use this for drag-and-drop later)
  },
  { timestamps: true }
);

workItemSchema.index({ project: 1, number: 1 }, { unique: true });
workItemSchema.index({ project: 1, status: 1 });

export default mongoose.model("WorkItem", workItemSchema);