import { Router } from "express";
import { burndown, velocity, workload } from "../controllers/reportController.js";
import { protect } from "../middleware/authMiddleware.js";
import { loadProject } from "../middleware/projectAccess.js";

const router = Router({ mergeParams: true });

router.use(protect, loadProject);

router.get("/burndown", burndown);
router.get("/velocity", velocity);
router.get("/workload", workload);

export default router;