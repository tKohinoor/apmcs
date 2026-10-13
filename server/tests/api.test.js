import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { app, startDb, stopDb } from "./helpers.js";

// ---------- small helpers ----------
function call(method, url, token, body) {
  let req = request(app)[method](`/api/v1${url}`);
  if (token) req = req.set("Authorization", `Bearer ${token}`);
  if (body !== undefined) req = req.send(body);
  return req;
}

async function signUp(name, email) {
  const res = await call("post", "/auth/register", null, {
    name,
    email,
    password: "Secure123",
  });
  assert.equal(res.status, 201, `sign-up failed: ${JSON.stringify(res.body)}`);
  return { token: res.body.token, id: res.body.user.id };
}

// Shared state, filled in as the tests run in order
let owner, member, viewer, outsider;
let pid;
let epic, story1, story2, sprint1, sprint2, commentId;

const p = (path = "") => `/projects/${pid}${path}`;

before(startDb);
after(stopDb);

// ---------- authentication ----------
describe("Authentication", () => {
  it("rejects a password that is too short", async () => {
    const res = await call("post", "/auth/register", null, {
      name: "Weak",
      email: "weak@example.com",
      password: "abc123",
    });
    assert.equal(res.status, 400);
  });

  it("rejects a password without a number", async () => {
    const res = await call("post", "/auth/register", null, {
      name: "Weak",
      email: "weak@example.com",
      password: "abcdefghij",
    });
    assert.equal(res.status, 400);
  });

  it("registers four users", async () => {
    owner = await signUp("Owner", "owner@example.com");
    member = await signUp("Member", "member@example.com");
    viewer = await signUp("Viewer", "viewer@example.com");
    outsider = await signUp("Outsider", "outsider@example.com");
  });

  it("rejects a duplicate email", async () => {
    const res = await call("post", "/auth/register", null, {
      name: "Again",
      email: "owner@example.com",
      password: "Secure123",
    });
    assert.equal(res.status, 409);
  });

  it("rejects a wrong password", async () => {
    const res = await call("post", "/auth/login", null, {
      email: "owner@example.com",
      password: "Wrong12345",
    });
    assert.equal(res.status, 401);
  });

  it("logs in with the right password", async () => {
    const res = await call("post", "/auth/login", null, {
      email: "owner@example.com",
      password: "Secure123",
    });
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.token, "string");
  });

  it("rejects MongoDB operator injection", async () => {
    const res = await call("post", "/auth/login", null, {
      email: { $gt: "" },
      password: "anything",
    });
    assert.equal(res.status, 400);
  });

  it("protects /auth/me with a token", async () => {
    const without = await call("get", "/auth/me");
    assert.equal(without.status, 401);

    const withToken = await call("get", "/auth/me", owner.token);
    assert.equal(withToken.status, 200);
    assert.equal(withToken.body.user.email, "owner@example.com");
  });
});

// ---------- projects ----------
describe("Projects", () => {
  it("creates a project, uppercases the key, and makes the creator the owner", async () => {
    const res = await call("post", "/projects", owner.token, {
      name: "Library Management",
      key: "lib",
      description: "Test project",
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.project.key, "LIB");
    pid = res.body.project._id;
  });

  it("rejects an invalid key", async () => {
    const res = await call("post", "/projects", owner.token, { name: "Bad", key: "L1" });
    assert.equal(res.status, 400);
  });

  it("rejects a missing name", async () => {
    const res = await call("post", "/projects", owner.token, { key: "AB" });
    assert.equal(res.status, 400);
  });

  it("lists only my own projects", async () => {
    const mine = await call("get", "/projects", owner.token);
    assert.equal(mine.body.projects.length, 1);

    const theirs = await call("get", "/projects", outsider.token);
    assert.equal(theirs.body.projects.length, 0);
  });

  it("hides a project from non-members", async () => {
    const res = await call("get", p(), outsider.token);
    assert.equal(res.status, 404);
  });

  it("shows the project and my role to the owner", async () => {
    const res = await call("get", p(), owner.token);
    assert.equal(res.status, 200);
    assert.equal(res.body.myRole, "product_owner");
  });
});

// ---------- team ----------
describe("Team management", () => {
  it("lets the owner add a member and a viewer", async () => {
    let res = await call("post", p("/members"), owner.token, {
      email: "member@example.com",
      role: "member",
    });
    assert.equal(res.status, 201);

    res = await call("post", p("/members"), owner.token, {
      email: "viewer@example.com",
      role: "viewer",
    });
    assert.equal(res.status, 201);
  });

  it("rejects adding the same person twice", async () => {
    const res = await call("post", p("/members"), owner.token, {
      email: "member@example.com",
      role: "member",
    });
    assert.equal(res.status, 409);
  });

  it("rejects an unknown email", async () => {
    const res = await call("post", p("/members"), owner.token, {
      email: "nobody@example.com",
      role: "member",
    });
    assert.equal(res.status, 404);
  });

  it("does not allow adding someone as product_owner", async () => {
    const res = await call("post", p("/members"), owner.token, {
      email: "outsider@example.com",
      role: "product_owner",
    });
    assert.equal(res.status, 400);
  });

  it("stops a plain member from adding people", async () => {
    const res = await call("post", p("/members"), member.token, {
      email: "outsider@example.com",
      role: "viewer",
    });
    assert.equal(res.status, 403);
  });

  it("stops a plain member from changing roles", async () => {
    const res = await call("patch", p(`/members/${viewer.id}`), member.token, {
      role: "member",
    });
    assert.equal(res.status, 403);
  });

  it("protects the project owner's role", async () => {
    const res = await call("patch", p(`/members/${owner.id}`), owner.token, {
      role: "member",
    });
    assert.equal(res.status, 400);
  });

  it("shows three members on the project", async () => {
    const res = await call("get", p(), owner.token);
    assert.equal(res.body.project.members.length, 3);
  });
});

// ---------- work items ----------
describe("Work items", () => {
  it("creates an epic numbered 1", async () => {
    const res = await call("post", p("/items"), owner.token, {
      title: "User accounts",
      type: "epic",
      priority: "high",
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.item.number, 1);
    epic = res.body.item;
  });

  it("creates stories with an epic and an assignee, numbered in order", async () => {
    let res = await call("post", p("/items"), owner.token, {
      title: "Reset password",
      type: "story",
      storyPoints: 5,
      epic: epic._id,
      assignee: member.id,
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.item.number, 2);
    assert.equal(res.body.item.epic.title, "User accounts");
    story1 = res.body.item;

    res = await call("post", p("/items"), owner.token, {
      title: "Login page",
      type: "story",
      storyPoints: 3,
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.item.number, 3);
    story2 = res.body.item;
  });

  it("rejects an empty title", async () => {
    const res = await call("post", p("/items"), owner.token, { title: "  ", type: "task" });
    assert.equal(res.status, 400);
  });

  it("rejects an assignee who is not a project member", async () => {
    const res = await call("post", p("/items"), owner.token, {
      title: "Bad assignee",
      assignee: outsider.id,
    });
    assert.equal(res.status, 400);
  });

  // Known quirk: a rejected create still uses up an item number, leaving a gap
  it("rejects an unknown item type", async () => {
    const res = await call("post", p("/items"), owner.token, { title: "x", type: "banana" });
    assert.equal(res.status, 400);
  });

  it("rejects negative story points", async () => {
    const res = await call("post", p("/items"), owner.token, { title: "x", storyPoints: -1 });
    assert.equal(res.status, 400);
  });

  it("lets a viewer read items but not create them", async () => {
    const read = await call("get", p("/items"), viewer.token);
    assert.equal(read.status, 200);
    assert.ok(read.body.items.length >= 3);

    const write = await call("post", p("/items"), viewer.token, { title: "Not allowed" });
    assert.equal(write.status, 403);
  });

  it("lets a regular member create items", async () => {
    const res = await call("post", p("/items"), member.token, { title: "Member task", type: "task" });
    assert.equal(res.status, 201);
  });

  it("filters items by type", async () => {
    const res = await call("get", p("/items?type=epic"), owner.token);
    assert.equal(res.body.items.length, 1);
    assert.equal(res.body.items[0].type, "epic");
  });

  it("updates an item's status", async () => {
    const res = await call("patch", p(`/items/${story1._id}`), owner.token, {
      status: "in_progress",
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.item.status, "in_progress");
  });

  it("rejects an invalid status", async () => {
    const res = await call("patch", p(`/items/${story1._id}`), owner.token, {
      status: "banana",
    });
    assert.equal(res.status, 400);
  });

  it("returns 404 for an invalid item id", async () => {
    const res = await call("get", p("/items/abc"), owner.token);
    assert.equal(res.status, 404);
  });
});

// ---------- sprints ----------
describe("Sprints", () => {
  it("creates a planned sprint", async () => {
    const res = await call("post", p("/sprints"), owner.token, {
      name: "Sprint 1",
      goal: "Accounts",
      startDate: "2026-10-12",
      endDate: "2026-10-26",
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.sprint.state, "planned");
    sprint1 = res.body.sprint;
  });

  it("rejects an end date before the start date", async () => {
    const res = await call("post", p("/sprints"), owner.token, {
      name: "Backwards",
      startDate: "2026-10-26",
      endDate: "2026-10-12",
    });
    assert.equal(res.status, 400);
  });

  it("stops a plain member from creating sprints", async () => {
    const res = await call("post", p("/sprints"), member.token, {
      name: "Nope",
      startDate: "2026-11-01",
      endDate: "2026-11-14",
    });
    assert.equal(res.status, 403);
  });

  it("refuses to start an empty sprint", async () => {
    const res = await call("post", p(`/sprints/${sprint1._id}/start`), owner.token);
    assert.equal(res.status, 400);
    assert.match(res.body.message, /at least one item/);
  });

  it("refuses to put an epic into a sprint", async () => {
    const res = await call("patch", p(`/items/${epic._id}`), owner.token, {
      sprint: sprint1._id,
    });
    assert.equal(res.status, 400);
  });

  it("moves two stories into the sprint", async () => {
    for (const story of [story1, story2]) {
      const res = await call("patch", p(`/items/${story._id}`), owner.token, {
        sprint: sprint1._id,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.item.sprint, sprint1._id);
    }
  });

  it("reports item and point totals per sprint", async () => {
    const res = await call("get", p("/sprints"), owner.token);
    const s = res.body.sprints.find((x) => x._id === sprint1._id);
    assert.equal(s.stats.count, 2);
    assert.equal(s.stats.points, 8);
  });

  it("starts the sprint and records the committed points", async () => {
    const res = await call("post", p(`/sprints/${sprint1._id}/start`), owner.token);
    assert.equal(res.status, 200);
    assert.equal(res.body.sprint.state, "active");
    assert.equal(res.body.sprint.committedPoints, 8);
  });

  it("allows only one active sprint at a time", async () => {
    let res = await call("post", p("/sprints"), owner.token, {
      name: "Sprint 2",
      startDate: "2026-10-27",
      endDate: "2026-11-09",
    });
    assert.equal(res.status, 201);
    sprint2 = res.body.sprint;

    res = await call("post", p(`/sprints/${sprint2._id}/start`), owner.token);
    assert.equal(res.status, 409);
  });

  it("completes the sprint and counts only finished work", async () => {
    let res = await call("patch", p(`/items/${story1._id}`), owner.token, { status: "done" });
    assert.equal(res.status, 200);

    res = await call("post", p(`/sprints/${sprint1._id}/complete`), owner.token, {
      moveTo: "backlog",
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.sprint.state, "closed");
    assert.equal(res.body.sprint.completedPoints, 5);
    assert.equal(res.body.movedCount, 1);
  });

  it("returns unfinished work to the backlog and keeps finished work in the sprint", async () => {
    const backlog = await call("get", p("/items?sprint=backlog"), owner.token);
    const ids = backlog.body.items.map((i) => i._id);
    assert.ok(ids.includes(story2._id), "unfinished story should be back in the backlog");
    assert.ok(!ids.includes(story1._id), "finished story should stay in the closed sprint");

    const finished = await call("get", p(`/items/${story1._id}`), owner.token);
    assert.equal(finished.body.item.sprint.state, "closed");
  });

  it("does not let a finished item leave a closed sprint", async () => {
    const res = await call("patch", p(`/items/${story1._id}`), owner.token, { sprint: null });
    assert.equal(res.status, 400);
  });

  it("deletes a planned sprint", async () => {
    const res = await call("delete", p(`/sprints/${sprint2._id}`), owner.token);
    assert.equal(res.status, 200);
  });
});

// ---------- comments ----------
describe("Comments", () => {
  it("lets the owner post a comment", async () => {
    const res = await call("post", p(`/items/${story1._id}/comments`), owner.token, {
      body: "Looks good",
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.comment.author.name, "Owner");
    commentId = res.body.comment._id;
  });

  it("rejects an empty comment", async () => {
    const res = await call("post", p(`/items/${story1._id}/comments`), owner.token, { body: "   " });
    assert.equal(res.status, 400);
  });

  it("stops a viewer from commenting", async () => {
    const res = await call("post", p(`/items/${story1._id}/comments`), viewer.token, { body: "Hi" });
    assert.equal(res.status, 403);
  });

  it("stops a member from deleting someone else's comment", async () => {
    const res = await call("delete", p(`/items/${story1._id}/comments/${commentId}`), member.token);
    assert.equal(res.status, 403);
  });

  it("lets the author delete their comment", async () => {
    const res = await call("delete", p(`/items/${story1._id}/comments/${commentId}`), owner.token);
    assert.equal(res.status, 200);
  });
});

// ---------- reports ----------
describe("Reports", () => {
  it("shows velocity for the completed sprint", async () => {
    const res = await call("get", p("/reports/velocity"), owner.token);
    assert.equal(res.status, 200);
    assert.equal(res.body.rows.length, 1);
    assert.equal(res.body.rows[0].completed, 5);
    assert.equal(res.body.average, 5);
  });

  it("builds a burndown with an ideal line from committed points down to zero", async () => {
    const res = await call("get", p("/reports/burndown"), owner.token);
    assert.equal(res.status, 200);
    assert.equal(res.body.sprint.name, "Sprint 1");
    assert.equal(res.body.sprint.state, "closed");
    assert.equal(res.body.rows.length, 15);
    assert.equal(res.body.rows[0].ideal, 8);
    assert.equal(res.body.rows[14].ideal, 0);
  });

  it("shows an empty workload when no sprint is active", async () => {
    const res = await call("get", p("/reports/workload"), owner.token);
    assert.equal(res.body.sprint, null);
    assert.deepEqual(res.body.rows, []);
  });

  it("hides reports from non-members", async () => {
    const res = await call("get", p("/reports/velocity"), outsider.token);
    assert.equal(res.status, 404);
  });
});

// ---------- notifications and activity ----------
describe("Notifications and activity", () => {
  it("notifies the person an item was assigned to", async () => {
    const res = await call("get", "/notifications", member.token);
    assert.equal(res.status, 200);
    assert.ok(res.body.notifications.some((n) => n.type === "assigned"));
    assert.ok(res.body.unreadCount > 0);
  });

  it("does not notify people about their own actions", async () => {
    const res = await call("get", "/notifications", owner.token);
    assert.ok(!res.body.notifications.some((n) => n.type === "assigned"));
  });

  it("sends nothing to people outside the project", async () => {
    const res = await call("get", "/notifications", outsider.token);
    assert.equal(res.body.notifications.length, 0);
  });

  it("marks one notification as read", async () => {
    const before = await call("get", "/notifications", member.token);
    const unread = before.body.notifications.find((n) => !n.read);

    const res = await call("patch", `/notifications/${unread._id}/read`, member.token);
    assert.equal(res.status, 200);

    const after = await call("get", "/notifications", member.token);
    assert.equal(after.body.unreadCount, before.body.unreadCount - 1);
  });

  it("does not let one user read another user's notification", async () => {
    const list = await call("get", "/notifications", member.token);
    const res = await call("patch", `/notifications/${list.body.notifications[0]._id}/read`, outsider.token);
    assert.equal(res.status, 404);
  });

  it("marks everything as read", async () => {
    const res = await call("post", "/notifications/read-all", member.token);
    assert.equal(res.status, 200);

    const list = await call("get", "/notifications", member.token);
    assert.equal(list.body.unreadCount, 0);
  });

  it("records project activity", async () => {
    const res = await call("get", p("/activity?limit=100"), viewer.token);
    assert.equal(res.status, 200);
    assert.ok(res.body.activity.some((a) => a.text.includes('completed sprint "Sprint 1"')));
  });

  it("hides the activity feed from non-members", async () => {
    const res = await call("get", p("/activity"), outsider.token);
    assert.equal(res.status, 404);
  });
});

// ---------- security and error handling ----------
describe("Security and error handling", () => {
  it("answers unknown API routes with JSON", async () => {
    const res = await call("get", "/nothing");
    assert.equal(res.status, 404);
    assert.equal(res.body.message, "Route not found");
  });

  it("rejects malformed JSON", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .send("{bad json");
    assert.equal(res.status, 400);
    assert.equal(res.body.message, "Invalid JSON in request body");
  });

  it("rejects oversized request bodies", async () => {
    const res = await call("post", "/auth/login", null, {
      email: "a".repeat(200000),
      password: "x",
    });
    assert.equal(res.status, 413);
  });

  it("gives the same answer for an unknown email and a wrong password", async () => {
    const unknown = await call("post", "/auth/login", null, {
      email: "ghost@example.com",
      password: "Secure123",
    });
    const wrong = await call("post", "/auth/login", null, {
      email: "owner@example.com",
      password: "Wrong12345",
    });
    assert.equal(unknown.status, 401);
    assert.equal(unknown.body.message, wrong.body.message);
  });

  it("treats an invalid project id as not found", async () => {
    const res = await call("get", "/projects/not-an-id", owner.token);
    assert.equal(res.status, 404);
  });

  it("requires login on project routes", async () => {
    const res = await call("get", "/projects");
    assert.equal(res.status, 401);
  });
});