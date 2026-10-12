import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import Project from "../models/Project.js";
import { setIo, broadcastPresence } from "./io.js";

export function initSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL, credentials: true },
  });

  // Runs once for every new connection: only logged-in users get through
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Not logged in"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("name");
      if (!user) return next(new Error("User no longer exists"));

      socket.data.user = { id: String(user._id), name: user.name };
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    // A private room for this user, used to reach all of their open tabs
    socket.join(`user:${socket.data.user.id}`);

    // Projects this socket currently wants to be in
    const wanted = new Set();

    socket.on("project:join", async (projectId, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};

      if (typeof projectId !== "string" || !mongoose.isValidObjectId(projectId)) {
        return reply({ ok: false, message: "Invalid project" });
      }

      wanted.add(projectId);
      try {
        const isMember = await Project.exists({
          _id: projectId,
          "members.user": socket.data.user.id,
        });

        if (!isMember) {
          wanted.delete(projectId);
          return reply({ ok: false, message: "Project not found" });
        }
        // The page may have been closed while we were checking
        if (!wanted.has(projectId)) return reply({ ok: false });

        socket.join(`project:${projectId}`);
        await broadcastPresence(projectId);
        reply({ ok: true });
      } catch {
        reply({ ok: false, message: "Could not join project" });
      }
    });

    socket.on("project:leave", (projectId) => {
      if (typeof projectId !== "string") return;
      wanted.delete(projectId);
      if (socket.rooms.has(`project:${projectId}`)) {
        socket.leave(`project:${projectId}`);
        broadcastPresence(projectId);
      }
    });

    // Fires just before a disconnect, while we still know the rooms
    socket.on("disconnecting", () => {
      for (const room of socket.rooms) {
        if (room.startsWith("project:")) {
          broadcastPresence(room.slice("project:".length), socket.id);
        }
      }
    });
  });

  setIo(io);
  return io;
}