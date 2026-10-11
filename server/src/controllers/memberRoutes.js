import { Router } from "express";
import {
  addMember,
  updateMemberRole,
  removeMember,
} from "../controllers/memberController.js";
import { protect } from "../middleware/authMiddleware.js";
import {
  loadProject,
  requireLead,
  requireProductOwner,
} from "../middleware/projectAccess.js";

const router = Router({ mergeParams: true });

router.use(protect, loadProject);

router.post("/", requireLead, addMember);
router.patch("/:userId", requireProductOwner, updateMemberRole);
router.delete("/:userId", removeMember); // permissions are checked inside

export default router;