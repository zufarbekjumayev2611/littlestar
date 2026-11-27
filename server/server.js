// Little Star platformasi — server (Node.js 22.5+; tashqi kutubxonasiz)
// Ishga tushirish:  node server/server.js
// Admin yaratish:   node server/server.js --create-admin 998901234567 ParolKamida6
"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const PORT = +(process.env.PORT || 3000);
const DB_PATH = process.env.DB_PATH || path.join(ROOT, "data", "littlestar.db");
const DATA_DIR = process.env.DATA_DIR || path.dirname(DB_PATH);
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

/* ======================= MA'LUMOTLAR BAZASI ======================= */
const db = new DatabaseSync(DB_PATH);
db.exec(`
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS accounts(
  id INTEGER PRIMARY KEY, phone TEXT UNIQUE NOT NULL, pass_hash TEXT NOT NULL, salt TEXT NOT NULL,
  parent_name TEXT DEFAULT '', role TEXT NOT NULL DEFAULT 'user', premium_until INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(
  token TEXT PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS children(
  id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL, grade INTEGER NOT NULL, region TEXT NOT NULL, district TEXT DEFAULT '',
  school TEXT DEFAULT '', created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS tests(
  id INTEGER PRIMARY KEY, section TEXT NOT NULL, title TEXT NOT NULL, grade INTEGER DEFAULT 4,
  duration_min INTEGER NOT NULL DEFAULT 60, published INTEGER NOT NULL DEFAULT 1,
  sort INTEGER DEFAULT 0, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS questions(
  id INTEGER PRIMARY KEY, test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  ord INTEGER NOT NULL, subject TEXT DEFAULT 'Matematika', text TEXT NOT NULL, image TEXT DEFAULT '',
  options TEXT NOT NULL, correct INTEGER NOT NULL, explanation TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS attempts(
  id INTEGER PRIMARY KEY, child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE, status TEXT NOT NULL DEFAULT 'open',
  started_at INTEGER NOT NULL, finished_at INTEGER, time_sec INTEGER, correct INTEGER, total INTEGER,
  answers TEXT);
CREATE INDEX IF NOT EXISTS idx_att_test ON attempts(test_id,status);
CREATE INDEX IF NOT EXISTS idx_att_child ON attempts(child_id);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);

const SECTIONS = {
  pm1: { name: "Prezident maktablari — 1-bosqich", grade: 4 },
  pm2: { name: "Prezident maktablari — 2-bosqich", grade: 4 },
  ixt: { name: "Ixtisoslashtirilgan maktablar", grade: 4 },
  ol3: { name: "Matematika olimpiadasi — 3-sinf", grade: 3 },
  ol4: { name: "Matematika olimpiadasi — 4-sinf", grade: 4 },
};
const REGIONS = ["Qoraqalpog‘iston Respublikasi","Andijon viloyati","Buxoro viloyati","Farg‘ona viloyati","Jizzax viloyati","Xorazm viloyati","Namangan viloyati","Navoiy viloyati","Qashqadaryo viloyati","Samarqand viloyati","Sirdaryo viloyati","Surxondaryo viloyati","Toshkent viloyati","Toshkent shahri"];

const DEFAULT_SETTINGS = {
  free_mode: "1",
  premium_sections: JSON.stringify(Object.keys(SECTIONS)),
  contact_text: "Obuna uchun Navoiy-Qorako‘l o‘quv markazi bilan bog‘laning: +998 99 381 99 99",
};
for (const [k, v] of Object.entries(DEFAULT_SETTINGS))
  db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)").run(k, v);

function getSettings() {
  const s = {};
  for (const r of db.prepare("SELECT key,value FROM settings").all()) s[r.key] = r.value;
  return {
    free_mode: s.free_mode === "1",
    premium_sections: JSON.parse(s.premium_sections || "[]"),
    contact_text: s.contact_text || "",
  };
}

// Birinchi ishga tushishda namunaviy testlar
if (db.prepare("SELECT COUNT(*) n FROM tests").get().n === 0) {
  require("./seed.js").seed(db);
  console.log("Namunaviy testlar qo‘shildi.");
}

/* ======================= YORDAMCHI FUNKSIYALAR ======================= */
const now = () => Math.floor(Date.now() / 1000);
function hashPass(p, salt) { return crypto.scryptSync(p, salt, 64).toString("hex"); }
function normPhone(p) {
  let d = String(p || "").replace(/\D/g, "");
  if (d.length === 9) d = "998" + d;
  return /^998\d{9}$/.test(d) ? d : null;
}
class HttpError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const bad = (m) => { throw new HttpError(400, m); };
const str = (v, max = 100) => String(v ?? "").trim().slice(0, max);

function newSession(accountId) {
  const token = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions(token,account_id,created_at) VALUES(?,?,?)").run(token, accountId, now());
  return token;
}
function publicAccount(a) {
  return { id: a.id, phone: a.phone, parent_name: a.parent_name, role: a.role, premium_until: a.premium_until };
}
function hasAccess(account, section) {
  const s = getSettings();
  if (s.free_mode) return true;
  if (!s.premium_sections.includes(section)) return true;
  if (!account) return false;
  if (account.role === "admin") return true;
  return (account.premium_until || 0) > now();
}

// Oddiy so‘rov cheklovi (kirish/ro‘yxatdan o‘tish uchun)
const hits = new Map();
function rateLimit(key, max = 20, windowSec = 600) {
  const t = now(); const h = (hits.get(key) || []).filter((x) => x > t - windowSec);
  if (h.length >= max) throw new HttpError(429, "Juda ko‘p urinish. Birozdan keyin qayta urinib ko‘ring.");
  h.push(t); hits.set(key, h);
}

/* ======================= REYTING ======================= */
// Reytingda har bir testning BIRINCHI yakunlangan urinishi hisoblanadi (adolatli bo‘lishi uchun).
function firstAttemptsSQL(extraWhere = "") {
  return `WITH firsts AS (
    SELECT a.child_id, a.test_id, a.correct, a.total, a.time_sec,
           ROW_NUMBER() OVER (PARTITION BY a.child_id, a.test_id ORDER BY a.finished_at) rn
    FROM attempts a JOIN tests t ON t.id=a.test_id
    WHERE a.status='done' ${extraWhere})
  SELECT * FROM firsts WHERE rn=1`;
}
function testRank(testId, childId) {
  const rows = db.prepare(firstAttemptsSQL("AND a.test_id=?")).all(testId);
  rows.sort((x, y) => y.correct - x.correct || x.time_sec - y.time_sec);
  const i = rows.findIndex((r) => r.child_id === childId);
  return { place: i < 0 ? null : i + 1, total: rows.length };
}
function sectionBoard(section, { grade = 0, region = "" } = {}) {
  const rows = db.prepare(`SELECT c.id, c.name, c.region, c.district, c.grade, c.school,
      SUM(f.correct) score, SUM(f.total) max, COUNT(*) tests, SUM(f.time_sec) time
    FROM (${firstAttemptsSQL("AND t.section=?")}) f JOIN children c ON c.id=f.child_id
    WHERE (?=0 OR c.grade=?) AND (?='' OR c.region=?)
    GROUP BY c.id ORDER BY score DESC, time ASC`).all(section, grade, grade, region, region);
  return rows.map((r, i) => ({ ...r, place: i + 1 }));
}

/* ======================= MARSHRUTLAR (API) ======================= */
const routes = [];
const route = (method, pattern, handler, opts = {}) => {
  const keys = []; const re = new RegExp("^" + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), "([^/]+)")) + "$");
  routes.push({ method, re, keys, handler, ...opts });
};

// --- Kirish ---
route("POST", "/api/auth/register", ({ body, ip }) => {
  rateLimit("reg:" + ip, 60); // o‘quv markazida ko‘p oila bitta IP dan kirishi mumkin
  const phone = normPhone(body.phone); if (!phone) bad("Telefon raqam noto‘g‘ri. Masalan: 90 123 45 67");
  const pass = String(body.password || ""); if (pass.length < 6) bad("Parol kamida 6 belgidan iborat bo‘lsin");
  if (db.prepare("SELECT 1 FROM accounts WHERE phone=?").get(phone)) bad("Bu raqam allaqachon ro‘yxatdan o‘tgan. Kirish bo‘limidan foydalaning.");
  const salt = crypto.randomBytes(16).toString("hex");
  const r = db.prepare("INSERT INTO accounts(phone,pass_hash,salt,parent_name,created_at) VALUES(?,?,?,?,?)")
    .run(phone, hashPass(pass, salt), salt, str(body.parent_name, 60), now());
  const a = db.prepare("SELECT * FROM accounts WHERE id=?").get(r.lastInsertRowid);
  return { token: newSession(a.id), account: publicAccount(a) };
});
route("POST", "/api/auth/login", ({ body, ip }) => {
  const phone = normPhone(body.phone);
  rateLimit("login:" + ip + ":" + phone, 10); rateLimit("loginip:" + ip, 300);
  const a = phone && db.prepare("SELECT * FROM accounts WHERE phone=?").get(phone);
  if (!a || hashPass(String(body.password || ""), a.salt) !== a.pass_hash) throw new HttpError(401, "Telefon raqam yoki parol noto‘g‘ri");
  return { token: newSession(a.id), account: publicAccount(a) };
});
route("POST", "/api/auth/logout", ({ token }) => { db.prepare("DELETE FROM sessions WHERE token=?").run(token); return { ok: true }; }, { auth: true });

route("GET", "/api/meta", () => {
  const s = getSettings();
  return { sections: Object.entries(SECTIONS).map(([id, v]) => ({ id, ...v, premium: !s.free_mode && s.premium_sections.includes(id) })), regions: REGIONS, free_mode: s.free_mode, contact_text: s.contact_text };
});

route("GET", "/api/me", ({ account }) => {
  const children = db.prepare("SELECT id,name,grade,region,district,school FROM children WHERE account_id=? ORDER BY id").all(account.id);
  const access = Object.fromEntries(Object.keys(SECTIONS).map((k) => [k, hasAccess(account, k)]));
  return { account: publicAccount(account), children, access };
}, { auth: true });

// --- Bolalar profillari ---
function childInput(b) {
  const name = str(b.name, 50); if (name.length < 2) bad("Bolaning ism-familiyasini yozing");
  const grade = +b.grade; if (!(Number.isInteger(grade) && grade >= 1 && grade <= 11)) bad("Sinfni tanlang");
  const region = str(b.region, 60); if (!REGIONS.includes(region)) bad("Viloyatni tanlang");
  return { name, grade, region, district: str(b.district, 60), school: str(b.school, 80) };
}
route("POST", "/api/children", ({ account, body }) => {
  const c = childInput(body);
  if (db.prepare("SELECT COUNT(*) n FROM children WHERE account_id=?").get(account.id).n >= 5) bad("Bitta akkauntga ko‘pi bilan 5 ta bola qo‘shish mumkin");
  const r = db.prepare("INSERT INTO children(account_id,name,grade,region,district,school,created_at) VALUES(?,?,?,?,?,?,?)")
    .run(account.id, c.name, c.grade, c.region, c.district, c.school, now());
  return { id: Number(r.lastInsertRowid) };
}, { auth: true });
route("PUT", "/api/children/:id", ({ account, body, params }) => {
  const c = childInput(body);
  const r = db.prepare("UPDATE children SET name=?,grade=?,region=?,district=?,school=? WHERE id=? AND account_id=?")
    .run(c.name, c.grade, c.region, c.district, c.school, +params.id, account.id);
  if (!r.changes) throw new HttpError(404, "Topilmadi");
  return { ok: true };
}, { auth: true });
route("DELETE", "/api/children/:id", ({ account, params }) => {
  db.prepare("DELETE FROM children WHERE id=? AND account_id=?").run(+params.id, account.id); return { ok: true };
}, { auth: true });

function ownChild(account, id) {
  const c = db.prepare("SELECT * FROM children WHERE id=? AND account_id=?").get(+id, account.id);
  if (!c) bad("Bola profilini tanlang"); return c;
}

// --- Testlar ---
route("GET", "/api/tests", ({ account, query }) => {
  const section = query.section; if (!SECTIONS[section]) bad("Bo‘lim noto‘g‘ri");
  const child = ownChild(account, query.child);
  const tests = db.prepare(`SELECT t.id,t.title,t.grade,t.duration_min,(SELECT COUNT(*) FROM questions q WHERE q.test_id=t.id) count
    FROM tests t WHERE t.section=? AND t.published=1 ORDER BY t.sort,t.id`).all(section);
  for (const t of tests) {
    const at = db.prepare("SELECT correct,total,time_sec,finished_at FROM attempts WHERE child_id=? AND test_id=? AND status='done' ORDER BY finished_at").all(child.id, t.id);
    t.attempts = at.length; t.first = at[0] || null;
    t.best = at.reduce((m, x) => (!m || x.correct > m.correct ? x : m), null);
  }
  return { section: { id: section, ...SECTIONS[section] }, access: hasAccess(account, section), tests };
}, { auth: true });

route("POST", "/api/tests/:id/start", ({ account, params, body }) => {
  const child = ownChild(account, body.child);
  const t = db.prepare("SELECT * FROM tests WHERE id=? AND published=1").get(+params.id); if (!t) throw new HttpError(404, "Test topilmadi");
  if (!hasAccess(account, t.section)) throw new HttpError(402, getSettings().contact_text || "Bu bo‘lim pullik");
  const qs = db.prepare("SELECT id,subject,text,image,options FROM questions WHERE test_id=? ORDER BY ord,id").all(t.id)
    .map((q) => ({ ...q, options: JSON.parse(q.options) }));
  const r = db.prepare("INSERT INTO attempts(child_id,test_id,started_at,total) VALUES(?,?,?,?)").run(child.id, t.id, now(), qs.length);
  return { attempt_id: Number(r.lastInsertRowid), test: { id: t.id, title: t.title, section: t.section, duration_min: t.duration_min }, questions: qs, server_time: now() };
}, { auth: true });

route("POST", "/api/attempts/:id/submit", ({ account, params, body }) => {
  const at = db.prepare(`SELECT a.*, t.duration_min, t.section, t.title FROM attempts a JOIN tests t ON t.id=a.test_id
    JOIN children c ON c.id=a.child_id WHERE a.id=? AND c.account_id=?`).get(+params.id, account.id);
  if (!at) throw new HttpError(404, "Urinish topilmadi");
  const qs = db.prepare("SELECT id,subject,text,image,options,correct,explanation FROM questions WHERE test_id=? ORDER BY ord,id").all(at.test_id);
  const answers = Array.isArray(body.answers) ? body.answers.slice(0, qs.length) : [];
  if (at.status !== "done") {
    let correct = 0; qs.forEach((q, i) => { if (answers[i] === q.correct) correct++; });
    const time = Math.min(now() - at.started_at, at.duration_min * 60);
    db.prepare("UPDATE attempts SET status='done',finished_at=?,time_sec=?,correct=?,total=?,answers=? WHERE id=?")
      .run(now(), time, correct, qs.length, JSON.stringify(answers), at.id);
  }
  const done = db.prepare("SELECT * FROM attempts WHERE id=?").get(at.id);
  const saved = JSON.parse(done.answers || "[]");
  const isFirst = db.prepare("SELECT id FROM attempts WHERE child_id=? AND test_id=? AND status='done' ORDER BY finished_at LIMIT 1").get(at.child_id, at.test_id).id === at.id;
  const child = db.prepare("SELECT * FROM children WHERE id=?").get(at.child_id);
  const board = sectionBoard(at.section);
  const me = board.find((r) => r.id === child.id);
  const regionBoard = sectionBoard(at.section, { region: child.region });
  const meReg = regionBoard.find((r) => r.id === child.id);
  return {
    correct: done.correct, total: done.total, time_sec: done.time_sec, counted: isFirst,
    test_rank: testRank(at.test_id, child.id),
    section_rank: { place: me ? me.place : null, total: board.length, region_place: meReg ? meReg.place : null, region_total: regionBoard.length },
    review: qs.map((q, i) => ({ subject: q.subject, text: q.text, image: q.image, options: JSON.parse(q.options), correct: q.correct, chosen: saved[i] ?? null, explanation: q.explanation })),
  };
}, { auth: true });

// --- Reyting ---
route("GET", "/api/leaderboard", ({ query, account }) => {
  const section = query.section; if (!SECTIONS[section]) bad("Bo‘lim noto‘g‘ri");
  const grade = +query.grade || 0; const region = REGIONS.includes(query.region) ? query.region : "";
  const board = sectionBoard(section, { grade, region });
  let mine = [];
  if (account) { const ids = db.prepare("SELECT id FROM children WHERE account_id=?").all(account.id).map((r) => r.id); mine = board.filter((r) => ids.includes(r.id)); }
  const strip = (r) => ({ place: r.place, name: r.name, region: r.region, district: r.district, grade: r.grade, school: r.school, score: r.score, max: r.max, tests: r.tests, time: r.time, id: r.id });
  return { total: board.length, top: board.slice(0, 100).map(strip), mine: mine.map(strip) };
}, { optionalAuth: true });

/* ======================= ADMIN ======================= */
const A = { auth: true, admin: true };
route("GET", "/api/admin/stats", () => {
  const n = (sql, ...a) => db.prepare(sql).get(...a).n;
  const day = now() - 86400;
  return {
    accounts: n("SELECT COUNT(*) n FROM accounts"), children: n("SELECT COUNT(*) n FROM children"),
    attempts: n("SELECT COUNT(*) n FROM attempts WHERE status='done'"), attempts_today: n("SELECT COUNT(*) n FROM attempts WHERE status='done' AND finished_at>?", day),
    new_today: n("SELECT COUNT(*) n FROM accounts WHERE created_at>?", day), premium: n("SELECT COUNT(*) n FROM accounts WHERE premium_until>?", now()),
    tests: n("SELECT COUNT(*) n FROM tests"), questions: n("SELECT COUNT(*) n FROM questions"),
    by_region: db.prepare("SELECT region, COUNT(*) n FROM children GROUP BY region ORDER BY n DESC").all(),
    settings: getSettings(), sections: SECTIONS,
  };
}, A);
route("PUT", "/api/admin/settings", ({ body }) => {
  const set = db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
  if ("free_mode" in body) set.run("free_mode", body.free_mode ? "1" : "0");
  if (Array.isArray(body.premium_sections)) set.run("premium_sections", JSON.stringify(body.premium_sections.filter((s) => SECTIONS[s])));
  if ("contact_text" in body) set.run("contact_text", str(body.contact_text, 300));
  return getSettings();
}, A);

route("GET", "/api/admin/tests", ({ query }) => db.prepare(`SELECT t.*, (SELECT COUNT(*) FROM questions q WHERE q.test_id=t.id) count,
  (SELECT COUNT(*) FROM attempts a WHERE a.test_id=t.id AND a.status='done') attempts FROM tests t WHERE (?='' OR section=?) ORDER BY section,sort,id`).all(query.section || "", query.section || ""), A);
function testInput(b) {
  if (!SECTIONS[b.section]) bad("Bo‘limni tanlang");
  const title = str(b.title, 120); if (!title) bad("Test nomini yozing");
  return { section: b.section, title, grade: +b.grade || SECTIONS[b.section].grade, duration_min: Math.max(1, Math.min(300, +b.duration_min || 60)), published: b.published ? 1 : 0, sort: +b.sort || 0 };
}
route("POST", "/api/admin/tests", ({ body }) => {
  const t = testInput(body);
  const r = db.prepare("INSERT INTO tests(section,title,grade,duration_min,published,sort,created_at) VALUES(?,?,?,?,?,?,?)").run(t.section, t.title, t.grade, t.duration_min, t.published, t.sort, now());
  return { id: Number(r.lastInsertRowid) };
}, A);
route("PUT", "/api/admin/tests/:id", ({ body, params }) => {
  const t = testInput(body);
  db.prepare("UPDATE tests SET section=?,title=?,grade=?,duration_min=?,published=?,sort=? WHERE id=?").run(t.section, t.title, t.grade, t.duration_min, t.published, t.sort, +params.id);
  return { ok: true };
}, A);
route("DELETE", "/api/admin/tests/:id", ({ params }) => { db.prepare("DELETE FROM tests WHERE id=?").run(+params.id); return { ok: true }; }, A);
route("GET", "/api/admin/tests/:id", ({ params }) => {
  const t = db.prepare("SELECT * FROM tests WHERE id=?").get(+params.id); if (!t) throw new HttpError(404, "Topilmadi");
  t.questions = db.prepare("SELECT * FROM questions WHERE test_id=? ORDER BY ord,id").all(t.id).map((q) => ({ ...q, options: JSON.parse(q.options) }));
  return t;
}, A);
route("PUT", "/api/admin/tests/:id/questions", ({ body, params }) => {
  const id = +params.id; if (!db.prepare("SELECT 1 FROM tests WHERE id=?").get(id)) throw new HttpError(404, "Topilmadi");
  const list = Array.isArray(body.questions) ? body.questions : bad("Savollar ro‘yxati kerak");
  const clean = list.map((q, i) => {
    const options = (Array.isArray(q.options) ? q.options : []).map((o) => str(o, 500)).filter((o) => o !== "");
    if (!str(q.text, 3000) && !q.image) bad(`${i + 1}-savol matni bo‘sh`);
    if (options.length < 2) bad(`${i + 1}-savolda kamida 2 ta javob varianti bo‘lsin`);
    const correct = +q.correct; if (!(correct >= 0 && correct < options.length)) bad(`${i + 1}-savolda to‘g‘ri javob belgilanmagan`);
    const image = String(q.image || ""); if (image.length > 600000) bad(`${i + 1}-savoldagi rasm juda katta (500 KB gacha)`);
    return { subject: str(q.subject, 40) || "Matematika", text: str(q.text, 3000), image, options, correct, explanation: str(q.explanation, 2000) };
  });
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM questions WHERE test_id=?").run(id);
    const ins = db.prepare("INSERT INTO questions(test_id,ord,subject,text,image,options,correct,explanation) VALUES(?,?,?,?,?,?,?,?)");
    clean.forEach((q, i) => ins.run(id, i + 1, q.subject, q.text, q.image, JSON.stringify(q.options), q.correct, q.explanation));
    db.exec("COMMIT");
  } catch (e) { db.exec("ROLLBACK"); throw e; }
  return { ok: true, count: clean.length };
}, A);

route("GET", "/api/admin/users", ({ query }) => {
  const q = "%" + String(query.q || "").replace(/[%_]/g, "") + "%";
  return db.prepare(`SELECT a.id,a.phone,a.parent_name,a.role,a.premium_until,a.created_at,
      (SELECT GROUP_CONCAT(c.name || ' (' || c.grade || '-sinf, ' || c.region || ')', '; ') FROM children c WHERE c.account_id=a.id) kids,
      (SELECT COUNT(*) FROM attempts t JOIN children c ON c.id=t.child_id WHERE c.account_id=a.id AND t.status='done') attempts
    FROM accounts a WHERE a.phone LIKE ? OR a.parent_name LIKE ? OR EXISTS(SELECT 1 FROM children c WHERE c.account_id=a.id AND c.name LIKE ?)
    ORDER BY a.id DESC LIMIT 200`).all(q, q, q);
}, A);
route("PUT", "/api/admin/users/:id", ({ body, params, account }) => {
  const id = +params.id; const u = db.prepare("SELECT * FROM accounts WHERE id=?").get(id); if (!u) throw new HttpError(404, "Topilmadi");
  if ("premium_days" in body) { const d = +body.premium_days; const base = Math.max(now(), u.premium_until || 0); db.prepare("UPDATE accounts SET premium_until=? WHERE id=?").run(d > 0 ? base + d * 86400 : 0, id); }
  if ("role" in body && ["user", "teacher", "admin"].includes(body.role)) { if (id === account.id && body.role !== "admin") bad("O‘zingizni adminlikdan chiqara olmaysiz"); db.prepare("UPDATE accounts SET role=? WHERE id=?").run(body.role, id); }
  if (body.new_password) { const p = String(body.new_password); if (p.length < 6) bad("Parol kamida 6 belgi"); const salt = crypto.randomBytes(16).toString("hex"); db.prepare("UPDATE accounts SET pass_hash=?,salt=? WHERE id=?").run(hashPass(p, salt), salt, id); db.prepare("DELETE FROM sessions WHERE account_id=?").run(id); }
  return { ok: true };
}, A);

/* ======================= OLIMPIADA AKADEMIYASI ======================= */
const ACADEMY = require("./academy.js")({ db, route, HttpError, bad, str, now, DATA_DIR });

/* ======================= HTTP SERVER ======================= */
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8" };

function readBody(req) {
  return new Promise((res, rej) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > 5e6) { rej(new HttpError(413, "So‘rov juda katta")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { if (!size) return res({}); try { res(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch { rej(new HttpError(400, "JSON noto‘g‘ri")); } });
    req.on("error", rej);
  });
}
function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(body);
}
function serveStatic(req, res, pathname) {
  let p = decodeURIComponent(pathname); if (p === "/" || p === "") p = "/index.html";
  if (p === "/admin") p = "/admin.html";
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    const target = !err && st.isFile() ? file : path.join(PUBLIC, "index.html");
    const ext = path.extname(target);
    const noCache = [".html", ".webmanifest"].includes(ext) || target.endsWith("sw.js");
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": noCache ? "no-cache" : "public, max-age=604800", "X-Content-Type-Options": "nosniff" });
    fs.createReadStream(target).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (!url.pathname.startsWith("/api/")) {
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
    if (url.pathname.startsWith("/files/")) return ACADEMY.serveFile(req, res, url.pathname);
    return serveStatic(req, res, url.pathname);
  }
  try {
    const r = routes.find((x) => x.method === req.method && x.re.test(url.pathname));
    if (!r) throw new HttpError(404, "Topilmadi");
    const m = url.pathname.match(r.re); const params = {}; r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "") || null;
    let account = null;
    if (token) account = db.prepare("SELECT a.* FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token=?").get(token) || null;
    if (r.auth && !account) throw new HttpError(401, "Iltimos, akkauntga kiring");
    if (r.admin && account.role !== "admin") throw new HttpError(403, "Faqat admin uchun");
    if (r.teacher && !ACADEMY.isTeacher(account)) throw new HttpError(403, "Faqat o‘qituvchi uchun");
    const body = r.raw ? {} : ["POST", "PUT"].includes(req.method) ? await readBody(req) : {};
    const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress;
    const out = await r.handler({ req, body, params, query: Object.fromEntries(url.searchParams), account, token, ip });
    send(res, 200, out);
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    send(res, e.code || 500, { error: e instanceof HttpError ? e.message : "Serverda xatolik" });
  }
});

/* ======================= CLI ======================= */
const args = process.argv.slice(2);
if (args[0] === "--create-admin") {
  const phone = normPhone(args[1]); const pass = args[2] || "";
  if (!phone || pass.length < 6) { console.log("Foydalanish: node server/server.js --create-admin 998901234567 ParolKamida6"); process.exit(1); }
  const ex = db.prepare("SELECT * FROM accounts WHERE phone=?").get(phone);
  const salt = crypto.randomBytes(16).toString("hex");
  if (ex) db.prepare("UPDATE accounts SET role='admin', pass_hash=?, salt=? WHERE id=?").run(hashPass(pass, salt), salt, ex.id);
  else db.prepare("INSERT INTO accounts(phone,pass_hash,salt,parent_name,role,created_at) VALUES(?,?,?,?,?,?)").run(phone, hashPass(pass, salt), salt, "Admin", "admin", now());
  console.log("Admin tayyor:", phone); process.exit(0);
} else {
  server.requestTimeout = 4 * 3600 * 1000; // katta video yuklash uchun
  server.listen(PORT, () => console.log(`Little Star server: http://localhost:${PORT}  (admin panel: /admin)`));
}
