import { DatabaseSync } from "node:sqlite";
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  randomUUID,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);
export const id = () => randomUUID();
export const now = () => new Date().toISOString();
export const hashToken = (value) =>
  createHash("sha256").update(value).digest("hex");
export async function passwordHash(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString("hex")}`;
}
export async function passwordMatches(password, stored) {
  const [salt, hex] = stored.split(":");
  const key = await scrypt(password, salt, 64);
  return timingSafeEqual(Buffer.from(hex, "hex"), key);
}
export function openStore(filename) {
  if (filename !== ":memory:")
    mkdirSync(dirname(resolve(filename)), {
      recursive: true,
    });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
 name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('talent','business')),
 headline TEXT NOT NULL DEFAULT '', location TEXT NOT NULL DEFAULT '', bio TEXT NOT NULL DEFAULT '',
 skills TEXT NOT NULL DEFAULT '[]', share_public INTEGER NOT NULL DEFAULT 0,
 passport_token TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL
 );
 CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS tasks (
 id TEXT PRIMARY KEY, business_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, description TEXT NOT NULL,
 category TEXT NOT NULL, skills TEXT NOT NULL, budget INTEGER NOT NULL CHECK(budget>=100), deadline TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','assigned','submitted','completed')), created_at TEXT NOT NULL
 );
 CREATE TABLE IF NOT EXISTS applications (
 id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id), talent_id TEXT NOT NULL REFERENCES users(id), pitch TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'applied' CHECK(status IN ('applied','assigned','not_selected','submitted','changes_requested','completed')),
 submission TEXT NOT NULL DEFAULT '', work_url TEXT NOT NULL DEFAULT '', public_consent INTEGER NOT NULL DEFAULT 0,
 feedback TEXT NOT NULL DEFAULT '', applied_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(task_id,talent_id)
 );
 CREATE TABLE IF NOT EXISTS evidence (
 id TEXT PRIMARY KEY, talent_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, organisation TEXT NOT NULL,
 description TEXT NOT NULL, skills TEXT NOT NULL, work_url TEXT NOT NULL DEFAULT '', period TEXT NOT NULL,
 public_consent INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
 );
 CREATE TABLE IF NOT EXISTS evidence_versions (
 evidence_id TEXT NOT NULL REFERENCES evidence(id) ON DELETE CASCADE, revision INTEGER NOT NULL,
 title TEXT NOT NULL, organisation TEXT NOT NULL, description TEXT NOT NULL, skills TEXT NOT NULL, work_url TEXT NOT NULL, period TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(evidence_id,revision)
 );
 CREATE TABLE IF NOT EXISTS confirmations (
 id TEXT PRIMARY KEY, evidence_id TEXT NOT NULL REFERENCES evidence(id) ON DELETE CASCADE, requester_id TEXT NOT NULL REFERENCES users(id),
 receiver_id TEXT NOT NULL REFERENCES users(id), revision INTEGER NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('requested','confirmed','declined','withdrawn','superseded')),
 statement TEXT NOT NULL DEFAULT '', relationship TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, responded_at TEXT,
 UNIQUE(evidence_id,receiver_id,revision)
 );
 CREATE TABLE IF NOT EXISTS events (
 id TEXT PRIMARY KEY, application_id TEXT NOT NULL REFERENCES applications(id), actor_id TEXT NOT NULL REFERENCES users(id),
 action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
 );
 CREATE TABLE IF NOT EXISTS reports (
 id TEXT PRIMARY KEY, reporter_id TEXT NOT NULL REFERENCES users(id), target_type TEXT NOT NULL CHECK(target_type IN ('task','evidence','passport')),
 target_id TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open'
 );
 CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY,hits INTEGER NOT NULL,window_end BIGINT NOT NULL);
 CREATE INDEX IF NOT EXISTS confirmation_receiver ON confirmations(receiver_id);
 CREATE INDEX IF NOT EXISTS application_talent ON applications(talent_id);
 CREATE INDEX IF NOT EXISTS evidence_talent ON evidence(talent_id);
 INSERT OR IGNORE INTO evidence_versions(evidence_id,revision,title,organisation,description,skills,work_url,period,created_at)
 SELECT id,revision,title,organisation,description,skills,work_url,period,updated_at FROM evidence;
 PRAGMA user_version=2;`);
  const context = new AsyncLocalStorage();
  let tail = Promise.resolve();
  const exclusive = (fn) => {
    const pending = tail.then(fn);
    tail = pending.catch(() => {});
    return pending;
  };
  let store;
  const execute = (fn) =>
    context.getStore() === store ? Promise.resolve().then(fn) : exclusive(fn);
  store = {
    kind: "sqlite",
    get(sql, ...params) {
      return execute(() => db.prepare(sql).get(...params));
    },
    all(sql, ...params) {
      return execute(() => db.prepare(sql).all(...params));
    },
    run(sql, ...params) {
      return execute(() => db.prepare(sql).run(...params));
    },
    transaction(fn) {
      if (context.getStore() === store) return fn();
      return exclusive(() =>
        context.run(store, async () => {
          db.exec("BEGIN IMMEDIATE");
          try {
            const result = await fn();
            db.exec("COMMIT");
            return result;
          } catch (error) {
            db.exec("ROLLBACK");
            throw error;
          }
        }),
      );
    },
    close() {
      return exclusive(() => db.close());
    },
  };
  return store;
}
export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    role: u.role,
    headline: u.headline,
    location: u.location,
    bio: u.bio,
    skills: JSON.parse(u.skills),
    sharePublic: !!u.share_public,
    passportToken: u.passport_token,
  };
}
export async function seedDemo(store) {
  const accounts = [
    [
      "talent@skillbridge.demo",
      "TalentDemo!2026",
      "Thando Mokoena",
      "talent",
      ["Graphic design", "Canva", "Customer service"],
    ],
    [
      "business@skillbridge.demo",
      "BusinessDemo!2026",
      "Grounded Coffee Co.",
      "business",
      [],
    ],
    [
      "reviewer@skillbridge.demo",
      "ReviewerDemo!2026",
      "Naledi · Demo supervisor",
      "business",
      [],
    ],
  ];
  for (const [email, password, name, role, skills] of accounts) {
    if (!(await store.get("SELECT id FROM users WHERE email=?", email)))
      await store.run(
        "INSERT INTO users(id,email,password_hash,name,role,headline,location,bio,skills,passport_token,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        id(),
        email,
        await passwordHash(password),
        name,
        role,
        role === "talent"
          ? "Creative talent, ready for a first opportunity"
          : "Fictional hackathon business",
        "Johannesburg",
        "Fictional demo account. Create your own account for independent testing.",
        JSON.stringify(skills),
        id(),
        now(),
      );
  }
  const owner = await store.get(
    "SELECT id FROM users WHERE email=?",
    "business@skillbridge.demo",
  );
  const demos = [
    [
      "coffee",
      "A fresh look for a local coffee brand",
      "Graphic design",
      "Design a logo and a one-page brand guide for our fictional neighbourhood coffee shop. Deliver an editable logo, a colour palette and two example applications.",
      1800,
      7,
      ["Graphic design", "Canva", "Branding"],
    ],
    [
      "website",
      "Build a website for our growing business",
      "Web development",
      "Build a mobile-friendly three-page catalogue for a fictional local homeware shop. Include a home page, product overview and contact page.",
      3500,
      14,
      ["HTML & CSS", "Web design"],
    ],
    [
      "social",
      "Make our social media feel like us",
      "Social media",
      "Create five Instagram posts and captions for a fictional small business. Deliver editable designs and a short posting plan.",
      1200,
      5,
      ["Canva", "Social media", "Copywriting"],
    ],
    [
      "stock",
      "Organise our stock records",
      "Small-business support",
      "Clean a sample stock spreadsheet, organise product categories and document a simple weekly stock-check process. Use fictional sample data only.",
      950,
      4,
      ["Excel", "Stock capture", "Administration"],
    ],
    [
      "customers",
      "Create a customer service guide",
      "Small-business support",
      "Write a short guide with sample customer greetings, complaint responses and a booking log template for a fictional local salon.",
      1100,
      7,
      ["Customer service", "Administration", "Writing"],
    ],
  ];
  for (const [
    key,
    title,
    category,
    description,
    budget,
    days,
    skills,
  ] of demos) {
    const taskId = `demo-${key}`;
    if (!(await store.get("SELECT id FROM tasks WHERE id=?", taskId))) {
      const deadline = new Date(Date.now() + days * 86400000)
        .toISOString()
        .slice(0, 10);
      await store.run(
        "INSERT INTO tasks(id,business_id,title,description,category,skills,budget,deadline,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
        taskId,
        owner.id,
        title,
        description,
        category,
        JSON.stringify(skills),
        budget,
        deadline,
        now(),
      );
    }
  }
}
