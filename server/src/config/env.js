const required = ["MONGO_URI", "JWT_SECRET", "CLIENT_URL"];
const missing = required.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error(`Missing required setting(s): ${missing.join(", ")}`);
  console.error("Check server/.env (see .env.example for the full list).");
  process.exit(1);
}

if (process.env.JWT_SECRET.length < 32) {
  console.error("JWT_SECRET must be at least 32 characters long.");
  process.exit(1);
}

// CLIENT_URL may hold several addresses separated by commas.
// Trailing slashes are removed, so "http://localhost:5173/" now works too.
export const allowedOrigins = process.env.CLIENT_URL.split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);