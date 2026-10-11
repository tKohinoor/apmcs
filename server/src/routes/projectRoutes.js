import { Router } from "express";
import {
  createProject,
  listProjects,
  getProject,
} from "../controllers/projectController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

router.use(protect); // every project route requires login

router.route("/").get(listProjects).post(createProject);
router.get("/:id", getProject);

export default router;