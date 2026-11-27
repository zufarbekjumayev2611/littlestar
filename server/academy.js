// Little Star — "Olimpiada akademiyasi": onlayn kurslar (Al-Xorazmiy olimpiadasi 7–8-sinf va boshqalar)
// Darslar jadvali, jonli dars (video konferensiya havolasi), video yechimlar, materiallar,
// uyga vazifa topshirish va o‘qituvchi tomonidan tekshirish, savol-javob, davomat, jurnal.
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

module.exports = function academy({ db, route, HttpError, bad, str, now, DATA_DIR }) {
  const UPLOADS = path.join(DATA_DIR, "uploads");
  fs.mkdirSync(UPLOADS, { recursive: true });

  db.exec(`
  CREATE TABLE IF NOT EXISTS courses(
    id INTEGER PRIMARY KEY, title TEXT NOT NULL, grade INTEGER DEFAULT 7, description TEXT DEFAULT '',
    live_url TEXT DEFAULT '', published INTEGER NOT NULL DEFAULT 1, open_join INTEGER NOT NULL DEFAULT 0,
    sort INTEGER DEFAULT 0, created_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS enrollments(
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL, PRIMARY KEY(course_id, child_id));
  CREATE TABLE IF NOT EXISTS lessons(
    id INTEGER PRIMARY KEY, course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL, starts_at INTEGER DEFAULT 0, duration_min INTEGER DEFAULT 90, body TEXT DEFAULT '',
    live_url TEXT DEFAULT '', hw_text TEXT DEFAULT '', hw_due INTEGER DEFAULT 0, hw_max INTEGER DEFAULT 10,
    solutions_mode TEXT DEFAULT 'after_due', published INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id, starts_at);
  CREATE TABLE IF NOT EXISTS files(
    id INTEGER PRIMARY KEY, key TEXT NOT NULL, name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL,
    account_id INTEGER, created_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS lesson_items(
    id INTEGER PRIMARY KEY, lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    kind TEXT NOT NULL, title TEXT DEFAULT '', file_id INTEGER REFERENCES files(id) ON DELETE SET NULL,
    url TEXT DEFAULT '', ord INTEGER DEFAULT 0);
  CREATE TABLE IF NOT EXISTS submissions(
    id INTEGER PRIMARY KEY, lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE, text TEXT DEFAULT '', files TEXT DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'submitted', score REAL, feedback TEXT DEFAULT '', feedback_files TEXT DEFAULT '[]',
    submitted_at INTEGER NOT NULL, checked_at INTEGER, UNIQUE(lesson_id, child_id));
  CREATE TABLE IF NOT EXISTS lesson_comments(
    id INTEGER PRIMARY KEY, lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE, child_id INTEGER, text TEXT NOT NULL, created_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS attendance(
    lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE, joined_at INTEGER NOT NULL,
    PRIMARY KEY(lesson_id, child_id));
  CREATE TABLE IF NOT EXISTS announcements(
    id INTEGER PRIMARY KEY, course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    text TEXT NOT NULL, created_at INTEGER NOT NULL);
  `);

  // Olimpiadalar (yo‘nalishlar): har biri ichida sinflar bo‘yicha kurslar bo‘ladi
  db.exec(`CREATE TABLE IF NOT EXISTS olympiads(
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '', icon TEXT DEFAULT '🏆',
    published INTEGER NOT NULL DEFAULT 1, sort INTEGER DEFAULT 0, created_at INTEGER NOT NULL);`);
  if (!db.prepare("PRAGMA table_info(courses)").all().some((c) => c.name === "olympiad_id"))
    db.exec("ALTER TABLE courses ADD COLUMN olympiad_id INTEGER");
  if (db.prepare("SELECT COUNT(*) n FROM olympiads").get().n === 0) {
    const r = db.prepare("INSERT INTO olympiads(name,description,icon,sort,created_at) VALUES(?,?,?,?,?)").run(
      "Al-Xorazmiy olimpiadasi", "Al-Xorazmiy nomidagi matematika olimpiadasiga tayyorlov: 7- va 8-sinflar uchun jonli onlayn darslar, video yechimlar, uyga vazifalar.", "🧮", 1, now());
    db.prepare("UPDATE courses SET olympiad_id=? WHERE olympiad_id IS NULL").run(Number(r.lastInsertRowid));
  }
  const firstOlympiad = () => (db.prepare("SELECT id FROM olympiads ORDER BY sort,id LIMIT 1").get() || {}).id || null;

  // Kurs bir nechta sinf uchun bo‘lishi mumkin (grade..grade_to); narx va to‘lov muddati
  const addCol = (t, col, def) => { if (!db.prepare(`PRAGMA table_info(${t})`).all().some((c) => c.name === col)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${col} ${def}`); };
  addCol("courses", "grade_to", "INTEGER");
  addCol("courses", "price", "INTEGER NOT NULL DEFAULT 0");        // so‘m; 0 = bepul
  addCol("courses", "access_days", "INTEGER NOT NULL DEFAULT 30"); // bitta to‘lov necha kunga; 0 = butun kurs uchun
  addCol("enrollments", "paid_until", "INTEGER NOT NULL DEFAULT -1"); // -1 cheksiz, 0 to‘lanmagan, >0 shu vaqtgacha
  db.exec(`
  CREATE TABLE IF NOT EXISTS orders(
    id INTEGER PRIMARY KEY, course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE, account_id INTEGER NOT NULL,
    amount INTEGER NOT NULL, days INTEGER NOT NULL, provider TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new',
    created_at INTEGER NOT NULL, paid_at INTEGER);
  CREATE TABLE IF NOT EXISTS payments(
    id INTEGER PRIMARY KEY, provider TEXT NOT NULL, ext_id TEXT NOT NULL, order_id INTEGER NOT NULL REFERENCES orders(id),
    amount INTEGER NOT NULL, state INTEGER NOT NULL, create_time INTEGER NOT NULL, perform_time INTEGER DEFAULT 0,
    cancel_time INTEGER DEFAULT 0, reason INTEGER, ptime INTEGER DEFAULT 0, UNIQUE(provider, ext_id));
  `);

  const ALX_DESC = "Al-Xorazmiy nomidagi matematika olimpiadasiga tayyorlov kursi (7–8-sinflar). Jonli onlayn darslar, video yechimlar va uyga vazifalar.";
  if (db.prepare("SELECT COUNT(*) n FROM courses").get().n === 0) {
    db.prepare("INSERT INTO courses(title,grade,grade_to,description,sort,created_at,olympiad_id) VALUES(?,?,?,?,?,?,?)")
      .run("Al-Xorazmiy olimpiadasi (7–8-sinflar)", 7, 8, ALX_DESC, 1, now(), firstOlympiad());
  } else {
    // Oldingi versiyadagi alohida 7- va 8-sinf kurslarini bitta kursga birlashtirish (bir marta)
    const c7 = db.prepare("SELECT id FROM courses WHERE title='Al-Xorazmiy olimpiadasi — 7-sinf'").get();
    const c8 = db.prepare("SELECT id FROM courses WHERE title='Al-Xorazmiy olimpiadasi — 8-sinf'").get();
    if (c7 && c8) {
      db.exec("BEGIN");
      try {
        db.prepare("UPDATE lessons SET course_id=? WHERE course_id=?").run(c7.id, c8.id);
        db.prepare("UPDATE announcements SET course_id=? WHERE course_id=?").run(c7.id, c8.id);
        db.prepare("INSERT OR IGNORE INTO enrollments(course_id,child_id,status,created_at,paid_until) SELECT ?,child_id,status,created_at,paid_until FROM enrollments WHERE course_id=?").run(c7.id, c8.id);
        db.prepare("DELETE FROM courses WHERE id=?").run(c8.id);
        db.prepare("UPDATE courses SET title='Al-Xorazmiy olimpiadasi (7–8-sinflar)', grade=7, grade_to=8, description=? WHERE id=?").run(ALX_DESC, c7.id);
        db.exec("COMMIT");
      } catch (e) { db.exec("ROLLBACK"); throw e; }
    }
  }

  /* ---------------- yordamchilar ---------------- */
  const isTeacher = (a) => a && (a.role === "admin" || a.role === "teacher");
  const KINDS = ["material", "video", "homework", "solution"];
  const SOL_MODES = ["after_due", "now", "hidden"];
  const cleanUrl = (u) => { u = str(u, 500); if (!u) return ""; if (!/^https?:\/\//i.test(u)) bad("Havola http:// yoki https:// bilan boshlanishi kerak"); return u; };
  const fileUrl = (f) => `/files/${f.id}/${f.key}/${encodeURIComponent(f.name)}`;
  const pubFile = (f) => f && { id: f.id, name: f.name, mime: f.mime, size: f.size, url: fileUrl(f) };
  const getFile = db.prepare("SELECT * FROM files WHERE id=?");
  const filesFromIds = (json) => { try { return JSON.parse(json || "[]").map((id) => pubFile(getFile.get(id))).filter(Boolean); } catch { return []; } };
  function ownFiles(account, ids, max = 15) {
    if (!Array.isArray(ids)) return [];
    const out = [];
    for (const raw of ids.slice(0, max)) {
      const f = getFile.get(+raw);
      if (!f || (f.account_id !== account.id && !isTeacher(account))) bad("Fayl topilmadi, qayta yuklang");
      out.push(f.id);
    }
    return out;
  }
  function ownChild(account, id) {
    const c = db.prepare("SELECT * FROM children WHERE id=? AND account_id=?").get(+id, account.id);
    if (!c) bad("O‘quvchi profilini tanlang"); return c;
  }
  const enrollment = (courseId, childId) => db.prepare("SELECT status, paid_until FROM enrollments WHERE course_id=? AND child_id=?").get(courseId, childId);
  // O‘quvchining kursdagi holati: active | pending | removed | unpaid | expired | null
  function accessState(c, e) {
    if (!e) return null;
    if (e.status === "removed") return "removed";
    if (c.price > 0) {
      if (e.status === "active" && (e.paid_until === -1 || e.paid_until > now())) return "active";
      return e.paid_until > 0 ? "expired" : "unpaid";
    }
    return e.status;
  }
  const courseById = (id) => db.prepare("SELECT * FROM courses WHERE id=?").get(id);
  const gradeLabel = (c) => (c.grade_to && c.grade_to !== c.grade ? `${c.grade}–${c.grade_to}` : `${c.grade}`) + "-sinf";
  function lessonFor(account, lessonId, childId) {
    const l = db.prepare("SELECT l.*, c.live_url course_live, c.title course_title FROM lessons l JOIN courses c ON c.id=l.course_id WHERE l.id=?").get(+lessonId);
    if (!l) throw new HttpError(404, "Dars topilmadi");
    if (isTeacher(account) && !childId) return { l, child: null };
    const child = ownChild(account, childId);
    if (!isTeacher(account)) {
      const st = accessState(courseById(l.course_id), enrollment(l.course_id, child.id));
      if (st !== "active") throw new HttpError(403, st === "expired" ? "Kurs uchun to‘lov muddati tugagan. Uzaytirish uchun to‘lov qiling." : st === "unpaid" ? "Bu kurs pullik. Avval to‘lov qiling." : "Bu kursga hali qabul qilinmagansiz");
      if (!l.published) throw new HttpError(404, "Dars topilmadi");
    }
    return { l, child };
  }
  const solutionsOpen = (l) => l.solutions_mode === "now" || (l.solutions_mode === "after_due" && (!l.hw_due || now() >= l.hw_due));
  function items(lessonId, { hideSolutions = false } = {}) {
    return db.prepare("SELECT * FROM lesson_items WHERE lesson_id=? ORDER BY ord,id").all(lessonId)
      .filter((i) => !(hideSolutions && i.kind === "solution"))
      .map((i) => ({ id: i.id, kind: i.kind, title: i.title, url: i.url, file: i.file_id ? pubFile(getFile.get(i.file_id)) : null }));
  }
  function comments(lessonId) {
    return db.prepare(`SELECT m.id, m.text, m.created_at, m.account_id, a.role, a.parent_name, c.name child_name
      FROM lesson_comments m LEFT JOIN accounts a ON a.id=m.account_id LEFT JOIN children c ON c.id=m.child_id
      WHERE m.lesson_id=? ORDER BY m.id`).all(lessonId)
      .map((m) => ({ id: m.id, text: m.text, created_at: m.created_at, teacher: m.role === "admin" || m.role === "teacher", author: m.role === "admin" || m.role === "teacher" ? "O‘qituvchi" : (m.child_name || m.parent_name || "O‘quvchi") }));
  }
  const pubSub = (s) => s && { id: s.id, text: s.text, files: filesFromIds(s.files), status: s.status, score: s.score, feedback: s.feedback, feedback_files: filesFromIds(s.feedback_files), submitted_at: s.submitted_at, checked_at: s.checked_at };

  /* ---------------- fayl yuklash (oqim bilan, JSON emas) ---------------- */
  const MEDIA_INLINE = /^(image\/(png|jpe?g|gif|webp)|video\/(mp4|webm|ogg|quicktime)|audio\/(mpeg|mp4|ogg|wav|webm)|application\/pdf)$/;
  route("POST", "/api/upload", ({ req, account, query }) => new Promise((resolve, reject) => {
    const teacher = isTeacher(account);
    const max = teacher ? 2 * 1024 ** 3 : 25 * 1024 ** 2;
    const name = str(query.name || "fayl", 150).replace(/[\\/\0]/g, "_") || "fayl";
    let mime = String(req.headers["content-type"] || "application/octet-stream").split(";")[0].trim().toLowerCase();
    if (!teacher && !/^(image\/(png|jpe?g|gif|webp|heic|heif)|application\/pdf)$/.test(mime))
      return reject(new HttpError(400, "Faqat rasm (JPG, PNG) yoki PDF yuklash mumkin"));
    if (!/^[\w.+-]+\/[\w.+-]+$/.test(mime)) mime = "application/octet-stream";
    const len = +req.headers["content-length"] || 0;
    if (len > max) return reject(new HttpError(413, `Fayl juda katta (ko‘pi bilan ${Math.round(max / 1024 ** 2)} MB)`));
    const key = crypto.randomBytes(18).toString("hex");
    const tmp = path.join(UPLOADS, "tmp-" + key);
    const out = fs.createWriteStream(tmp);
    let size = 0, failed = false;
    const fail = (e) => { if (failed) return; failed = true; out.destroy(); fs.rm(tmp, { force: true }, () => {}); reject(e); };
    req.on("data", (c) => { size += c.length; if (size > max) { fail(new HttpError(413, "Fayl juda katta")); req.destroy(); } });
    req.on("error", fail); out.on("error", fail);
    req.pipe(out);
    out.on("finish", () => {
      if (failed) return;
      if (!size) { fs.rm(tmp, { force: true }, () => {}); return reject(new HttpError(400, "Fayl bo‘sh")); }
      const r = db.prepare("INSERT INTO files(key,name,mime,size,account_id,created_at) VALUES(?,?,?,?,?,?)").run(key, name, mime, size, account.id, now());
      const id = Number(r.lastInsertRowid);
      fs.renameSync(tmp, path.join(UPLOADS, `${id}-${key}`));
      resolve(pubFile(getFile.get(id)));
    });
  }), { auth: true, raw: true });

  // /files/:id/:key/:name — kalit tasodifiy va uzun, shuning uchun havolani bilganlargina ochadi.
  // Video ko‘rishda oldinga/orqaga o‘tish uchun Range so‘rovlari qo‘llab-quvvatlanadi.
  function serveFile(req, res, pathname) {
    const m = pathname.match(/^\/files\/(\d+)\/([a-f0-9]{36})(?:\/[^/]*)?$/);
    const f = m && db.prepare("SELECT * FROM files WHERE id=? AND key=?").get(+m[1], m[2]);
    const file = f && path.join(UPLOADS, `${f.id}-${f.key}`);
    if (!f || !fs.existsSync(file)) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("Fayl topilmadi"); }
    const inline = MEDIA_INLINE.test(f.mime);
    const size = fs.statSync(file).size;
    const headers = {
      "Content-Type": inline ? f.mime : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
    };
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
    if (range && (range[1] || range[2])) {
      let start = range[1] ? +range[1] : size - +range[2];
      let end = range[1] && range[2] ? Math.min(+range[2], size - 1) : size - 1;
      if (start < 0) start = 0;
      if (start > end || start >= size) { res.writeHead(416, { "Content-Range": `bytes */${size}` }); return res.end(); }
      res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1 });
      if (req.method === "HEAD") return res.end();
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...headers, "Content-Length": size });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
  }

  /* ================= O‘QUVCHI ================= */
  route("GET", "/api/academy/olympiads", ({ account, query }) => {
    const child = query.child ? ownChild(account, query.child) : null;
    return db.prepare("SELECT id,name,description,icon FROM olympiads WHERE published=1 ORDER BY sort,id").all().map((o) => ({
      ...o,
      courses: db.prepare("SELECT COUNT(*) n FROM courses WHERE olympiad_id=? AND published=1").get(o.id).n,
      grades: [...new Set(db.prepare("SELECT grade, grade_to FROM courses WHERE olympiad_id=? AND published=1").all(o.id).flatMap((r) => { const a = []; for (let g = r.grade; g <= (r.grade_to || r.grade); g++) a.push(g); return a; }))].sort((x, y) => x - y),
      mine: child ? db.prepare("SELECT c.*, e.status es, e.paid_until FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE c.olympiad_id=? AND e.child_id=?").all(o.id, child.id).filter((r) => accessState(r, { status: r.es, paid_until: r.paid_until }) === "active").length : 0,
    }));
  }, { auth: true });

  route("GET", "/api/academy/courses", ({ account, query }) => {
    const child = query.child ? ownChild(account, query.child) : null;
    const oid = +query.olympiad || 0;
    return db.prepare("SELECT id,title,grade,grade_to,description,open_join,olympiad_id,price,access_days FROM courses WHERE published=1 AND (?=0 OR olympiad_id=?) ORDER BY sort,id").all(oid, oid).map((c) => ({
      ...c, grade_label: gradeLabel(c),
      paid_until: child ? ((enrollment(c.id, child.id) || {}).paid_until ?? null) : null,
      lessons: db.prepare("SELECT COUNT(*) n FROM lessons WHERE course_id=? AND published=1").get(c.id).n,
      next: db.prepare("SELECT id,title,starts_at FROM lessons WHERE course_id=? AND published=1 AND starts_at>? ORDER BY starts_at LIMIT 1").get(c.id, now() - 3 * 3600) || null,
      status: child ? accessState(c, enrollment(c.id, child.id)) : null,
    }));
  }, { auth: true });

  route("POST", "/api/academy/courses/:id/join", ({ account, params, body }) => {
    const child = ownChild(account, body.child);
    const c = db.prepare("SELECT * FROM courses WHERE id=? AND published=1").get(+params.id); if (!c) throw new HttpError(404, "Kurs topilmadi");
    if (c.price > 0) bad("Bu kurs pullik. “To‘lash” tugmasi orqali to‘lov qiling.");
    const e = enrollment(c.id, child.id);
    if (e && e.status === "removed") bad("Kursga qo‘shilish uchun o‘qituvchiga murojaat qiling");
    if (!e) db.prepare("INSERT INTO enrollments(course_id,child_id,status,created_at) VALUES(?,?,?,?)").run(c.id, child.id, c.open_join ? "active" : "pending", now());
    return { status: accessState(c, enrollment(c.id, child.id)) };
  }, { auth: true });

  route("GET", "/api/academy/courses/:id", ({ account, params, query }) => {
    const c = db.prepare("SELECT c.*,o.name olympiad FROM courses c LEFT JOIN olympiads o ON o.id=c.olympiad_id WHERE c.id=? AND c.published=1").get(+params.id); if (!c) throw new HttpError(404, "Kurs topilmadi");
    const child = ownChild(account, query.child);
    const e = enrollment(c.id, child.id);
    const st = accessState(c, e);
    if (!isTeacher(account) && st !== "active") return { course: { id: c.id, title: c.title, description: c.description, price: c.price, access_days: c.access_days, olympiad_id: c.olympiad_id }, status: st };
    const lessons = db.prepare("SELECT id,title,starts_at,duration_min,hw_text,hw_due,hw_max,(SELECT COUNT(*) FROM lesson_items i WHERE i.lesson_id=lessons.id AND i.kind IN ('video','solution')) videos FROM lessons WHERE course_id=? AND published=1 ORDER BY starts_at,id").all(c.id)
      .map((l) => {
        const s = db.prepare("SELECT status,score FROM submissions WHERE lesson_id=? AND child_id=?").get(l.id, child.id);
        return { id: l.id, title: l.title, starts_at: l.starts_at, duration_min: l.duration_min, has_hw: !!l.hw_text || !!db.prepare("SELECT 1 FROM lesson_items WHERE lesson_id=? AND kind='homework'").get(l.id), hw_due: l.hw_due, hw_max: l.hw_max, videos: l.videos, sub: s || null };
      });
    const ann = db.prepare("SELECT id,text,created_at FROM announcements WHERE course_id=? ORDER BY id DESC LIMIT 20").all(c.id);
    return { course: { id: c.id, title: c.title, description: c.description, grade: c.grade, grade_label: gradeLabel(c), has_live: !!c.live_url, olympiad_id: c.olympiad_id, olympiad: c.olympiad, price: c.price, access_days: c.access_days, paid_until: e ? e.paid_until : -1 }, status: "active", lessons, announcements: ann, server_time: now() };
  }, { auth: true });

  route("GET", "/api/academy/lessons/:id", ({ account, params, query }) => {
    const { l, child } = lessonFor(account, params.id, query.child);
    const open = solutionsOpen(l) || isTeacher(account);
    const sub = child && db.prepare("SELECT * FROM submissions WHERE lesson_id=? AND child_id=?").get(l.id, child.id);
    return {
      lesson: { id: l.id, course_id: l.course_id, course_title: l.course_title, title: l.title, starts_at: l.starts_at, duration_min: l.duration_min, body: l.body, live_url: l.live_url || l.course_live || "", hw_text: l.hw_text, hw_due: l.hw_due, hw_max: l.hw_max, solutions_mode: l.solutions_mode },
      items: items(l.id, { hideSolutions: !open }), solutions_open: open,
      submission: pubSub(sub), comments: comments(l.id), server_time: now(),
    };
  }, { auth: true });

  route("POST", "/api/academy/lessons/:id/join", ({ account, params, body }) => {
    const { l, child } = lessonFor(account, params.id, body.child);
    if (child) db.prepare("INSERT OR IGNORE INTO attendance(lesson_id,child_id,joined_at) VALUES(?,?,?)").run(l.id, child.id, now());
    return { url: l.live_url || l.course_live || "" };
  }, { auth: true });

  route("POST", "/api/academy/lessons/:id/submit", ({ account, params, body }) => {
    const { l, child } = lessonFor(account, params.id, body.child);
    if (!child) bad("O‘quvchi profilini tanlang");
    const text = str(body.text, 20000); const files = ownFiles(account, body.files, 20);
    if (!text && !files.length) bad("Javob matnini yozing yoki yechim rasmini yuklang");
    const ex = db.prepare("SELECT * FROM submissions WHERE lesson_id=? AND child_id=?").get(l.id, child.id);
    if (ex && ex.status === "checked") bad("Vazifa allaqachon tekshirilgan. O‘zgartirish uchun o‘qituvchiga yozing.");
    if (ex) db.prepare("UPDATE submissions SET text=?,files=?,status='submitted',submitted_at=? WHERE id=?").run(text, JSON.stringify(files), now(), ex.id);
    else db.prepare("INSERT INTO submissions(lesson_id,child_id,text,files,submitted_at) VALUES(?,?,?,?,?)").run(l.id, child.id, text, JSON.stringify(files), now());
    return { submission: pubSub(db.prepare("SELECT * FROM submissions WHERE lesson_id=? AND child_id=?").get(l.id, child.id)) };
  }, { auth: true });

  route("POST", "/api/academy/lessons/:id/comments", ({ account, params, body }) => {
    const { l, child } = lessonFor(account, params.id, body.child);
    const text = str(body.text, 3000); if (!text) bad("Xabar bo‘sh");
    db.prepare("INSERT INTO lesson_comments(lesson_id,account_id,child_id,text,created_at) VALUES(?,?,?,?,?)").run(l.id, account.id, child ? child.id : null, text, now());
    return { comments: comments(l.id) };
  }, { auth: true });

  /* ================= O‘QITUVCHI ================= */
  const TCH = { auth: true, teacher: true };
  const n = (sql, ...a) => db.prepare(sql).get(...a).n;

  route("GET", "/api/teach/olympiads", () => db.prepare("SELECT o.*, (SELECT COUNT(*) FROM courses c WHERE c.olympiad_id=o.id) courses FROM olympiads o ORDER BY sort,id").all(), TCH);
  function olympiadInput(b) {
    const name = str(b.name, 150); if (!name) bad("Olimpiada nomini yozing");
    return { name, description: str(b.description, 3000), icon: str(b.icon, 8) || "🏆", published: b.published ? 1 : 0, sort: +b.sort || 0 };
  }
  route("POST", "/api/teach/olympiads", ({ body }) => {
    const o = olympiadInput(body);
    if (!o.sort) o.sort = (db.prepare("SELECT MAX(sort) m FROM olympiads").get().m || 0) + 1; // yangi olimpiada ro‘yxat oxiriga
    const r = db.prepare("INSERT INTO olympiads(name,description,icon,published,sort,created_at) VALUES(?,?,?,?,?,?)").run(o.name, o.description, o.icon, o.published, o.sort, now());
    return { id: Number(r.lastInsertRowid) };
  }, TCH);
  route("PUT", "/api/teach/olympiads/:id", ({ body, params }) => {
    const o = olympiadInput(body);
    db.prepare("UPDATE olympiads SET name=?,description=?,icon=?,published=?,sort=? WHERE id=?").run(o.name, o.description, o.icon, o.published, o.sort, +params.id);
    return { ok: true };
  }, TCH);
  route("DELETE", "/api/teach/olympiads/:id", ({ params }) => {
    if (n("SELECT COUNT(*) n FROM courses WHERE olympiad_id=?", +params.id)) bad("Avval bu olimpiadadagi kurslarni o‘chiring yoki boshqa olimpiadaga o‘tkazing");
    db.prepare("DELETE FROM olympiads WHERE id=?").run(+params.id); return { ok: true };
  }, { auth: true, admin: true });

  route("GET", "/api/teach/courses", () => db.prepare("SELECT * FROM courses ORDER BY sort,id").all().map((c) => ({
    ...c,
    students: n("SELECT COUNT(*) n FROM enrollments WHERE course_id=? AND status='active'", c.id),
    pending: n("SELECT COUNT(*) n FROM enrollments WHERE course_id=? AND status='pending'", c.id),
    lessons: n("SELECT COUNT(*) n FROM lessons WHERE course_id=?", c.id),
    unchecked: n("SELECT COUNT(*) n FROM submissions s JOIN lessons l ON l.id=s.lesson_id WHERE l.course_id=? AND s.status='submitted'", c.id),
  })), TCH);

  function courseInput(b) {
    const title = str(b.title, 150); if (!title) bad("Kurs nomini yozing");
    const olympiad_id = +b.olympiad_id || null;
    if (olympiad_id && !db.prepare("SELECT 1 FROM olympiads WHERE id=?").get(olympiad_id)) bad("Olimpiadani tanlang");
    const grade = Math.max(1, Math.min(11, +b.grade || 7));
    const grade_to = Math.max(grade, Math.min(11, +b.grade_to || grade));
    return { title, olympiad_id, grade, grade_to, price: Math.max(0, Math.min(100000000, Math.round(+b.price || 0))), access_days: Math.max(0, Math.min(3650, Math.round(+b.access_days || 0))), description: str(b.description, 3000), live_url: cleanUrl(b.live_url), published: b.published ? 1 : 0, open_join: b.open_join ? 1 : 0, sort: +b.sort || 0 };
  }
  route("POST", "/api/teach/courses", ({ body }) => {
    const c = courseInput(body);
    const r = db.prepare("INSERT INTO courses(title,grade,grade_to,price,access_days,description,live_url,published,open_join,sort,created_at,olympiad_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(c.title, c.grade, c.grade_to, c.price, c.access_days, c.description, c.live_url, c.published, c.open_join, c.sort, now(), c.olympiad_id);
    return { id: Number(r.lastInsertRowid) };
  }, TCH);
  route("PUT", "/api/teach/courses/:id", ({ body, params }) => {
    const c = courseInput(body);
    db.prepare("UPDATE courses SET title=?,grade=?,grade_to=?,price=?,access_days=?,description=?,live_url=?,published=?,open_join=?,sort=?,olympiad_id=? WHERE id=?").run(c.title, c.grade, c.grade_to, c.price, c.access_days, c.description, c.live_url, c.published, c.open_join, c.sort, c.olympiad_id, +params.id);
    return { ok: true };
  }, TCH);
  route("DELETE", "/api/teach/courses/:id", ({ params }) => { db.prepare("DELETE FROM courses WHERE id=?").run(+params.id); return { ok: true }; }, { auth: true, admin: true });

  route("GET", "/api/teach/courses/:id", ({ params }) => {
    const c = db.prepare("SELECT * FROM courses WHERE id=?").get(+params.id); if (!c) throw new HttpError(404, "Topilmadi");
    const lessons = db.prepare(`SELECT l.id,l.title,l.starts_at,l.duration_min,l.hw_due,l.hw_max,l.published,
        (SELECT COUNT(*) FROM submissions s WHERE s.lesson_id=l.id) subs,
        (SELECT COUNT(*) FROM submissions s WHERE s.lesson_id=l.id AND s.status='submitted') unchecked,
        (SELECT COUNT(*) FROM attendance a WHERE a.lesson_id=l.id) attended
      FROM lessons l WHERE l.course_id=? ORDER BY l.starts_at,l.id`).all(c.id);
    const students = db.prepare(`SELECT e.status, e.created_at, e.paid_until, ch.id child_id, ch.name, ch.grade, ch.region, ch.district, ch.school, a.phone, a.parent_name
      FROM enrollments e JOIN children ch ON ch.id=e.child_id JOIN accounts a ON a.id=ch.account_id
      WHERE e.course_id=? ORDER BY CASE e.status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END, ch.name`).all(c.id);
    const ann = db.prepare("SELECT * FROM announcements WHERE course_id=? ORDER BY id DESC").all(c.id);
    return { course: c, lessons, students, announcements: ann };
  }, TCH);

  route("PUT", "/api/teach/courses/:id/students/:child", ({ params, body }) => {
    const st = ["active", "pending", "removed"].includes(body.status) ? body.status : bad("Holat noto‘g‘ri");
    const c = courseById(+params.id); if (!c) throw new HttpError(404, "Kurs topilmadi");
    const ex = enrollment(c.id, +params.child);
    db.prepare("INSERT INTO enrollments(course_id,child_id,status,created_at,paid_until) VALUES(?,?,?,?,?) ON CONFLICT(course_id,child_id) DO UPDATE SET status=excluded.status")
      .run(c.id, +params.child, st, now(), c.price > 0 ? 0 : -1);
    // Naqd to‘lov yoki bepul ruxsat: grant_days > 0 — shuncha kunga uzaytirish, -1 — cheksiz, 0 — to‘lovni bekor qilish
    if ("grant_days" in body) {
      const d = Math.round(+body.grant_days);
      const cur = ex ? ex.paid_until : 0;
      const pu = d === -1 ? -1 : d > 0 ? Math.max(now(), cur > 0 ? cur : 0) + d * 86400 : 0;
      db.prepare("UPDATE enrollments SET paid_until=?, status='active' WHERE course_id=? AND child_id=?").run(pu, c.id, +params.child);
    }
    return { ok: true };
  }, TCH);
  // Telefon raqami bo‘yicha o‘quvchini qo‘lda qo‘shish (shu akkauntdagi bolalardan biri tanlanadi)
  route("GET", "/api/teach/find-children", ({ query }) => {
    let d = String(query.phone || "").replace(/\D/g, ""); if (d.length === 9) d = "998" + d;
    return db.prepare("SELECT ch.id, ch.name, ch.grade, ch.region, a.phone FROM children ch JOIN accounts a ON a.id=ch.account_id WHERE a.phone=?").all(d);
  }, TCH);

  route("POST", "/api/teach/courses/:id/announcements", ({ params, body }) => {
    const text = str(body.text, 3000); if (!text) bad("E’lon matni bo‘sh");
    db.prepare("INSERT INTO announcements(course_id,text,created_at) VALUES(?,?,?)").run(+params.id, text, now()); return { ok: true };
  }, TCH);
  route("DELETE", "/api/teach/announcements/:id", ({ params }) => { db.prepare("DELETE FROM announcements WHERE id=?").run(+params.id); return { ok: true }; }, TCH);

  function lessonInput(b) {
    const title = str(b.title, 200); if (!title) bad("Dars mavzusini yozing");
    return {
      title, starts_at: Math.max(0, +b.starts_at || 0), duration_min: Math.max(10, Math.min(600, +b.duration_min || 90)),
      body: str(b.body, 50000), live_url: cleanUrl(b.live_url), hw_text: str(b.hw_text, 50000), hw_due: Math.max(0, +b.hw_due || 0),
      hw_max: Math.max(1, Math.min(1000, +b.hw_max || 10)), solutions_mode: SOL_MODES.includes(b.solutions_mode) ? b.solutions_mode : "after_due",
      published: b.published ? 1 : 0,
    };
  }
  function saveItems(lessonId, list, account) {
    if (!Array.isArray(list)) return;
    const clean = list.slice(0, 100).map((i) => {
      const kind = KINDS.includes(i.kind) ? i.kind : "material";
      const file_id = i.file_id ? ownFiles(account, [i.file_id])[0] : null;
      const url = file_id ? "" : cleanUrl(i.url);
      if (!file_id && !url) bad("Material uchun fayl yoki havola kerak");
      return { kind, title: str(i.title, 200), file_id, url };
    });
    db.prepare("DELETE FROM lesson_items WHERE lesson_id=?").run(lessonId);
    const ins = db.prepare("INSERT INTO lesson_items(lesson_id,kind,title,file_id,url,ord) VALUES(?,?,?,?,?,?)");
    clean.forEach((i, k) => ins.run(lessonId, i.kind, i.title, i.file_id, i.url, k));
  }
  const tx = (fn) => { db.exec("BEGIN"); try { const r = fn(); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; } };

  route("POST", "/api/teach/courses/:id/lessons", ({ params, body, account }) => tx(() => {
    if (!db.prepare("SELECT 1 FROM courses WHERE id=?").get(+params.id)) throw new HttpError(404, "Kurs topilmadi");
    const l = lessonInput(body);
    const r = db.prepare("INSERT INTO lessons(course_id,title,starts_at,duration_min,body,live_url,hw_text,hw_due,hw_max,solutions_mode,published,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(+params.id, l.title, l.starts_at, l.duration_min, l.body, l.live_url, l.hw_text, l.hw_due, l.hw_max, l.solutions_mode, l.published, now());
    const id = Number(r.lastInsertRowid); saveItems(id, body.items, account); return { id };
  }), TCH);
  route("PUT", "/api/teach/lessons/:id", ({ params, body, account }) => tx(() => {
    const l = lessonInput(body);
    const r = db.prepare("UPDATE lessons SET title=?,starts_at=?,duration_min=?,body=?,live_url=?,hw_text=?,hw_due=?,hw_max=?,solutions_mode=?,published=? WHERE id=?")
      .run(l.title, l.starts_at, l.duration_min, l.body, l.live_url, l.hw_text, l.hw_due, l.hw_max, l.solutions_mode, l.published, +params.id);
    if (!r.changes) throw new HttpError(404, "Dars topilmadi");
    saveItems(+params.id, body.items, account); return { ok: true };
  }), TCH);
  route("DELETE", "/api/teach/lessons/:id", ({ params }) => { db.prepare("DELETE FROM lessons WHERE id=?").run(+params.id); return { ok: true }; }, TCH);
  route("GET", "/api/teach/lessons/:id", ({ params }) => {
    const l = db.prepare("SELECT * FROM lessons WHERE id=?").get(+params.id); if (!l) throw new HttpError(404, "Dars topilmadi");
    const students = db.prepare(`SELECT ch.id child_id, ch.name, a.phone, at.joined_at, s.id sub_id, s.status, s.score, s.submitted_at
      FROM enrollments e JOIN children ch ON ch.id=e.child_id JOIN accounts a ON a.id=ch.account_id
      LEFT JOIN attendance at ON at.lesson_id=? AND at.child_id=ch.id LEFT JOIN submissions s ON s.lesson_id=? AND s.child_id=ch.id
      WHERE e.course_id=? AND e.status='active' ORDER BY ch.name`).all(l.id, l.id, l.course_id);
    return { lesson: l, items: items(l.id), students, comments: comments(l.id) };
  }, TCH);

  route("GET", "/api/teach/submissions", ({ query }) => {
    const status = ["submitted", "checked", "returned"].includes(query.status) ? query.status : "";
    return db.prepare(`SELECT s.id, s.status, s.score, s.submitted_at, s.checked_at, l.id lesson_id, l.title lesson, l.hw_due, l.hw_max, c.id course_id, c.title course, ch.name, ch.grade
      FROM submissions s JOIN lessons l ON l.id=s.lesson_id JOIN courses c ON c.id=l.course_id JOIN children ch ON ch.id=s.child_id
      WHERE (?=0 OR c.id=?) AND (?='' OR s.status=?) AND (?=0 OR l.id=?) ORDER BY s.status='submitted' DESC, s.submitted_at DESC LIMIT 300`)
      .all(+query.course || 0, +query.course || 0, status, status, +query.lesson || 0, +query.lesson || 0);
  }, TCH);
  route("GET", "/api/teach/submissions/:id", ({ params }) => {
    const s = db.prepare(`SELECT s.*, l.title lesson, l.hw_text, l.hw_due, l.hw_max, l.course_id, ch.name, ch.grade, a.phone
      FROM submissions s JOIN lessons l ON l.id=s.lesson_id JOIN children ch ON ch.id=s.child_id JOIN accounts a ON a.id=ch.account_id WHERE s.id=?`).get(+params.id);
    if (!s) throw new HttpError(404, "Topilmadi");
    return { ...pubSub(s), lesson_id: s.lesson_id, lesson: s.lesson, hw_text: s.hw_text, hw_due: s.hw_due, hw_max: s.hw_max, course_id: s.course_id, name: s.name, grade: s.grade, phone: s.phone };
  }, TCH);
  route("PUT", "/api/teach/submissions/:id", ({ params, body, account }) => {
    const s = db.prepare("SELECT s.*, l.hw_max FROM submissions s JOIN lessons l ON l.id=s.lesson_id WHERE s.id=?").get(+params.id); if (!s) throw new HttpError(404, "Topilmadi");
    const status = ["checked", "returned"].includes(body.status) ? body.status : bad("Holat noto‘g‘ri");
    let score = body.score === "" || body.score == null ? null : +body.score;
    if (score != null && !(score >= 0 && score <= s.hw_max)) bad(`Ball 0 dan ${s.hw_max} gacha bo‘lsin`);
    if (status === "checked" && score == null) bad("Ballni kiriting");
    db.prepare("UPDATE submissions SET status=?,score=?,feedback=?,feedback_files=?,checked_at=? WHERE id=?")
      .run(status, score, str(body.feedback, 10000), JSON.stringify(ownFiles(account, body.feedback_files, 20)), now(), s.id);
    return { ok: true };
  }, TCH);

  route("GET", "/api/teach/courses/:id/journal", ({ params }) => {
    const lessons = db.prepare("SELECT id,title,starts_at,hw_max FROM lessons WHERE course_id=? ORDER BY starts_at,id").all(+params.id);
    const students = db.prepare(`SELECT ch.id, ch.name FROM enrollments e JOIN children ch ON ch.id=e.child_id WHERE e.course_id=? AND e.status='active' ORDER BY ch.name`).all(+params.id);
    const subs = db.prepare("SELECT s.lesson_id, s.child_id, s.status, s.score FROM submissions s JOIN lessons l ON l.id=s.lesson_id WHERE l.course_id=?").all(+params.id);
    const att = db.prepare("SELECT a.lesson_id, a.child_id FROM attendance a JOIN lessons l ON l.id=a.lesson_id WHERE l.course_id=?").all(+params.id);
    return { lessons, students, subs, attendance: att };
  }, TCH);

  route("DELETE", "/api/teach/comments/:id", ({ params }) => { db.prepare("DELETE FROM lesson_comments WHERE id=?").run(+params.id); return { ok: true }; }, TCH);

  /* ================= TO‘LOV (Payme, Click) ================= */
  // Sozlamalar muhit o‘zgaruvchilaridan olinadi (README’ga qarang). Kalitlar kodda saqlanmaydi.
  const PAY = {
    payme: { id: process.env.PAYME_MERCHANT_ID || "", key: process.env.PAYME_KEY || "", test: process.env.PAYME_TEST === "1" },
    click: { service: process.env.CLICK_SERVICE_ID || "", merchant: process.env.CLICK_MERCHANT_ID || "", secret: process.env.CLICK_SECRET_KEY || "" },
  };
  const enabled = () => ({ payme: !!(PAY.payme.id && PAY.payme.key), click: !!(PAY.click.service && PAY.click.merchant && PAY.click.secret) });
  const siteUrl = (req) => (process.env.SITE_URL || `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host}`).replace(/\/$/, "");
  const fmtSum = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  // To‘lov muvaffaqiyatli bo‘lganda: o‘quvchi kursga a’zo bo‘ladi (yoki muddati uzayadi)
  function deliver(orderId) {
    const o = db.prepare("SELECT * FROM orders WHERE id=?").get(orderId);
    if (!o || o.status === "paid") return;
    const e = enrollment(o.course_id, o.child_id);
    const cur = e ? e.paid_until : 0;
    const pu = o.days > 0 ? Math.max(now(), cur > 0 ? cur : 0) + o.days * 86400 : -1;
    db.prepare("INSERT INTO enrollments(course_id,child_id,status,created_at,paid_until) VALUES(?,?,'active',?,?) ON CONFLICT(course_id,child_id) DO UPDATE SET status='active', paid_until=excluded.paid_until")
      .run(o.course_id, o.child_id, now(), pu);
    db.prepare("UPDATE orders SET status='paid', paid_at=? WHERE id=?").run(now(), o.id);
  }
  // To‘lov qaytarilganda (Payme bekor qilsa): berilgan muddat olib tashlanadi
  function revoke(orderId) {
    const o = db.prepare("SELECT * FROM orders WHERE id=?").get(orderId);
    if (!o || o.status !== "paid") return;
    const e = enrollment(o.course_id, o.child_id);
    if (e) db.prepare("UPDATE enrollments SET paid_until=? WHERE course_id=? AND child_id=?").run(o.days > 0 && e.paid_until > 0 ? Math.max(1, e.paid_until - o.days * 86400) : 0, o.course_id, o.child_id);
    db.prepare("UPDATE orders SET status='refunded' WHERE id=?").run(o.id);
  }

  route("GET", "/api/academy/pay-options", () => enabled(), { auth: true });
  route("POST", "/api/academy/courses/:id/pay", ({ account, params, body, req }) => {
    const child = ownChild(account, body.child);
    const c = db.prepare("SELECT * FROM courses WHERE id=? AND published=1").get(+params.id); if (!c) throw new HttpError(404, "Kurs topilmadi");
    if (!(c.price > 0)) bad("Bu kurs bepul");
    const e = enrollment(c.id, child.id); if (e && e.status === "removed") bad("Kursga qo‘shilish uchun o‘qituvchiga murojaat qiling");
    const prov = body.provider; if (!enabled()[prov]) bad("Bu to‘lov usuli hozircha ulanmagan");
    const r = db.prepare("INSERT INTO orders(course_id,child_id,account_id,amount,days,provider,created_at) VALUES(?,?,?,?,?,?,?)").run(c.id, child.id, account.id, c.price, c.access_days, prov, now());
    const id = Number(r.lastInsertRowid);
    const back = `${siteUrl(req)}/#olymp-p${id}`;
    let url;
    if (prov === "payme") {
      const params = `m=${PAY.payme.id};ac.order_id=${id};a=${c.price * 100};c=${back};l=uz`;
      url = `${PAY.payme.test ? "https://test.paycom.uz" : "https://checkout.paycom.uz"}/${Buffer.from(params).toString("base64")}`;
    } else {
      url = `https://my.click.uz/services/pay?${new URLSearchParams({ service_id: PAY.click.service, merchant_id: PAY.click.merchant, amount: String(c.price), transaction_param: String(id), return_url: back })}`;
    }
    return { order_id: id, url };
  }, { auth: true });
  route("GET", "/api/academy/orders/:id", ({ account, params }) => {
    const o = db.prepare("SELECT o.*, c.title FROM orders o JOIN courses c ON c.id=o.course_id WHERE o.id=? AND o.account_id=?").get(+params.id, account.id);
    if (!o) throw new HttpError(404, "Buyurtma topilmadi");
    return { id: o.id, status: o.status, course_id: o.course_id, title: o.title, amount: o.amount, child_id: o.child_id };
  }, { auth: true });

  function readRaw(req) {
    return new Promise((res, rej) => { let size = 0; const ch = []; req.on("data", (c) => { size += c.length; if (size > 1e5) { req.destroy(); rej(new HttpError(413, "Katta")); } else ch.push(c); }); req.on("end", () => res(Buffer.concat(ch).toString("utf8"))); req.on("error", rej); });
  }

  /* ---- Payme Merchant API (JSON-RPC). Kabinetda “Endpoint URL”: https://SAYT/api/pay/payme ---- */
  const PM_TIMEOUT = 12 * 3600 * 1000;
  const pmErr = (code, uz, ru, en, data) => { const e = new Error(uz); e.pm = { code, message: { uz, ru: ru || uz, en: en || uz }, data }; return e; };
  const ms = () => Date.now();
  const pmTx = (id) => db.prepare("SELECT * FROM payments WHERE provider='payme' AND ext_id=?").get(String(id));
  function pmCheckOrder(p) {
    const oid = +((p.account || {}).order_id);
    const o = oid && db.prepare("SELECT * FROM orders WHERE id=?").get(oid);
    if (!o) throw pmErr(-31050, "Buyurtma topilmadi", "Заказ не найден", "Order not found", "order_id");
    if (o.status !== "new") throw pmErr(-31051, "Buyurtma to‘langan yoki bekor qilingan", "Заказ уже оплачен или отменён", "Order is not available", "order_id");
    if (+p.amount !== o.amount * 100) throw pmErr(-31001, "Summa noto‘g‘ri", "Неверная сумма", "Incorrect amount");
    return o;
  }
  const pmView = (t) => ({ create_time: t.create_time, perform_time: t.perform_time || 0, cancel_time: t.cancel_time || 0, transaction: String(t.id), state: t.state, reason: t.reason ?? null });
  const pmCancelTimeout = (t) => { db.prepare("UPDATE payments SET state=-1, cancel_time=?, reason=4 WHERE id=?").run(ms(), t.id); db.prepare("UPDATE orders SET status='cancelled' WHERE id=? AND status='new'").run(t.order_id); };
  const PM = {
    CheckPerformTransaction(p) { pmCheckOrder(p); return { allow: true }; },
    CreateTransaction(p) {
      const t = pmTx(p.id);
      if (t) {
        if (t.state !== 1) throw pmErr(-31008, "Amalni bajarib bo‘lmaydi", "Невозможно выполнить операцию", "Unable to perform operation");
        if (ms() - t.create_time > PM_TIMEOUT) { pmCancelTimeout(t); throw pmErr(-31008, "Tranzaksiya muddati o‘tgan", "Истёк срок транзакции", "Transaction expired"); }
        return { create_time: t.create_time, transaction: String(t.id), state: t.state };
      }
      const o = pmCheckOrder(p);
      if (db.prepare("SELECT 1 FROM payments WHERE provider='payme' AND order_id=? AND state=1").get(o.id))
        throw pmErr(-31050, "Buyurtma bo‘yicha boshqa to‘lov kutilmoqda", "По заказу ожидается другая оплата", "Another transaction is pending", "order_id");
      const r = db.prepare("INSERT INTO payments(provider,ext_id,order_id,amount,state,create_time,ptime) VALUES('payme',?,?,?,1,?,?)").run(String(p.id), o.id, +p.amount, ms(), +p.time || ms());
      return { create_time: pmTx(p.id).create_time, transaction: String(r.lastInsertRowid), state: 1 };
    },
    PerformTransaction(p) {
      const t = pmTx(p.id); if (!t) throw pmErr(-31003, "Tranzaksiya topilmadi", "Транзакция не найдена", "Transaction not found");
      if (t.state === 2) return { transaction: String(t.id), perform_time: t.perform_time, state: 2 };
      if (t.state !== 1) throw pmErr(-31008, "Amalni bajarib bo‘lmaydi", "Невозможно выполнить операцию", "Unable to perform operation");
      if (ms() - t.create_time > PM_TIMEOUT) { pmCancelTimeout(t); throw pmErr(-31008, "Tranzaksiya muddati o‘tgan", "Истёк срок транзакции", "Transaction expired"); }
      const pt = ms();
      db.exec("BEGIN"); try { db.prepare("UPDATE payments SET state=2, perform_time=? WHERE id=?").run(pt, t.id); deliver(t.order_id); db.exec("COMMIT"); } catch (e) { db.exec("ROLLBACK"); throw e; }
      return { transaction: String(t.id), perform_time: pt, state: 2 };
    },
    CancelTransaction(p) {
      const t = pmTx(p.id); if (!t) throw pmErr(-31003, "Tranzaksiya topilmadi", "Транзакция не найдена", "Transaction not found");
      if (t.state === 1 || t.state === 2) {
        const ct = ms(), ns = t.state === 1 ? -1 : -2;
        db.exec("BEGIN");
        try {
          db.prepare("UPDATE payments SET state=?, cancel_time=?, reason=? WHERE id=?").run(ns, ct, p.reason ?? null, t.id);
          if (ns === -1) db.prepare("UPDATE orders SET status='cancelled' WHERE id=? AND status='new'").run(t.order_id); else revoke(t.order_id);
          db.exec("COMMIT");
        } catch (e) { db.exec("ROLLBACK"); throw e; }
        return { transaction: String(t.id), cancel_time: ct, state: ns };
      }
      return { transaction: String(t.id), cancel_time: t.cancel_time, state: t.state };
    },
    CheckTransaction(p) { const t = pmTx(p.id); if (!t) throw pmErr(-31003, "Tranzaksiya topilmadi", "Транзакция не найдена", "Transaction not found"); return pmView(t); },
    GetStatement(p) {
      return { transactions: db.prepare("SELECT * FROM payments WHERE provider='payme' AND ptime BETWEEN ? AND ? ORDER BY ptime").all(+p.from || 0, +p.to || 0)
        .map((t) => ({ id: t.ext_id, time: t.ptime, amount: t.amount, account: { order_id: String(t.order_id) }, ...pmView(t) })) };
    },
  };
  route("POST", "/api/pay/payme", async ({ req }) => {
    let msg = {};
    try {
      const raw = await readRaw(req);
      const auth = String(req.headers.authorization || "");
      const cred = auth.startsWith("Basic ") ? Buffer.from(auth.slice(6), "base64").toString("utf8") : "";
      if (!PAY.payme.key || cred.slice(cred.indexOf(":") + 1) !== PAY.payme.key) throw pmErr(-32504, "Ruxsat yo‘q", "Недостаточно привилегий", "Insufficient privileges");
      try { msg = JSON.parse(raw); } catch { throw pmErr(-32700, "JSON xato", "Ошибка парсинга JSON", "Parse error"); }
      const fn = PM[msg.method]; if (!fn) throw pmErr(-32601, "Metod topilmadi", "Метод не найден", "Method not found");
      return { jsonrpc: "2.0", id: msg.id ?? null, result: fn(msg.params || {}) };
    } catch (e) {
      if (!e.pm) console.error(e);
      return { jsonrpc: "2.0", id: msg.id ?? null, error: e.pm || { code: -32400, message: { uz: "Tizim xatosi", ru: "Системная ошибка", en: "System error" } } };
    }
  }, { raw: true });

  /* ---- Click SHOP API. Kabinetda: Prepare URL https://SAYT/api/pay/click/prepare, Complete URL https://SAYT/api/pay/click/complete ---- */
  const md5 = (x) => crypto.createHash("md5").update(x).digest("hex");
  async function clickHandle(req, action) {
    const p = Object.fromEntries(new URLSearchParams(await readRaw(req)));
    const base = { click_trans_id: p.click_trans_id, merchant_trans_id: p.merchant_trans_id };
    const out = (error, error_note, extra = {}) => ({ ...base, ...extra, error, error_note });
    if (!enabled().click) return out(-8, "Click ulanmagan");
    const sign = md5(`${p.click_trans_id}${p.service_id}${PAY.click.secret}${p.merchant_trans_id}${action === 1 ? p.merchant_prepare_id ?? "" : ""}${p.amount}${p.action}${p.sign_time}`);
    if (sign !== String(p.sign_string || "").toLowerCase() || String(p.service_id) !== String(PAY.click.service)) return out(-1, "SIGN CHECK FAILED!");
    if (+p.action !== action) return out(-3, "Action not found");
    const o = db.prepare("SELECT * FROM orders WHERE id=?").get(+p.merchant_trans_id);
    if (!o) return out(-5, "Order does not exist");
    if (Math.abs(parseFloat(p.amount) - o.amount) > 0.01) return out(-2, "Incorrect parameter amount");
    if (action === 0) {
      if (o.status === "paid") return out(-4, "Already paid");
      if (o.status !== "new") return out(-9, "Transaction cancelled");
      db.prepare("INSERT INTO payments(provider,ext_id,order_id,amount,state,create_time) VALUES('click',?,?,?,1,?) ON CONFLICT(provider,ext_id) DO NOTHING").run(String(p.click_trans_id), o.id, o.amount, ms());
      const t = db.prepare("SELECT * FROM payments WHERE provider='click' AND ext_id=?").get(String(p.click_trans_id));
      return out(0, "Success", { merchant_prepare_id: t.id });
    }
    const t = db.prepare("SELECT * FROM payments WHERE id=? AND provider='click' AND order_id=?").get(+p.merchant_prepare_id, o.id);
    if (!t) return out(-6, "Transaction does not exist");
    if (t.state === 2 || o.status === "paid") return out(-4, "Already paid", { merchant_confirm_id: t.id });
    if (t.state < 0 || o.status !== "new") return out(-9, "Transaction cancelled");
    if (+p.error < 0) {
      db.prepare("UPDATE payments SET state=-1, cancel_time=? WHERE id=?").run(ms(), t.id);
      db.prepare("UPDATE orders SET status='cancelled' WHERE id=? AND status='new'").run(o.id);
      return out(-9, "Transaction cancelled");
    }
    db.exec("BEGIN"); try { db.prepare("UPDATE payments SET state=2, perform_time=? WHERE id=?").run(ms(), t.id); deliver(o.id); db.exec("COMMIT"); } catch (e) { db.exec("ROLLBACK"); return out(-7, "Failed to update user"); }
    return out(0, "Success", { merchant_confirm_id: t.id });
  }
  route("POST", "/api/pay/click/prepare", ({ req }) => clickHandle(req, 0), { raw: true });
  route("POST", "/api/pay/click/complete", ({ req }) => clickHandle(req, 1), { raw: true });

  // O‘qituvchi uchun: kurs bo‘yicha to‘lovlar ro‘yxati va to‘lov tizimlari holati
  route("GET", "/api/teach/pay-config", () => enabled(), TCH);
  route("GET", "/api/teach/courses/:id/orders", ({ params }) => db.prepare(`SELECT o.id, o.amount, o.days, o.provider, o.status, o.created_at, o.paid_at, ch.name, a.phone
    FROM orders o JOIN children ch ON ch.id=o.child_id JOIN accounts a ON a.id=o.account_id WHERE o.course_id=? AND o.status IN ('paid','refunded') ORDER BY o.paid_at DESC LIMIT 500`).all(+params.id), TCH);

  return { serveFile, isTeacher };
};
