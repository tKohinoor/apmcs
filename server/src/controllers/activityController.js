import Activity from "../models/Activity.js";

export async function listActivity(req, res) {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

  // Ask for one extra row to learn whether more exist
  const rows = await Activity.find({ project: req.project._id })
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate("actor", "name");

  res.json({ activity: rows.slice(0, limit), hasMore: rows.length > limit });
}