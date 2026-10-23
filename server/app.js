import { databaseFailure } from "./database-error.js";
import { DatabaseRateLimitStore } from "./rate-limit-store.js";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import QRCode from "qrcode";
import { randomBytes } from "node:crypto";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import {
  id,
  now,
  passwordHash,
  passwordMatches,
  hashToken,
  publicUser,
} from "./store.js";
const categories = [
  "Graphic design",
  "Web development",
  "Social media",
  "Writing",
  "Small-business support",
];
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
function fail(status, message) {
  throw new HttpError(status, message);
}
function text(value, label, min = 1, max = 2000) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  )
    fail(400, `${label} must be ${min}–${max} characters.`);
  return value.trim();
}
function passwordInput(value, min = 1) {
  if (typeof value !== "string" || value.length < min || value.length > 128)
    fail(400, `Password must be ${min}–128 characters.`);
  return value;
}
function link(value) {
  if (value === undefined || value === "") return "";
  const input = text(value, "Work link", 1, 1000);
  let url;
  try {
    url = new URL(input);
  } catch {
    fail(400, "Use a full https:// or http:// work link.");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    fail(
      400,
      "Use a public http:// or https:// work link without login details.",
    );
  return url.href;
}
function skills(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 12)
    fail(400, "Add between 1 and 12 skills.");
  return [...new Set(value.map((s) => text(s, "Each skill", 2, 50)))];
}
function email(value) {
  const result = text(value, "Email", 5, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result))
    fail(400, "Enter a valid email address.");
  return result;
}
function consent(value) {
  if (typeof value !== "boolean")
    fail(400, "Choose whether to make this information public.");
  return value ? 1 : 0;
}
const decodeTask = (t) => ({
  ...t,
  skills: JSON.parse(t.skills),
  isDemo: t.id.startsWith("demo-"),
});
const decodeEvidence = (e) => ({
  ...e,
  skills: JSON.parse(e.skills),
  publicConsent: !!e.public_consent,
});
export function createApp(
  store,
  {
    production = false,
    baseUrl = "",
    serveStatic = true,
    enableLimits = true,
  } = {},
) {
  const app = express();
  for (const method of ["post", "put", "delete", "patch"]) {
    const register = app[method].bind(app);
    app[method] = (path, ...handlers) => {
      const handler = handlers.pop();
      return register(path, ...handlers, async (req, res, next) => {
        const sendJson = res.json;
        let payload;
        res.json = function (body) {
          payload = body;
          return this;
        };
        try {
          await store.transaction(() => handler(req, res, next));
          res.json = sendJson;
          return res.json(payload);
        } catch (error) {
          res.json = sendJson;
          next(error);
        }
      });
    };
  }

  app.disable("x-powered-by");
  if (production) app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: production ? [] : null,
        },
      },
      strictTransportSecurity: production ? undefined : false,
    }),
  );
  app.use(
    express.json({
      limit: "48kb",
    }),
  );
  app.use((req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.body !== undefined &&
      (req.body === null ||
        typeof req.body !== "object" ||
        Array.isArray(req.body))
    )
      return res.status(400).json({
        error: "Send a JSON object.",
      });
    if (req.body === undefined) req.body = {};
    next();
  });
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  if (enableLimits)
    app.use(
      "/api",
      rateLimit({
        windowMs: 60000,
        store: new DatabaseRateLimitStore(store, "api"),
        limit: 240,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: {
          error: "Too many requests. Please wait a minute.",
        },
      }),
    );
  app.use((req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.get("origin");
      const expected = baseUrl
        ? new URL(baseUrl).origin
        : `${req.protocol}://${req.get("host")}`;
      if (!origin || origin !== expected)
        return res.status(403).json({
          error:
            "Request origin is not allowed. Refresh the app and try again.",
        });
    }
    next();
  });
  app.use(async (req, _res, next) => {
    let token;
    try {
      token = decodeURIComponent(
        (req.headers.cookie || "")
          .split(";")
          .map((s) => s.trim())
          .find((s) => s.startsWith("sb_session="))
          ?.slice(11) || "",
      );
    } catch {}
    if (token) {
      req.sessionHash = hashToken(token);
      req.user = await store.get(
        "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?",
        req.sessionHash,
        now(),
      );
    }
    next();
  });
  const signed = (req, _res, next) =>
    req.user ? next() : next(new HttpError(401, "Please sign in to continue."));
  const role = (expected) => (req, _res, next) =>
    req.user?.role === expected
      ? next()
      : next(new HttpError(403, `This action needs a ${expected} account.`));
  const ownEvidence = async (req, evidenceId) => {
    const e = await store.get(
      "SELECT * FROM evidence WHERE id=? AND talent_id=?",
      evidenceId,
      req.user.id,
    );
    if (!e) fail(404, "Evidence not found.");
    return e;
  };
  const taskOwned = async (req, taskId) => {
    const t = await store.get(
      "SELECT * FROM tasks WHERE id=? AND business_id=?",
      taskId,
      req.user.id,
    );
    if (!t) fail(404, "Task not found.");
    return t;
  };
  const snapshot = async (eid) =>
    await store.run(
      "INSERT INTO evidence_versions(evidence_id,revision,title,organisation,description,skills,work_url,period,created_at) SELECT id,revision,title,organisation,description,skills,work_url,period,updated_at FROM evidence WHERE id=?",
      eid,
    );
  const event = async (applicationId, actor, action, detail = "") =>
    await store.run(
      "INSERT INTO events(id,application_id,actor_id,action,detail,created_at) VALUES(?,?,?,?,?,?)",
      id(),
      applicationId,
      actor,
      action,
      detail,
      now(),
    );
  async function startSession(res, user) {
    await store.run("DELETE FROM sessions WHERE expires_at<=?", now());
    const token = randomBytes(32).toString("hex");
    await store.run(
      "INSERT INTO sessions VALUES(?,?,?)",
      hashToken(token),
      user.id,
      new Date(Date.now() + 7 * 86400000).toISOString(),
    );
    res.cookie("sb_session", token, {
      httpOnly: true,
      secure: production,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 86400000,
    });
  }
  const authLimit = enableLimits
    ? rateLimit({
        windowMs: 15 * 60000,
        store: new DatabaseRateLimitStore(store, "auth"),
        limit: 40,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: {
          error: "Too many sign-in attempts. Try again in 15 minutes.",
        },
      })
    : (_req, _res, next) => next();
  app.get("/api/health", async (_req, res) => {
    await store.get("SELECT id FROM users LIMIT 1");
    res.json({
      status: "ok",
      storage: store.kind,
      time: now(),
    });
  });
  app.get("/api/me", (req, res) =>
    res.json({
      user: publicUser(req.user),
    }),
  );
  app.post("/api/auth/register", authLimit, async (req, res) => {
    const data = req.body;
    const mail = email(data.email),
      name = text(data.name, "Name", 2, 80),
      password = passwordInput(data.password, 10);
    if (!["talent", "business"].includes(data.role))
      fail(400, "Choose a talent or business account.");
    if (await store.get("SELECT id FROM users WHERE email=?", mail))
      fail(409, "An account with this email already exists. Sign in instead.");
    const uid = id(),
      hash = await passwordHash(password);
    // Recheck after async password hashing so concurrent registrations cannot bypass uniqueness.
    if (await store.get("SELECT id FROM users WHERE email=?", mail))
      fail(409, "An account with this email already exists. Sign in instead.");
    await store.run(
      "INSERT INTO users(id,email,password_hash,name,role,passport_token,created_at) VALUES(?,?,?,?,?,?,?)",
      uid,
      mail,
      hash,
      name,
      data.role,
      id(),
      now(),
    );
    const user = await store.get("SELECT * FROM users WHERE id=?", uid);
    await startSession(res, user);
    res.status(201).json({
      user: publicUser(user),
    });
  });
  app.post("/api/auth/login", authLimit, async (req, res) => {
    const mail = email(req.body.email),
      password = passwordInput(req.body.password),
      user = await store.get("SELECT * FROM users WHERE email=?", mail);
    if (!user || !(await passwordMatches(password, user.password_hash)))
      fail(401, "Email or password is incorrect.");
    await startSession(res, user);
    res.json({
      user: publicUser(user),
    });
  });
  app.post("/api/auth/logout", signed, async (req, res) => {
    await store.run("DELETE FROM sessions WHERE token_hash=?", req.sessionHash);
    res.clearCookie("sb_session", {
      httpOnly: true,
      secure: production,
      sameSite: "lax",
      path: "/",
    });
    res.json({
      ok: true,
    });
  });
  app.put("/api/profile", signed, async (req, res) => {
    const d = req.body;
    const name = text(d.name, "Name", 2, 80),
      headline = text(d.headline || "", "Headline", 0, 100),
      location = text(d.location || "", "Location", 0, 80),
      bio = text(d.bio || "", "About you", 0, 1500),
      list = req.user.role === "talent" ? skills(d.skills) : [];
    await store.run(
      "UPDATE users SET name=?,headline=?,location=?,bio=?,skills=? WHERE id=?",
      name,
      headline,
      location,
      bio,
      JSON.stringify(list),
      req.user.id,
    );
    res.json({
      user: publicUser(
        await store.get("SELECT * FROM users WHERE id=?", req.user.id),
      ),
    });
  });
  app.get("/api/tasks", async (req, res) => {
    const userSkills =
      req.user?.role === "talent"
        ? [
            ...new Set([
              ...JSON.parse(req.user.skills),
              ...(
                await store.all(
                  "SELECT skills FROM evidence WHERE talent_id=?",
                  req.user.id,
                )
              ).flatMap((e) => JSON.parse(e.skills)),
              ...(
                await store.all(
                  "SELECT t.skills FROM applications a JOIN tasks t ON t.id=a.task_id WHERE a.talent_id=? AND a.status='completed'",
                  req.user.id,
                )
              ).flatMap((t) => JSON.parse(t.skills)),
            ]),
          ]
        : [];
    const norm = (s) => s.toLowerCase().trim();
    const tasks = (
      await store.all(
        `SELECT t.*,u.name AS business_name,u.location AS location,(SELECT COUNT(*) FROM applications a WHERE a.task_id=t.id) AS applicants FROM tasks t JOIN users u ON u.id=t.business_id WHERE t.status='open' AND t.deadline>=? ORDER BY t.created_at DESC`,
        new Date().toISOString().slice(0, 10),
      )
    ).map((t) => {
      const task = decodeTask(t);
      const matching = task.skills.filter((s) =>
        userSkills.some((u) => norm(u) === norm(s)),
      );
      return {
        ...task,
        matchedSkills: matching,
        matchReason: matching.length
          ? `Matches your recorded skills: ${matching.join(", ")}.`
          : userSkills.length
            ? "No exact skill match yet. Read the brief before applying."
            : "Add skills to your profile to see explained matches.",
      };
    });
    tasks.sort((a, b) => b.matchedSkills.length - a.matchedSkills.length);
    res.json({
      tasks,
      categories,
    });
  });
  app.get("/api/tasks/:id", async (req, res) => {
    const t = await store.get(
      "SELECT t.*,u.name AS business_name,u.location FROM tasks t JOIN users u ON u.id=t.business_id WHERE t.id=?",
      req.params.id,
    );
    if (!t) fail(404, "Task not found.");
    res.json({
      task: decodeTask(t),
    });
  });
  app.post("/api/tasks", signed, role("business"), async (req, res) => {
    const d = req.body,
      title = text(d.title, "Task title", 8, 120),
      description = text(d.description, "Brief", 30, 4000),
      list = skills(d.skills);
    if (!categories.includes(d.category))
      fail(400, "Choose a supported category.");
    if (!Number.isInteger(d.budget) || d.budget < 100 || d.budget > 1000000)
      fail(400, "Budget must be a whole rand amount from R100 to R1,000,000.");
    if (
      typeof d.deadline !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(d.deadline) ||
      !Number.isFinite(Date.parse(d.deadline)) ||
      new Date(d.deadline).toISOString().slice(0, 10) !== d.deadline ||
      d.deadline < new Date().toISOString().slice(0, 10)
    )
      fail(400, "Choose a valid deadline of today or later.");
    const taskId = id();
    await store.run(
      "INSERT INTO tasks(id,business_id,title,description,category,skills,budget,deadline,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
      taskId,
      req.user.id,
      title,
      description,
      d.category,
      JSON.stringify(list),
      d.budget,
      d.deadline,
      now(),
    );
    res.status(201).json({
      id: taskId,
    });
  });
  app.post(
    "/api/tasks/:id/applications",
    signed,
    role("talent"),
    async (req, res) => {
      const t = await store.get(
        "SELECT * FROM tasks WHERE id=?",
        req.params.id,
      );
      if (!t) fail(404, "Task not found.");
      if (
        t.status !== "open" ||
        t.deadline < new Date().toISOString().slice(0, 10)
      )
        fail(409, "This task is no longer accepting applications.");
      if (
        await store.get(
          "SELECT id FROM applications WHERE task_id=? AND talent_id=?",
          t.id,
          req.user.id,
        )
      )
        fail(409, "You have already applied for this task.");
      const pitch = text(req.body.pitch, "Application", 20, 2500),
        aid = id();
      await store.transaction(async () => {
        await store.run(
          "INSERT INTO applications(id,task_id,talent_id,pitch,applied_at,updated_at) VALUES(?,?,?,?,?,?)",
          aid,
          t.id,
          req.user.id,
          pitch,
          now(),
          now(),
        );
        await event(aid, req.user.id, "Applied", pitch);
      });
      res.status(201).json({
        id: aid,
      });
    },
  );
  app.get("/api/projects", signed, async (req, res) => {
    const condition =
      req.user.role === "business" ? "t.business_id=?" : "a.talent_id=?";
    const list = await Promise.all(
      (
        await store.all(
          `SELECT a.*,t.title,t.description,t.category,t.skills,t.budget,t.deadline,t.business_id,u.name AS business_name,p.name AS talent_name,p.passport_token,p.share_public FROM applications a JOIN tasks t ON t.id=a.task_id JOIN users u ON u.id=t.business_id JOIN users p ON p.id=a.talent_id WHERE ${condition} ORDER BY a.updated_at DESC`,
          req.user.id,
        )
      ).map(async (a) => ({
        ...a,
        skills: JSON.parse(a.skills),
        events: await store.all(
          "SELECT e.action,e.detail,e.created_at,u.name AS actor_name FROM events e JOIN users u ON u.id=e.actor_id WHERE e.application_id=? ORDER BY e.rowid",
          a.id,
        ),
      })),
    );
    const owned =
      req.user.role === "business"
        ? (
            await store.all(
              "SELECT t.*,(SELECT COUNT(*) FROM applications a WHERE a.task_id=t.id) AS applicants FROM tasks t WHERE t.business_id=? ORDER BY t.created_at DESC",
              req.user.id,
            )
          ).map(decodeTask)
        : [];
    res.json({
      projects: list,
      tasks: owned,
    });
  });
  app.post(
    "/api/applications/:id/select",
    signed,
    role("business"),
    async (req, res) => {
      const a = await store.get(
        "SELECT * FROM applications WHERE id=?",
        req.params.id,
      );
      if (!a) fail(404, "Application not found.");
      const t = await taskOwned(req, a.task_id);
      if (t.status !== "open" || a.status !== "applied")
        fail(
          409,
          "This task already has a selected applicant or the application is no longer available.",
        );
      await store.transaction(async () => {
        await store.run("UPDATE tasks SET status='assigned' WHERE id=?", t.id);
        await store.run(
          "UPDATE applications SET status='not_selected',updated_at=? WHERE task_id=? AND id<>?",
          now(),
          t.id,
          a.id,
        );
        await store.run(
          "UPDATE applications SET status='assigned',updated_at=? WHERE id=?",
          now(),
          a.id,
        );
        await event(
          a.id,
          req.user.id,
          "Selected",
          "Business selected this applicant.",
        );
      });
      res.json({
        ok: true,
      });
    },
  );
  app.post(
    "/api/applications/:id/submit",
    signed,
    role("talent"),
    async (req, res) => {
      const a = await store.get(
        "SELECT * FROM applications WHERE id=? AND talent_id=?",
        req.params.id,
        req.user.id,
      );
      if (!a) fail(404, "Project not found.");
      if (!["assigned", "changes_requested"].includes(a.status))
        fail(409, "This project is not ready for submission.");
      const submission = text(
          req.body.submission,
          "Submission summary",
          20,
          4000,
        ),
        url = link(req.body.workUrl),
        isPublic = consent(req.body.publicConsent);
      if (!url)
        fail(
          400,
          "Add a work link so the business can review your deliverable.",
        );
      await store.transaction(async () => {
        await store.run(
          "UPDATE applications SET status='submitted',submission=?,work_url=?,public_consent=?,updated_at=? WHERE id=?",
          submission,
          url,
          isPublic,
          now(),
          a.id,
        );
        await store.run(
          "UPDATE tasks SET status='submitted' WHERE id=?",
          a.task_id,
        );
        await event(a.id, req.user.id, "Submitted", submission);
      });
      res.json({
        ok: true,
      });
    },
  );
  app.post(
    "/api/applications/:id/review",
    signed,
    role("business"),
    async (req, res) => {
      const a = await store.get(
        "SELECT * FROM applications WHERE id=?",
        req.params.id,
      );
      if (!a) fail(404, "Project not found.");
      await taskOwned(req, a.task_id);
      if (a.status !== "submitted")
        fail(409, "Only submitted work can be reviewed.");
      if (!["approve", "changes"].includes(req.body.action))
        fail(400, "Choose approve or request changes.");
      const feedback = text(req.body.feedback, "Business feedback", 10, 2000),
        approved = req.body.action === "approve";
      await store.transaction(async () => {
        await store.run(
          "UPDATE applications SET status=?,feedback=?,updated_at=? WHERE id=?",
          approved ? "completed" : "changes_requested",
          feedback,
          now(),
          a.id,
        );
        await store.run(
          "UPDATE tasks SET status=? WHERE id=?",
          approved ? "completed" : "assigned",
          a.task_id,
        );
        await event(
          a.id,
          req.user.id,
          approved ? "Approved" : "Changes requested",
          feedback,
        );
      });
      res.json({
        ok: true,
      });
    },
  );
  app.put(
    "/api/applications/:id/visibility",
    signed,
    role("talent"),
    async (req, res) => {
      const a = await store.get(
        "SELECT id FROM applications WHERE id=? AND talent_id=?",
        req.params.id,
        req.user.id,
      );
      if (!a) fail(404, "Project not found.");
      await store.run(
        "UPDATE applications SET public_consent=? WHERE id=?",
        consent(req.body.publicConsent),
        a.id,
      );
      res.json({
        ok: true,
      });
    },
  );
  app.get("/api/evidence", signed, role("talent"), async (req, res) => {
    const records = await Promise.all(
      (
        await store.all(
          "SELECT * FROM evidence WHERE talent_id=? ORDER BY updated_at DESC",
          req.user.id,
        )
      ).map(async (e) => ({
        ...decodeEvidence(e),
        confirmations: await store.all(
          "SELECT c.id,c.revision,c.status,c.statement,c.relationship,c.created_at,c.responded_at,u.name AS confirmer_name FROM confirmations c JOIN users u ON u.id=c.receiver_id WHERE c.evidence_id=? ORDER BY c.rowid DESC",
          e.id,
        ),
      })),
    );
    res.json({
      evidence: records,
    });
  });
  function evidenceFields(d) {
    return [
      text(d.title, "Experience title", 5, 120),
      text(d.organisation, "Business or context", 2, 100),
      text(d.description, "What you did", 20, 3000),
      JSON.stringify(skills(d.skills)),
      link(d.workUrl),
      text(d.period, "When you did this work", 3, 100),
      consent(d.publicConsent),
    ];
  }
  app.post("/api/evidence", signed, role("talent"), async (req, res) => {
    const values = evidenceFields(req.body),
      eid = id();
    await store.transaction(async () => {
      await store.run(
        "INSERT INTO evidence(id,talent_id,title,organisation,description,skills,work_url,period,public_consent,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        eid,
        req.user.id,
        ...values,
        now(),
        now(),
      );
      await snapshot(eid);
    });
    res.status(201).json({
      id: eid,
    });
  });
  app.put("/api/evidence/:id", signed, role("talent"), async (req, res) => {
    await ownEvidence(req, req.params.id);
    const values = evidenceFields(req.body);
    await store.transaction(async () => {
      await store.run(
        "UPDATE evidence SET title=?,organisation=?,description=?,skills=?,work_url=?,period=?,public_consent=?,revision=revision+1,updated_at=? WHERE id=?",
        ...values,
        now(),
        req.params.id,
      );
      await snapshot(req.params.id);
      await store.run(
        "UPDATE confirmations SET status='superseded' WHERE evidence_id=? AND status IN ('requested','confirmed')",
        req.params.id,
      );
    });
    res.json({
      ok: true,
    });
  });
  app.put(
    "/api/evidence/:id/visibility",
    signed,
    role("talent"),
    async (req, res) => {
      await ownEvidence(req, req.params.id);
      await store.run(
        "UPDATE evidence SET public_consent=? WHERE id=?",
        consent(req.body.publicConsent),
        req.params.id,
      );
      res.json({
        ok: true,
      });
    },
  );
  app.delete("/api/evidence/:id", signed, role("talent"), async (req, res) => {
    await ownEvidence(req, req.params.id);
    await store.run("DELETE FROM evidence WHERE id=?", req.params.id);
    res.json({
      ok: true,
    });
  });
  app.post(
    "/api/evidence/:id/requests",
    signed,
    role("talent"),
    async (req, res) => {
      const e = await ownEvidence(req, req.params.id),
        mail = email(req.body.email);
      const receiver = await store.get(
        "SELECT id FROM users WHERE email=?",
        mail,
      );
      if (!receiver)
        fail(
          404,
          "Ask your contact to create an account first, then request confirmation with their sign-in email.",
        );
      if (receiver.id === req.user.id)
        fail(400, "You cannot confirm your own experience.");
      if (
        await store.get(
          "SELECT id FROM confirmations WHERE evidence_id=? AND receiver_id=? AND revision=?",
          e.id,
          receiver.id,
          e.revision,
        )
      )
        fail(
          409,
          "You have already requested this person’s confirmation for this version.",
        );
      const requestId = id();
      await store.run(
        "INSERT INTO confirmations(id,evidence_id,requester_id,receiver_id,revision,status,created_at) VALUES(?,?,?,?,?,'requested',?)",
        requestId,
        e.id,
        req.user.id,
        receiver.id,
        e.revision,
        now(),
      );
      res.status(201).json({
        id: requestId,
      });
    },
  );
  app.get("/api/confirmations", signed, async (req, res) => {
    const list = (
      await store.all(
        `SELECT c.*,v.title,v.organisation,v.description,v.skills,v.work_url,v.period,e.revision AS current_revision,u.name AS talent_name FROM confirmations c JOIN evidence e ON e.id=c.evidence_id JOIN evidence_versions v ON v.evidence_id=c.evidence_id AND v.revision=c.revision JOIN users u ON u.id=c.requester_id WHERE c.receiver_id=? ORDER BY c.rowid DESC`,
        req.user.id,
      )
    ).map((c) => ({
      ...c,
      skills: JSON.parse(c.skills),
    }));
    res.json({
      confirmations: list,
    });
  });
  app.post("/api/confirmations/:id/respond", signed, async (req, res) => {
    const c = await store.get(
      "SELECT c.*,e.revision AS current_revision FROM confirmations c JOIN evidence e ON e.id=c.evidence_id WHERE c.id=? AND c.receiver_id=?",
      req.params.id,
      req.user.id,
    );
    if (!c) fail(404, "Confirmation request not found.");
    if (c.status !== "requested" || c.revision !== c.current_revision)
      fail(409, "This request is no longer current.");
    if (!["confirm", "decline"].includes(req.body.action))
      fail(400, "Choose confirm or decline.");
    const statement = text(req.body.statement, "Your statement", 10, 1500),
      relationship = text(req.body.relationship, "Your relationship", 3, 100);
    await store.run(
      "UPDATE confirmations SET status=?,statement=?,relationship=?,responded_at=? WHERE id=?",
      req.body.action === "confirm" ? "confirmed" : "declined",
      statement,
      relationship,
      now(),
      c.id,
    );
    res.json({
      ok: true,
    });
  });
  app.post("/api/confirmations/:id/withdraw", signed, async (req, res) => {
    const c = await store.get(
      "SELECT * FROM confirmations WHERE id=? AND receiver_id=?",
      req.params.id,
      req.user.id,
    );
    if (!c) fail(404, "Confirmation not found.");
    if (c.status !== "confirmed")
      fail(409, "Only a current confirmation can be withdrawn.");
    await store.run(
      "UPDATE confirmations SET status='withdrawn',responded_at=? WHERE id=?",
      now(),
      c.id,
    );
    res.json({
      ok: true,
    });
  });
  async function passport(user, includePrivate = false) {
    const evidence = await Promise.all(
      (
        await store.all(
          `SELECT id,title,organisation,description,skills,work_url,period,revision,created_at,updated_at,public_consent FROM evidence WHERE talent_id=? ${includePrivate ? "" : "AND public_consent=1"} ORDER BY updated_at DESC`,
          user.id,
        )
      ).map(async (e) => ({
        ...decodeEvidence(e),
        confirmations: await store.all(
          "SELECT u.name AS confirmer_name,c.relationship,c.statement,c.responded_at FROM confirmations c JOIN users u ON u.id=c.receiver_id WHERE c.evidence_id=? AND c.revision=? AND c.status='confirmed'",
          e.id,
          e.revision,
        ),
      })),
    );
    const completed = (
      await store.all(
        `SELECT a.id,a.submission,a.work_url,a.feedback,a.updated_at,a.public_consent,t.title,t.description,t.skills,t.budget,u.name AS business_name,t.id AS task_id FROM applications a JOIN tasks t ON t.id=a.task_id JOIN users u ON u.id=t.business_id WHERE a.talent_id=? AND a.status='completed' ${includePrivate ? "" : "AND a.public_consent=1"} ORDER BY a.updated_at DESC`,
        user.id,
      )
    ).map((a) => ({
      ...a,
      skills: JSON.parse(a.skills),
      isDemo: a.task_id.startsWith("demo-"),
    }));
    const p = publicUser(user);
    delete p.passportToken;
    delete p.id;
    delete p.sharePublic;
    return {
      profile: p,
      evidence,
      completed,
      disclaimer:
        "This passport records self-declared experience, contact confirmations and business-approved projects. It is not a qualification, independent skills assessment or NQF certification.",
    };
  }
  app.get("/api/passport", signed, role("talent"), async (req, res) => {
    const path = `/passport/${req.user.passport_token}`,
      origin = baseUrl || `${req.protocol}://${req.get("host")}`;
    res.json({
      ...(await passport(req.user, true)),
      sharePublic: !!req.user.share_public,
      url: `${origin}${path}`,
      qrDataUrl: null,
    });
  });
  app.get("/api/passport/qr", signed, role("talent"), async (req, res) => {
    if (!req.user.share_public) fail(409, "Enable passport sharing first.");
    const origin = baseUrl || `${req.protocol}://${req.get("host")}`;
    res.json({
      qrDataUrl: await QRCode.toDataURL(
        `${origin}/passport/${req.user.passport_token}`,
        {
          width: 300,
          margin: 2,
          errorCorrectionLevel: "M",
        },
      ),
    });
  });
  app.put("/api/passport/sharing", signed, role("talent"), async (req, res) => {
    await store.run(
      "UPDATE users SET share_public=? WHERE id=?",
      consent(req.body.sharePublic),
      req.user.id,
    );
    res.json({
      ok: true,
    });
  });
  app.post("/api/passport/rotate", signed, role("talent"), async (req, res) => {
    await store.run(
      "UPDATE users SET passport_token=? WHERE id=?",
      id(),
      req.user.id,
    );
    res.json({
      ok: true,
    });
  });
  app.get("/api/public/passports/:token", async (req, res) => {
    const user = await store.get(
      "SELECT * FROM users WHERE passport_token=? AND share_public=1 AND role=?",
      req.params.token,
      "talent",
    );
    if (!user) fail(404, "This passport is private or the link has changed.");
    res.json(await passport(user));
  });
  app.post("/api/reports", signed, async (req, res) => {
    const type = req.body.targetType,
      target = text(req.body.targetId, "Report target", 1, 100),
      reason = text(req.body.reason, "Reason", 15, 2000);
    let targetExists;
    if (type === "task")
      targetExists = await store.get("SELECT id FROM tasks WHERE id=?", target);
    else if (type === "evidence")
      targetExists = await store.get(
        "SELECT id FROM evidence WHERE id=? AND (public_consent=1 OR talent_id=?)",
        target,
        req.user.id,
      );
    else if (type === "passport")
      targetExists = await store.get(
        "SELECT id FROM users WHERE passport_token=? AND share_public=1",
        target,
      );
    else fail(400, "Choose a valid report target.");
    if (!targetExists) fail(404, "Report target not found.");
    const reportId = id();
    await store.run(
      "INSERT INTO reports(id,reporter_id,target_type,target_id,reason,created_at) VALUES(?,?,?,?,?,?)",
      reportId,
      req.user.id,
      type,
      target,
      reason,
      now(),
    );
    res.status(201).json({
      id: reportId,
      message:
        "Report recorded for team review. Reports are not monitored in real time.",
    });
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({
      error: "API route not found.",
    }),
  );
  if (serveStatic) {
    const dist = resolve("dist");
    if (existsSync(join(dist, "index.html"))) {
      app.use(
        express.static(dist, {
          index: false,
          maxAge: production ? "1h" : 0,
        }),
      );
      app.get("/{*path}", (_req, res) => {
        res.set("Cache-Control", "no-store");
        res.sendFile(join(dist, "index.html"));
      });
    }
  }
  app.use((err, req, res, _next) => {
    if (req.path === "/api/health")
      return res
        .status(503)
        .json({
          status: "unavailable",
          component: "database",
          ...databaseFailure(err),
        });
    if (["40001", "40P01", "23505"].includes(err.code))
      return res.status(409).json({
        error:
          "Another update changed this record, or it already exists. Refresh and try again.",
      });
    if (err.status)
      return res.status(err.status).json({
        error: err.message,
      });
    if (err.type === "entity.too.large")
      return res.status(413).json({
        error: "This request is too large.",
      });
    if (err instanceof SyntaxError)
      return res.status(400).json({
        error: "Invalid request data.",
      });
    console.error("Unexpected server error:", err.code || "internal_error");
    res.status(500).json({
      error: "Something went wrong. Please try again.",
    });
  });
  return app;
}
