import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: "WorkItem", default: null },
    text: { type: String, required: true, maxlength: 300 },
  },
  { timestamps: true }
);

activitySchema.index({ project: 1, _id: -1 });

export default mongoose.model("Activity", activitySchema);