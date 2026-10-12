import express from "express";
import cors from "cors";
import helmet from "helmet";
import { allowedOrigins } from "./config/env.js";
import { apiLimiter } from "./middleware/rateLimiters.js";
import { rejectOperatorKeys, ensureBody } from "./middleware/security.js";
import authRoutes from "./routes/authRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import itemRoutes from "./routes/itemRoutes.js";
import sprintRoutes from "./routes/sprintRoutes.js";
import memberRoutes from "./routes/memberRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import activityRoutes from "./routes/activityRoutes.js";

const app = express();

// Behind a proxy (Render, Railway...) every visitor would look like the same IP
// and rate limiting would fail. Set TRUST_PROXY=1 there. Leave it unset locally.
if (process.env.TRUST_PROXY) {
  app.set("trust proxy", Number(process.env.TRUST_PROXY));
}

app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use("/api", apiLimiter);
app.use(express.json({ limit: "100kb" }));
app.use(ensureBody);
app.use(rejectOperatorKeys);

app.get("/api/v1/health", (req, res) => {
  res.json({ status: "ok", message: "APMCS server is running" });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/notifications", notificationRoutes);

// Routes nested under a project come before the general /projects route
app.use("/api/v1/projects/:projectId/items", itemRoutes);
app.use("/api/v1/projects/:projectId/sprints", sprintRoutes);
app.use("/api/v1/projects/:projectId/members", memberRoutes);
app.use("/api/v1/projects/:projectId/reports", reportRoutes);
app.use("/api/v1/projects/:projectId/activity", activityRoutes);
app.use("/api/v1/projects", projectRoutes);

// Unknown API address: answer in JSON, not Express's default HTML page
app.use("/api", (req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Last resort for anything thrown above
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err.type === "entity.too.large") {
    return res.status(413).json({ message: "Request body too large" });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON in request body" });
  }
  if (err.name === "CastError") {
    return res.status(400).json({ message: "Invalid value in request" });
  }
  if (err.name === "ValidationError") {
    return res.status(400).json({ message: Object.values(err.errors)[0].message });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: "That value already exists" });
  }

  // Other 4xx errors raised by Express libraries are safe to show
  if (err.status >= 400 && err.status < 500 && err.expose) {
    return res.status(err.status).json({ message: err.message });
  }

  // Details go to YOUR terminal only. The client sees a generic message.
  console.error(err);
  res.status(500).json({ message: "Server error" });
});

export default app;