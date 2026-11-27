"use strict";
/* Little Star — olimpiada bo‘limi uchun umumiy yordamchilar (o‘quvchi sahifasi va o‘qituvchi paneli) */
window.AC = (function () {
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const WD = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
  const MON = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
  const fmtDT = (t) => { if (!t) return "—"; const d = new Date(t * 1000); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fmtDay = (t) => { if (!t) return "Sana belgilanmagan"; const d = new Date(t * 1000); return `${d.getDate()}-${MON[d.getMonth()]}, ${WD[d.getDay()].toLowerCase()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const toInput = (t) => { if (!t) return ""; const d = new Date(t * 1000); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fromInput = (v) => (v ? Math.floor(new Date(v).getTime() / 1000) : 0);
  const fsize = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB");
  const ytId = (u) => { const m = String(u || "").match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/); return m ? m[1] : null; };
  const icon = (mime) => (/pdf/.test(mime || "") ? "📕" : /^image\//.test(mime || "") ? "🖼️" : /^video\//.test(mime || "") ? "🎬" : /^audio\//.test(mime || "") ? "🎧" : "📄");
  const KIND = { video: "🎬 Video dars", material: "📚 Material", homework: "📝 Uy vazifasi", solution: "✅ Yechim" };

  // Video, rasm, PDF yoki havolani ko‘rsatish
  function media(item) {
    const f = item.file; const u = f ? f.url : item.url; const title = esc(item.title || (f && f.name) || u);
    if (f && /^video\//.test(f.mime)) return `<div class="ac-media"><video controls preload="metadata" playsinline controlslist="nodownload" src="${esc(u)}"></video><div class="ac-cap">🎬 ${title}</div></div>`;
    const yt = ytId(u);
    if (yt) return `<div class="ac-media"><div class="ac-yt"><iframe src="https://www.youtube-nocookie.com/embed/${yt}?rel=0" title="${title}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div><div class="ac-cap">🎬 ${title}</div></div>`;
    if (f && /^image\//.test(f.mime)) return `<a class="ac-img" href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="" loading="lazy"><span>${title}</span></a>`;
    return `<a class="ac-file" href="${esc(u)}" target="_blank" rel="noopener"><span class="i">${f ? icon(f.mime) : "🔗"}</span><b>${title}</b>${f ? `<small>${fsize(f.size)}</small>` : ""}</a>`;
  }
  const fileChip = (f) => `<a class="ac-file" href="${esc(f.url)}" target="_blank" rel="noopener"><span class="i">${icon(f.mime)}</span><b>${esc(f.name)}</b><small>${fsize(f.size)}</small></a>`;
  const thumbs = (files) => (files || []).map((f) => (/^image\//.test(f.mime) ? `<a class="ac-img" href="${esc(f.url)}" target="_blank" rel="noopener"><img src="${esc(f.url)}" alt="" loading="lazy"></a>` : fileChip(f))).join("");

  // Fayl yuklash (jarayon foizi bilan)
  function upload(file, token, onProg) {
    return new Promise((res, rej) => {
      const x = new XMLHttpRequest();
      x.open("POST", (window.LS_API || "") + "/api/upload?name=" + encodeURIComponent(file.name || "fayl"));
      x.setRequestHeader("Authorization", "Bearer " + token);
      x.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      x.upload.onprogress = (e) => { if (e.lengthComputable && onProg) onProg(e.loaded / e.total); };
      x.onload = () => { let j = {}; try { j = JSON.parse(x.responseText); } catch (e) {} x.status === 200 ? res(j) : rej(new Error(j.error || "Xatolik " + x.status)); };
      x.onerror = () => rej(new Error("Internet aloqasi uzildi. Qayta urinib ko‘ring."));
      x.send(file);
    });
  }
  // Telefon rasmlarini yuklashdan oldin kichraytirish (internet tejaladi)
  async function shrink(file, max = 2000, q = 0.85) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 900000) return file;
    try {
      const bmp = await createImageBitmap(file);
      const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      const b = await new Promise((r) => c.toBlob(r, "image/jpeg", q));
      if (!b || b.size >= file.size) return file;
      return new File([b], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
    } catch (e) { return file; }
  }

  // Matematik formulalar: $...$, $$...$$, \( \), \[ \]  (KaTeX, kerak bo‘lganda yuklanadi)
  let katexP = null;
  function loadMath() {
    if (katexP) return katexP;
    const B = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/";
    katexP = new Promise((res) => {
      const css = document.createElement("link"); css.rel = "stylesheet"; css.href = B + "katex.min.css"; document.head.appendChild(css);
      const s = document.createElement("script"); s.src = B + "katex.min.js";
      s.onload = () => { const a = document.createElement("script"); a.src = B + "contrib/auto-render.min.js"; a.onload = () => res(true); a.onerror = () => res(false); document.head.appendChild(a); };
      s.onerror = () => res(false); document.head.appendChild(s);
    });
    return katexP;
  }
  const rich = (text) => `<div class="ac-rich">${esc(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')}</div>`;
  async function math(root) {
    if (!root || !/[$\\]/.test(root.textContent)) return;
    if ((await loadMath()) && window.renderMathInElement)
      window.renderMathInElement(root, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "\\[", right: "\\]", display: true }, { left: "$", right: "$", display: false }, { left: "\\(", right: "\\)", display: false }], throwOnError: false });
  }

  // Jonli dars holati: 15 daqiqa oldin ochiladi
  function liveState(l, nowS) {
    if (!l.starts_at) return "none";
    const st = l.starts_at, en = st + (l.duration_min || 90) * 60;
    if (nowS >= st - 15 * 60 && nowS <= en) return "live";
    return nowS < st ? "soon" : "past";
  }
  const newJitsi = () => "https://meet.jit.si/LittleStar-" + Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");

  const st = document.createElement("style");
  st.textContent = `
  .ac-media{margin:10px 0}.ac-media video{width:100%;max-height:70vh;border-radius:14px;background:#000;display:block}
  .ac-yt{position:relative;padding-top:56.25%;border-radius:14px;overflow:hidden;background:#000}.ac-yt iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
  .ac-cap{font-weight:900;margin-top:6px}
  .ac-file{display:inline-flex;align-items:center;gap:8px;background:#f1eeff;color:#23204a;border-radius:14px;padding:10px 14px;margin:4px 6px 4px 0;text-decoration:none;font-weight:800;max-width:100%}
  .ac-file b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px}.ac-file small{color:#7a74a8;font-weight:700}.ac-file .i{font-size:20px}
  .ac-img{display:inline-block;margin:4px 6px 4px 0;text-decoration:none;color:#23204a;font-weight:800;vertical-align:top}
  .ac-img img{display:block;max-width:220px;max-height:220px;border-radius:12px;border:2px solid #ece8ff}
  .ac-img span{display:block;font-size:13px;max-width:220px}
  .ac-rich{white-space:pre-wrap;line-height:1.55;font-weight:700;overflow-wrap:anywhere}.ac-rich a{color:#5b33c9}
  .ac-prog{height:10px;border-radius:99px;background:#ece8ff;overflow:hidden;margin:6px 0}.ac-prog i{display:block;height:100%;background:#1fbf75;width:0;transition:width .2s}
  .katex-display{overflow-x:auto;overflow-y:hidden}`;
  document.head.appendChild(st);

  return { esc, fmtDT, fmtDay, toInput, fromInput, fsize, ytId, media, fileChip, thumbs, upload, shrink, rich, math, liveState, newJitsi, KIND, icon };
})();
