import mongoose from "mongoose";

const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: {
      type: String,
      enum: ["product_owner", "scrum_master", "member", "viewer"],
      default: "member",
    },
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    key: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      match: [/^[A-Z]{2,5}$/, "Key must be 2 to 5 letters"],
    },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: [memberSchema],
  },
  { timestamps: true }
);

// Speeds up "find all projects for this user"
projectSchema.index({ "members.user": 1 });

export default mongoose.model("Project", projectSchema);