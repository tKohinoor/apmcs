import rateLimit from "express-rate-limit";

const common = {
  standardHeaders: "draft-7",
  legacyHeaders: false,
  // Automated tests make many requests from one address
  skip: () => process.env.NODE_ENV === "test",
};

// Everything under /api. Generous, because one page load makes about 9
// requests and live updates trigger reloads. Several users on one college
// network share an IP address, so keep this high.
export const apiLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 3000,
  message: { message: "Too many requests. Please slow down and try again shortly." },
});

// Only FAILED logins count, so normal users are never affected
export const loginLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: { message: "Too many failed login attempts. Try again in 15 minutes." },
});

export const registerLimiter = rateLimit({
  ...common,
  windowMs: 60 * 60 * 1000,
  limit: 20,
  message: { message: "Too many accounts created from this network. Try again later." },
});