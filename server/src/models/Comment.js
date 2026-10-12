import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkItem",
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

// Speeds up "all comments of this item, oldest first"
commentSchema.index({ item: 1, createdAt: 1 });

export default mongoose.model("Comment", commentSchema);