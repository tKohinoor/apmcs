// Loads a realistic demo project, or removes it again.
//
//   node --env-file=.env scripts/seedDemo.js                  shows what it would do (changes nothing)
//   node --env-file=.env scripts/seedDemo.js --yes            creates the demo data
//   node --env-file=.env scripts/seedDemo.js --reset --yes    deletes the old demo data, then recreates it
//   node --env-file=.env scripts/seedDemo.js --remove --yes   deletes the demo data
//   add --add=you@example.com to also add your own (already registered) account to the project
//
// Set DEMO_PASSWORD to choose the password for the demo accounts (8+ characters).

import crypto from "node:crypto";
import mongoose from "mongoose";
import User from "../src/models/User.js";
import Project from "../src/models/Project.js";
import Sprint from "../src/models/Sprint.js";
import WorkItem from "../src/models/WorkItem.js";
import Comment from "../src/models/Comment.js";
import Activity from "../src/models/Activity.js";
import Notification from "../src/models/Notification.js";
import SprintSnapshot from "../src/models/SprintSnapshot.js";
import { dayKey } from "../src/utils/snapshots.js";

const args = process.argv.slice(2);
const confirmed = args.includes("--yes");
const removeOnly = args.includes("--remove");
const reset = args.includes("--reset");
const addArg = args.find((a) => a.startsWith("--add="));
const addEmail = addArg ? addArg.slice("--add=".length).trim().toLowerCase() : null;

const DAY = 86400000;
const SPRINT_DAYS = 14;
const DEMO_EMAIL = /@demo\.apmcs\.test$/;
const PROJECT = {
  name: "Campus Event Portal",
  key: "CEP",
  description:
    "Web portal where students find campus events, register and get tickets. Built by a five-person team in two-week sprints.",
};

// ---------- time helpers (all relative to today, so the data never looks stale) ----------
const todayMs = Date.parse(`${dayKey()}T00:00:00Z`);
const NOW = Date.now();
const at = (offset, hour = 6) =>
  new Date(Math.min(todayMs + offset * DAY + hour * 3600000, NOW - 60000));
const dateOnly = (offset) => new Date(todayMs + offset * DAY);
const keyOf = (offset) => dateOnly(offset).toISOString().slice(0, 10);
const label = (text) => text.replace("_", " ");

// ---------- the story we are telling ----------
const PEOPLE = {
  aarav: { name: "Aarav Sharma", role: "product_owner" },
  priya: { name: "Priya Nair", role: "scrum_master" },
  rohan: { name: "Rohan Mehta", role: "member" },
  sneha: { name: "Sneha Iyer", role: "member" },
  kabir: { name: "Kabir Singh", role: "viewer" },
};

// start = days from today (negative means in the past). Each sprint lasts 14 days.
const SPRINTS = {
  S1: { name: "Sprint 1", goal: "Project foundations: setup, schema and wireframes", start: -49, state: "closed" },
  S2: { name: "Sprint 2", goal: "Landing page, sample data and mobile layout", start: -35, state: "closed" },
  S3: { name: "Sprint 3", goal: "Accounts and event creation", start: -21, state: "closed" },
  S4: { name: "Sprint 4", goal: "Event registration and organizer tools", start: -7, state: "active" },
  S5: { name: "Sprint 5", goal: "Waitlists, exports and performance", start: 7, state: "planned" },
};
const d = (sprint, dayIndex) => SPRINTS[sprint].start + dayIndex; // a day inside a sprint
const flow = (sprint, from, to) => [
  [d(sprint, from), "in_progress"],
  [d(sprint, to), "done"],
];

// Items are numbered in this order (CEP-1, CEP-2, ...).
// sprint = where it ended up. from = a sprint it left unfinished. join = day it was added to the sprint.
// moves = [day offset, new status] pairs. Final status is the last move, unless "status" is set.
const ITEMS = [
  { key: "E1", type: "epic", title: "User accounts & roles", prio: "high", status: "in_progress", created: -50 },
  { key: "E2", type: "epic", title: "Event management", prio: "high", status: "in_progress", created: -50 },
  { key: "E3", type: "epic", title: "Registration & tickets", prio: "high", status: "todo", created: -50 },
  { key: "E4", type: "epic", title: "Notifications & analytics", prio: "medium", status: "todo", created: -50 },

  { key: "setup", type: "task", title: "Set up repository and project structure", pts: 3, prio: "high", who: "priya", sprint: "S1", created: -50, moves: flow("S1", 1, 3) },
  { key: "plan", type: "task", title: "Choose tech stack and write project plan", pts: 3, prio: "high", who: "aarav", sprint: "S1", created: -50, moves: flow("S1", 0, 2) },
  { key: "schema", type: "task", title: "Design the database schema", pts: 5, prio: "high", who: "sneha", sprint: "S1", created: -50, moves: flow("S1", 2, 5) },
  { key: "wire", type: "task", title: "Wireframes for the main screens", pts: 5, prio: "medium", who: "rohan", sprint: "S1", created: -50, moves: flow("S1", 3, 7) },
  { key: "errors", type: "task", title: "Basic API error handling", pts: 4, prio: "medium", who: "rohan", from: "S1", sprint: "S2", created: -50, moves: [[d("S1", 9), "in_progress"], [d("S2", 9), "done"]] },

  { key: "landing", type: "story", title: "Landing page and navigation", pts: 5, prio: "medium", who: "sneha", sprint: "S2", created: -36, moves: flow("S2", 1, 5) },
  { key: "seed", type: "task", title: "Sample events and seed data", pts: 3, prio: "low", who: "rohan", sprint: "S2", created: -36, moves: flow("S2", 1, 4) },
  { key: "validate", type: "task", title: "Form validation helpers", pts: 2, prio: "medium", who: "priya", sprint: "S2", created: -36, moves: flow("S2", 1, 3) },
  { key: "mobile", type: "story", title: "Responsive layout for mobile", pts: 5, prio: "medium", who: "sneha", sprint: "S2", created: -36, moves: flow("S2", 4, 10) },
  { key: "profile", type: "story", title: "User profile page", pts: 5, prio: "low", who: "rohan", from: "S2", sprint: null, status: "todo", created: -36 },

  { key: "signup", type: "story", title: "Sign up and log in with email", epic: "E1", pts: 5, prio: "high", who: "rohan", sprint: "S3", created: -22, moves: flow("S3", 1, 6) },
  { key: "rbac", type: "story", title: "Role-based access for organizers", epic: "E1", pts: 5, prio: "high", who: "rohan", sprint: "S3", created: -22, moves: flow("S3", 5, 9) },
  { key: "models", type: "task", title: "Event and ticket models in the API", epic: "E2", pts: 3, prio: "high", who: "sneha", sprint: "S3", created: -22, moves: flow("S3", 1, 5) },
  { key: "create", type: "story", title: "Create and edit events", epic: "E2", pts: 8, prio: "high", who: "sneha", sprint: "S3", created: -22, moves: flow("S3", 6, 11),
    desc: "Organizers can create an event with a title, date, time and location, and edit it later. Image upload is out of scope for now." },
  { key: "ci", type: "task", title: "Configure CI pipeline", pts: 2, prio: "medium", who: "priya", sprint: "S3", created: -22, moves: flow("S3", 1, 2) },
  { key: "list", type: "story", title: "Event list page with filters", epic: "E2", pts: 4, prio: "medium", who: "rohan", from: "S3", sprint: "S4", created: -22, moves: [[d("S3", 10), "in_progress"]],
    desc: "List upcoming events with filters for date and category. Search can wait for a later sprint." },
  { key: "loginbug", type: "bug", title: "Login button unresponsive on mobile", epic: "E1", pts: 3, prio: "high", who: "priya", by: "priya", sprint: "S3", join: 3, created: d("S3", 3), moves: flow("S3", 7, 8) },

  { key: "register", type: "story", title: "Register for an event", epic: "E3", pts: 5, prio: "high", who: "sneha", sprint: "S4", created: -8, moves: flow("S4", 1, 4),
    desc: "As an attendee I can register for an event with my name and email and see a confirmation page. Duplicate registrations are blocked, and full events show a clear message." },
  { key: "email", type: "story", title: "Email ticket confirmation", epic: "E3", pts: 3, prio: "medium", who: "rohan", sprint: "S4", created: -8, moves: [[d("S4", 5), "in_progress"], [d("S4", 7), "in_review"]],
    desc: "Send a confirmation email with the event details after registration." },
  { key: "dash", type: "story", title: "Organizer dashboard with attendee count", epic: "E2", pts: 5, prio: "medium", who: "priya", sprint: "S4", created: -8, moves: flow("S4", 2, 7),
    desc: "Show each organizer how many people have registered for each event." },
  { key: "docs", type: "task", title: "Write API documentation with Swagger", pts: 2, prio: "low", who: "sneha", sprint: "S4", created: -8, moves: flow("S4", 5, 6) },
  { key: "tz", type: "bug", title: "Event date shows wrong time zone", epic: "E2", pts: 3, prio: "critical", who: "rohan", sprint: "S4", created: -8, moves: flow("S4", 0, 2),
    desc: "Organizers in other time zones see the wrong start time. Store dates in UTC and convert them on display." },
  { key: "qr", type: "story", title: "QR code check-in", epic: "E3", pts: 5, prio: "medium", who: "sneha", sprint: "S4", created: -8, status: "todo",
    desc: "Generate a QR code per ticket and scan it at the door. Open question: does check-in need to work offline?" },

  { key: "remind", type: "story", title: "Event reminders 24 hours before", epic: "E4", pts: 5, prio: "medium", sprint: null, created: -7 },
  { key: "charts", type: "story", title: "Organizer analytics: attendance charts", epic: "E4", pts: 8, prio: "medium", sprint: null, created: -7 },
  { key: "dark", type: "story", title: "Dark mode", pts: 3, prio: "low", sprint: null, created: -6 },
  { key: "typo", type: "bug", title: "Typo on the registration confirmation page", epic: "E3", pts: 1, prio: "low", by: "priya", sprint: null, created: -6 },
  { key: "share", type: "story", title: "Share events on social media", epic: "E2", pts: 5, prio: "low", sprint: null, created: -6 },
  { key: "a11y", type: "task", title: "Accessibility review of the main pages", pts: 3, prio: "medium", who: "priya", sprint: null, created: -5 },

  { key: "waitlist", type: "story", title: "Waitlist when an event is full", epic: "E3", pts: 5, prio: "medium", who: "rohan", sprint: "S5", created: -4 },
  { key: "csv", type: "story", title: "Export attendee list as CSV", epic: "E2", pts: 3, prio: "low", sprint: "S5", created: -4 },
  { key: "load", type: "task", title: "Load testing with 500 users", pts: 3, prio: "medium", who: "sneha", sprint: "S5", created: -4 },
];

// Number the items and work out their final status
const num = {};
ITEMS.forEach((it, i) => {
  it.number = i + 1;
  num[it.key] = it.number;
  if (!it.status) it.status = it.moves?.length ? it.moves[it.moves.length - 1][1] : "todo";
});
const ref = (key) => `${PROJECT.key}-${num[key]}`;

// Points committed, points completed and the day-by-day numbers behind each burndown chart
const sum = (list) => list.reduce((total, it) => total + (it.pts || 0), 0);
const doneOffset = (it) => (it.moves || []).find(([, s]) => s === "done")?.[0] ?? null;

function sprintView(key) {
  const sprint = SPRINTS[key];
  const members = ITEMS.filter((it) => it.sprint === key || it.from === key);
  const joinDay = (it) => (it.sprint === key ? (it.join ?? 0) : 0);
  const doneDay = (it) => {
    if (it.sprint !== key) return null; // it left this sprint unfinished
    const offset = doneOffset(it);
    return offset === null ? null : offset - sprint.start;
  };

  const committed = sum(members.filter((it) => joinDay(it) === 0));
  const completed = sum(members.filter((it) => doneDay(it) !== null));

  const days = [];
  if (sprint.state !== "planned") {
    const lastDay = sprint.state === "closed" ? SPRINT_DAYS - 1 : Math.min(SPRINT_DAYS - 1, 0 - sprint.start);
    for (let i = 0; i <= lastDay; i++) {
      const total = sum(members.filter((it) => joinDay(it) <= i));
      const finished = sum(members.filter((it) => doneDay(it) !== null && doneDay(it) <= i));
      days.push({ index: i, total, finished, remaining: total - finished });
    }
  }
  return { committed, completed, days };
}

// ---------- database helpers ----------
// Builds a document with the real model (so it is validated), with a chosen creation date
async function makeDoc(Model, fields, createdAt, updatedAt = createdAt) {
  const doc = new Model(fields);
  await doc.validate();
  return { ...doc.toObject(), createdAt, updatedAt, __v: 0 };
}

// Inserts rows oldest first, so the feeds (which sort by id) show the right order
async function insertTimed(Model, specs) {
  const sorted = [...specs].sort((a, b) => a.at - b.at);
  const rows = [];
  for (const spec of sorted) rows.push(await makeDoc(Model, spec.fields, spec.at));
  if (rows.length) await Model.collection.insertMany(rows);
  return rows.length;
}

async function removeDemo() {
  const users = await User.find({ email: DEMO_EMAIL }).select("_id");
  const userIds = users.map((u) => u._id);
  const projects = await Project.find({ owner: { $in: userIds } }).select("_id");
  const projectIds = projects.map((p) => p._id);
  const inProjects = { project: { $in: projectIds } };

  await Promise.all([
    WorkItem.deleteMany(inProjects),
    Sprint.deleteMany(inProjects),
    Comment.deleteMany(inProjects),
    SprintSnapshot.deleteMany(inProjects),
    Activity.deleteMany(inProjects),
    Notification.deleteMany({ $or: [{ user: { $in: userIds } }, inProjects] }),
  ]);
  await Project.deleteMany({ _id: { $in: projectIds } });
  await User.deleteMany({ _id: { $in: userIds } });

  console.log(`Removed ${userIds.length} demo user(s) and ${projectIds.length} demo project(s).`);
}

async function seed() {
  const password = process.env.DEMO_PASSWORD || `Demo${crypto.randomBytes(4).toString("hex")}`;
  if (password.length < 8) throw new Error("DEMO_PASSWORD must be at least 8 characters.");

  // Users (created normally, so their passwords are hashed)
  const users = {};
  for (const [key, person] of Object.entries(PEOPLE)) {
    users[key] = await User.create({
      name: person.name,
      email: `${key}@demo.apmcs.test`,
      password,
    });
  }
  const uid = (key) => users[key]._id;

  // Project
  const projectId = new mongoose.Types.ObjectId();
  const projectRow = await makeDoc(
    Project,
    {
      _id: projectId,
      name: PROJECT.name,
      key: PROJECT.key,
      description: PROJECT.description,
      owner: uid("aarav"),
      members: Object.entries(PEOPLE).map(([key, p]) => ({ user: uid(key), role: p.role })),
      itemCounter: ITEMS.length,
    },
    at(-50, 3)
  );
  await Project.collection.insertOne(projectRow);

  // Sprints
  const sprintRows = {};
  const views = {};
  for (const [key, sprint] of Object.entries(SPRINTS)) {
    views[key] = sprintView(key);
    sprintRows[key] = await makeDoc(
      Sprint,
      {
        project: projectId,
        name: sprint.name,
        goal: sprint.goal,
        startDate: dateOnly(sprint.start),
        endDate: dateOnly(sprint.start + SPRINT_DAYS - 1),
        state: sprint.state,
        startedAt: sprint.state === "planned" ? null : at(sprint.start, 5),
        completedAt: sprint.state === "closed" ? at(sprint.start + SPRINT_DAYS - 1, 12) : null,
        committedPoints: sprint.state === "planned" ? 0 : views[key].committed,
        completedPoints: sprint.state === "closed" ? views[key].completed : 0,
      },
      at(Math.min(sprint.start - 1, -4), 7)
    );
  }
  await Sprint.collection.insertMany(Object.values(sprintRows));

  // Work items
  const itemRows = {};
  const itemDocs = [];
  for (const [index, it] of ITEMS.entries()) {
    const lastChange = it.moves?.length ? at(it.moves[it.moves.length - 1][0], 9) : null;
    const row = await makeDoc(
      WorkItem,
      {
        project: projectId,
        number: it.number,
        type: it.type,
        title: it.title,
        description: it.desc || "",
        status: it.status,
        priority: it.prio,
        storyPoints: it.pts ?? null,
        assignee: it.who ? uid(it.who) : null,
        reporter: uid(it.by || "aarav"),
        epic: it.epic ? itemRows[it.epic]._id : null,
        sprint: it.sprint ? sprintRows[it.sprint]._id : null,
        rank: it.number,
      },
      at(it.created, 4 + index * 0.05),
      lastChange || at(it.created, 4 + index * 0.05)
    );
    itemRows[it.key] = row;
    itemDocs.push(row);
  }
  await WorkItem.collection.insertMany(itemDocs);

  // Burndown history
  const snapshots = [];
  for (const [key, view] of Object.entries(views)) {
    for (const day of view.days) {
      snapshots.push({
        at: at(SPRINTS[key].start + day.index, 13),
        fields: {
          project: projectId,
          sprint: sprintRows[key]._id,
          day: keyOf(SPRINTS[key].start + day.index),
          totalPoints: day.total,
          completedPoints: day.finished,
          remainingPoints: day.remaining,
        },
      });
    }
  }
  const snapshotCount = await insertTimed(SprintSnapshot, snapshots);

  // Activity feed
  const events = [];
  const log = (when, actor, text, item = null) =>
    events.push({ at: when, fields: { project: projectId, actor: uid(actor), item, text } });

  Object.entries(PEOPLE)
    .filter(([key]) => key !== "aarav")
    .forEach(([key, p], i) => log(at(-50, 3 + i * 0.1), "aarav", `added ${p.name} as ${label(p.role)}`));

  for (const [key, sprint] of Object.entries(SPRINTS)) {
    log(at(Math.min(sprint.start - 1, -4), 7), "priya", `created sprint "${sprint.name}"`);
    if (sprint.state !== "planned") log(at(sprint.start, 5), "priya", `started sprint "${sprint.name}"`);
    if (sprint.state === "closed") {
      log(
        at(sprint.start + SPRINT_DAYS - 1, 12),
        "priya",
        `completed sprint "${sprint.name}" (${views[key].completed} of ${views[key].committed} pts)`
      );
    }
  }

  ITEMS.forEach((it, index) => {
    const row = itemRows[it.key];
    log(at(it.created, 4 + index * 0.05), it.by || "aarav", `created ${it.type} ${ref(it.key)}: ${it.title}`, row._id);
    for (const [offset, status, actor] of it.moves || []) {
      log(at(offset, 6 + (it.number % 5)), actor || it.who || "aarav", `moved ${ref(it.key)} to ${label(status)}`, row._id);
    }
  });

  // Comments (each one also appears in the activity feed)
  const commentSpecs = [
    [d("S3", 8), 7, "priya", "create", "Do we need image upload in the first version?"],
    [d("S3", 8), 8, "aarav", "create", "Not for now. Keep it to text, date and location. Image upload goes to the backlog."],
    [d("S4", 1), 6, "aarav", "tz", "Raising this to critical. Organizers in other time zones are seeing wrong start times."],
    [d("S4", 2), 9, "rohan", "tz", "Fixed by storing dates in UTC and converting on display. Added a test for it."],
    [d("S4", 3), 7, "priya", "list", "Can we limit the filters to date and category for this sprint? The rest can wait."],
    [d("S4", 3), 8, "rohan", "list", "Agreed. I will open a separate story for search."],
    [d("S4", 6), 9, "aarav", "qr", "Let's decide whether check-in needs to work offline before we start."],
    [d("S4", 7), 7, "sneha", "email", "Template looks good. Please check how it renders in Gmail on mobile."],
    [d("S4", 7), 8, "rohan", "email", "Will do before I move this to done."],
  ];
  const comments = commentSpecs.map(([offset, hour, who, itemKey, body]) => {
    log(at(offset, hour), who, `commented on ${ref(itemKey)}`, itemRows[itemKey]._id);
    return {
      at: at(offset, hour),
      fields: { project: projectId, item: itemRows[itemKey]._id, author: uid(who), body },
    };
  });
  const commentCount = await insertTimed(Comment, comments);
  const activityCount = await insertTimed(Activity, events);

  // Notifications (Aarav has unread ones, so the bell shows a badge)
  const notify = (offset, hour, user, actor, type, itemKey, message, read) => ({
    at: at(offset, hour),
    fields: { user: uid(user), project: projectId, item: itemRows[itemKey]._id, actor: uid(actor), type, message, read },
  });
  const notifications = [
    notify(-22, 5, "rohan", "aarav", "assigned", "list", `Aarav Sharma assigned you ${ref("list")}: Event list page with filters`, true),
    notify(-8, 5, "sneha", "aarav", "assigned", "qr", `Aarav Sharma assigned you ${ref("qr")}: QR code check-in`, false),
    notify(d("S4", 2), 9, "aarav", "rohan", "comment", "tz", `Rohan Mehta commented on ${ref("tz")}: Event date shows wrong time zone`, true),
    notify(d("S4", 3), 7, "rohan", "priya", "comment", "list", `Priya Nair commented on ${ref("list")}: Event list page with filters`, false),
    notify(d("S4", 7), 8, "aarav", "priya", "status", "dash", `Priya Nair moved ${ref("dash")} to done: Organizer dashboard with attendee count`, false),
    notify(d("S4", 7), 9, "aarav", "rohan", "status", "email", `Rohan Mehta moved ${ref("email")} to in review: Email ticket confirmation`, false),
  ];
  const notificationCount = await insertTimed(Notification, notifications);

  // Optionally add the presenter's own account as a second product owner
  let addedNote = "";
  if (addEmail) {
    if (DEMO_EMAIL.test(addEmail)) {
      addedNote = "The --add account is already a demo account, so it was skipped.";
    } else {
      const real = await User.findOne({ email: addEmail });
      if (!real) {
        addedNote = `No registered user with email ${addEmail}, so nobody was added. Register first, then run with --reset --yes --add=...`;
      } else {
        await Project.updateOne(
          { _id: projectId },
          { $push: { members: { user: real._id, role: "product_owner" } } }
        );
        addedNote = `Added ${real.name} (${addEmail}) to the project as a product owner.`;
      }
    }
  }

  console.log("\nDemo data created.");
  console.log(
    `  ${ITEMS.length} items, ${Object.keys(SPRINTS).length} sprints, ${snapshotCount} burndown points, ` +
      `${commentCount} comments, ${activityCount} activity lines, ${notificationCount} notifications`
  );
  console.log("\nLog in with any of these accounts:");
  for (const [key, p] of Object.entries(PEOPLE)) {
    console.log(`  ${key}@demo.apmcs.test  (${label(p.role)})`);
  }
  console.log(`\nPassword for all of them: ${password}`);
  console.log("Write it down now. It is not stored anywhere.");
  if (addedNote) console.log(`\n${addedNote}`);
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set. Run from the server folder with --env-file=.env");
    process.exitCode = 1;
    return;
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Target: ${mongoose.connection.host}, database "${mongoose.connection.name}"`);

  if (!confirmed) {
    console.log("\nDry run: nothing was changed.");
    if (removeOnly) {
      console.log("With --yes this would delete every @demo.apmcs.test user and the projects they own.");
    } else {
      console.log(`With --yes this would create ${Object.keys(PEOPLE).length} demo users and the "${PROJECT.name}" project.`);
      console.log("Add --reset to replace demo data that already exists.");
    }
    return;
  }

  if (removeOnly) {
    await removeDemo();
    return;
  }

  const existing = await User.countDocuments({ email: DEMO_EMAIL });
  if (existing > 0) {
    if (!reset) {
      console.error("Demo data already exists. Run again with --reset --yes to replace it.");
      process.exitCode = 1;
      return;
    }
    await removeDemo();
  }

  await seed();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());