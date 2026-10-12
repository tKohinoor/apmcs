// MongoDB treats keys like "$ne" or "$gt" as commands. If an attacker sends
//   { "email": { "$gt": "" } }
// a naive query would match every user. No part of our app needs keys with "$"
// or ".", so any request containing them is rejected.
function hasBadKey(value, depth = 0) {
  if (value === null || typeof value !== "object") return false;
  if (depth > 10) return true; // absurdly deep objects are not legitimate

  for (const key of Object.keys(value)) {
    if (key.includes("$") || key.includes(".")) return true;
    if (hasBadKey(value[key], depth + 1)) return true;
  }
  return false;
}

export function rejectOperatorKeys(req, res, next) {
  if (hasBadKey(req.body) || hasBadKey(req.query)) {
    return res.status(400).json({ message: "Invalid characters in request" });
  }
  next();
}

// Express 5 leaves req.body undefined when a request has no JSON body, and our
// controllers destructure it. Give them an empty object instead of crashing.
export function ensureBody(req, res, next) {
  if (req.body === undefined || req.body === null) req.body = {};
  next();
}