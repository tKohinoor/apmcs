import { Router } from "express";
import {
  listSprints,
  createSprint,
  updateSprint,
  startSprint,
  completeSprint,
  deleteSprint,
} from "../controllers/sprintController.js";
import { protect } from "../middleware/authMiddleware.js";
import { loadProject, requireLead } from "../middleware/projectAccess.js";

const router = Router({ mergeParams: true });

router.use(protect, loadProject);

router.route("/").get(listSprints).post(requireLead, createSprint);
router
  .route("/:sprintId")
  .patch(requireLead, updateSprint)
  .delete(requireLead, deleteSprint);
router.post("/:sprintId/start", requireLead, startSprint);
router.post("/:sprintId/complete", requireLead, completeSprint);

export default router;