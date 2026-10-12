import "./config/env.js"; // must stay first: it checks settings before anything else loads
import http from "http";
import app from "./app.js";
import connectDB from "./config/db.js";
import { initSockets } from "./sockets/index.js";

const PORT = process.env.PORT || 5000;

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

connectDB()
  .then(() => {
    const server = http.createServer(app);
    initSockets(server);
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("Database connection failed:", err.message);
    process.exit(1);
  });