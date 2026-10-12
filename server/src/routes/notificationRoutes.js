import { Router } from "express";
import {
  listNotifications,
  markRead,
  markAllRead,
} from "../controllers/notificationController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = Router();

router.use(protect);

router.get("/", listNotifications);
router.post("/read-all", markAllRead);
router.patch("/:id/read", markRead);

export default router;