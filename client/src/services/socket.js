import { io } from "socket.io-client";

// "http://localhost:5000/api/v1" becomes "http://localhost:5000"
const SERVER_URL = new URL(import.meta.env.VITE_API_URL).origin;

// One shared connection for the whole app. It connects when a project opens.
export const socket = io(SERVER_URL, {
  autoConnect: false,
  // A function, so every (re)connection sends the current token
  auth: (cb) => cb({ token: localStorage.getItem("token") }),
});