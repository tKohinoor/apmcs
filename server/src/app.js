import sprintRoutes from "./routes/sprintRoutes.js";
import itemRoutes from "./routes/itemRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./routes/authRoutes.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());

app.get("/api/v1/health", (req, res) => {
  res.json({ status: "ok", message: "APMCS server is running" });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/projects/:projectId/items", itemRoutes);
app.use("/api/v1/projects/:projectId/sprints", sprintRoutes);
app.use("/api/v1/projects", projectRoutes);

// Catches any error thrown in the code above
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

export default app;