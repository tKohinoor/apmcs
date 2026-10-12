import { Router } from "express";
import { listActivity } from "../controllers/activityController.js";
import { protect } from "../middleware/authMiddleware.js";
import { loadProject } from "../middleware/projectAccess.js";

const router = Router({ mergeParams: true });

router.use(protect, loadProject);
router.get("/", listActivity);

export default router;