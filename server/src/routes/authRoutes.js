import { Router } from "express";
import { register, login, getMe } from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import { loginLimiter, registerLimiter } from "../middleware/rateLimiters.js";

const router = Router();

router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);
router.get("/me", protect, getMe);

export default router;