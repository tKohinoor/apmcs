import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

const userResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
});

// Used so login takes the same time whether or not the email exists
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isText = (value) => typeof value === "string";

function passwordProblem(password) {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (Buffer.byteLength(password) > 72) {
    return "Password is too long (72 bytes maximum)";
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Password must contain at least one letter and one number";
  }
  return null;
}

export async function register(req, res) {
  const { name, email, password } = req.body;

  // Text only: an object here is an injection attempt, not a real name
  if (!isText(name) || !isText(email) || !isText(password)) {
    return res
      .status(400)
      .json({ message: "Name, email and password are required" });
  }

  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanName || !cleanEmail || !password) {
    return res
      .status(400)
      .json({ message: "Name, email and password are required" });
  }
  if (cleanName.length > 60) {
    return res.status(400).json({ message: "Name must be 60 characters or fewer" });
  }
  if (cleanEmail.length > 254 || !EMAIL_PATTERN.test(cleanEmail)) {
    return res.status(400).json({ message: "Enter a valid email address" });
  }
  const problem = passwordProblem(password);
  if (problem) return res.status(400).json({ message: problem });

  const exists = await User.findOne({ email: cleanEmail });
  if (exists) {
    return res.status(409).json({ message: "Email already registered" });
  }

  try {
    const user = await User.create({
      name: cleanName,
      email: cleanEmail,
      password,
    });
    res.status(201).json({ token: signToken(user._id), user: userResponse(user) });
  } catch (err) {
    // Two sign-ups with the same email at the same instant
    if (err.code === 11000) {
      return res.status(409).json({ message: "Email already registered" });
    }
    throw err;
  }
}

export async function login(req, res) {
  const { email, password } = req.body;

  if (!isText(email) || !isText(password) || !email.trim() || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select(
    "+password"
  );

  // Always do exactly one bcrypt comparison, so a fast "no such user" answer
  // can't reveal which emails are registered
  let valid = false;
  if (user) {
    valid = await user.matchPassword(password);
  } else {
    await bcrypt.compare(password, DUMMY_HASH);
  }

  if (!valid) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  res.json({ token: signToken(user._id), user: userResponse(user) });
}

export async function getMe(req, res) {
  res.json({ user: userResponse(req.user) });
}