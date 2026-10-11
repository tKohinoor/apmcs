import express from "express";
import cors from "cors";
import helmet from "helmet";

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());

app.get("/api/v1/health", (req, res) => {
  res.json({ status: "ok", message: "APMCS server is running" });
});

export default app;