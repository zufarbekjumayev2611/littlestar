"use strict";
/* Little Star — O‘QITUVCHI PANELI: olimpiada kurslari, darslar, jonli dars, video yechimlar, vazifalarni tekshirish, jurnal.
   admin.html ichidagi umumiy funksiyalardan foydalanadi: M, $, api, toast, modal, token. */
(function () {
  const A = window.AC, esc = A.esc;
  const ST = { submitted: ['tag', '🕓 Tekshirilmagan'], checked: ['tag g', '✅ Tekshirildi'], returned: ['tag r', '↩️ Qaytarilgan'] };
  const stTag = (s) => (s && ST[s] ? `<span class="${ST[s][0]}">${ST[s][1]}</span>` : '<span class="muted">—</span>');
  const css = document.createElement('style');
  css.textContent = `.subtabs{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}.subtabs button{background:#f1eeff;color:var(--ink);font-weight:900;padding:9px 14px;border-radius:12px}.subtabs button.on{background:var(--purple);color:#fff}
  .badge{display:inline-block;min-width:20px;padding:0 6px;border-radius:99px;background:var(--pink);color:#fff;font-size:12px;margin-left:4px}
  .ccard{border:2px solid #ece8ff;border-radius:18px;padding:16px;display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin:10px 0}
  .ccard .t{flex:1;min-width:220px}.ccard .t b{font-size:19px}
  .item{display:flex;gap:8px;align-items:center;flex-wrap:wrap;border:2px solid #ece8ff;border-radius:14px;padding:8px;margin:6px 0}
  .item select{width:auto;flex:none}.item input{flex:1;min-width:160px}
  .jr{overflow:auto}.jr table td,.jr table th{text-align:center;white-space:nowrap}.jr table td:first-child,.jr table th:first-child{text-align:left;position:sticky;left:0;background:#fff}
  .cm{background:#f7f5ff;border-radius:14px;padding:10px 12px;margin:6px 0}.cm.t{background:#e7f8ef}
  .live{background:linear-gradient(135deg,#ff5c8a,#ff9f1c);color:#fff;border-radius:18px;padding:14px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:10px 0}
  .live a{background:#fff;color:#c2185b;text-decoration:none;font-weight:900;padding:10px 16px;border-radius:12px}
  .pen{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:20;display:flex;flex-direction:column}
  .pen .bar{display:flex;gap:8px;padding:10px;flex-wrap:wrap;align-items:center;color:#fff}.pen .wrap{flex:1;overflow:auto;display:flex;align-items:flex-start;justify-content:center;padding:10px}
  .pen canvas{max-width:100%;touch-action:none;background:#fff;border-radius:8px}
  .pen .c{width:30px;height:30px;border-radius:50%;border:3px solid #fff;padding:0}`;
  document.head.appendChild(css);

  let CUR = null; // joriy kurs
  let SUBTAB = 'lessons';

  /* ---------- kurslar ro‘yxati ---------- */
  async function kurs() {
    M.innerHTML = '<p class="muted">Yuklanmoqda...</p>';
    const list = await api('GET', '/teach/courses');
    M.innerHTML = `<div class="card"><div class="row"><h2 style="margin:0">🎓 Olimpiada kurslari</h2><button class="btn g" id="nc" style="flex:none">➕ Yangi kurs</button></div>
      <p class="muted">Har bir kursda: darslar jadvali, jonli dars (video konferensiya), video yechimlar, materiallar, uyga vazifalar va ularni tekshirish, jurnal.</p>
      ${list.map((c) => `<div class="ccard"><div class="t"><b>${esc(c.title)}</b> ${c.published ? '' : '<span class="tag r">Yashirin</span>'}<div class="muted">${c.grade}-sinf · ${c.lessons} ta dars · ${c.students} o‘quvchi</div></div>
        ${c.pending ? `<span class="tag r">🙋 ${c.pending} ta ariza</span>` : ''}${c.unchecked ? `<span class="tag r">📝 ${c.unchecked} ta tekshirilmagan</span>` : ''}
        <button class="btn" data-o="${c.id}">Ochish →</button></div>`).join('') || '<p class="muted">Kurs yo‘q</p>'}</div>`;
    $('#nc').onclick = () => courseForm(null);
    M.querySelectorAll('[data-o]').forEach((b) => (b.onclick = () => { SUBTAB = 'lessons'; course(+b.dataset.o); }));
  }

  /* ---------- kurs sahifasi ---------- */
  async function course(id, sub) {
    if (sub) SUBTAB = sub;
    M.innerHTML = '<p class="muted">Yuklanmoqda...</p>';
    const d = (CUR = await api('GET', '/teach/courses/' + id));
    const pend = d.students.filter((s) => s.status === 'pending').length;
    const unch = d.lessons.reduce((a, l) => a + l.unchecked, 0);
    const T = [['lessons', '📅 Darslar'], ['students', '👥 O‘quvchilar' + (pend ? `<span class="badge">${pend}</span>` : '')], ['hw', '📝 Vazifalarni tekshirish' + (unch ? `<span class="badge">${unch}</span>` : '')], ['journal', '📊 Jurnal'], ['ann', '📢 E’lonlar'], ['settings', '⚙️ Sozlamalar']];
    M.innerHTML = `<div class="card"><div class="row"><button class="btn w" id="bk" style="flex:none">← Kurslar</button><h2 style="margin:0">${esc(d.course.title)}</h2></div>
      <div class="subtabs">${T.map(([k, t]) => `<button data-s="${k}" class="${SUBTAB === k ? 'on' : ''}">${t}</button>`).join('')}</div></div><div id="cv"></div>`;
    $('#bk').onclick = kurs;
    M.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => { SUBTAB = b.dataset.s; course(id); }));
    ({ lessons, students, hw, journal, ann, settings })[SUBTAB](d);
  }
  const CV = () => $('#cv');

  function lessons(d) {
    const nowS = Date.now() / 1000;
    const live = d.lessons.find((l) => A.liveState(l, nowS) === 'live');
    CV().innerHTML = `${live ? `<div class="live"><b style="flex:1">🔴 Hozir dars vaqti: ${esc(live.title)}</b><button class="btn w" data-e="${live.id}">Darsni ochish</button></div>` : ''}
    <div class="card"><div class="row"><h3 style="margin:0">📅 Darslar jadvali</h3><button class="btn g" id="nl" style="flex:none">➕ Yangi dars</button></div>
    <div style="overflow:auto"><table><tr><th>Sana</th><th>Mavzu</th><th>Qatnashdi</th><th>Vazifa</th><th>Holat</th><th></th></tr>
    ${d.lessons.map((l) => `<tr><td>${A.fmtDT(l.starts_at)}</td><td><b>${esc(l.title)}</b></td><td>${l.attended}</td>
      <td>${l.subs ? `${l.subs} ta${l.unchecked ? ` · <span class="tag r">${l.unchecked} tekshirilmagan</span>` : ''}` : '—'}${l.hw_due ? `<br><span class="muted">muddat: ${A.fmtDT(l.hw_due)}</span>` : ''}</td>
      <td>${l.published ? '<span class="tag g">Ochiq</span>' : '<span class="tag r">Yashirin</span>'}</td><td><button class="btn sm" data-e="${l.id}">✏️ Ochish</button></td></tr>`).join('')}</table>
    ${d.lessons.length ? '' : '<p class="muted">Hali dars yo‘q. “Yangi dars” tugmasini bosing.</p>'}</div></div>`;
    $('#nl').onclick = () => lessonEdit(d.course, null);
    CV().querySelectorAll('[data-e]').forEach((b) => (b.onclick = () => lessonEdit(d.course, +b.dataset.e)));
  }

  function students(d) {
    const by = (s) => d.students.filter((x) => x.status === s);
    const row = (s, btns) => `<tr><td><b>${esc(s.name)}</b> <span class="tag">${s.grade}-sinf</span><br><span class="muted">${esc(s.region)}${s.district ? ', ' + esc(s.district) : ''}${s.school ? ' · ' + esc(s.school) : ''}</span></td><td>+${esc(s.phone)}<br><span class="muted">${esc(s.parent_name || '')}</span></td><td>${btns}</td></tr>`;
    const pend = by('pending'), act = by('active'), rem = by('removed');
    CV().innerHTML = `${pend.length ? `<div class="card"><h3>🙋 Qo‘shilish uchun arizalar (${pend.length})</h3><table>${pend.map((s) => row(s, `<button class="btn g sm" data-a="${s.child_id}:active">✅ Qabul qilish</button> <button class="btn w sm" data-a="${s.child_id}:removed">Rad etish</button>`)).join('')}</table></div>` : ''}
    <div class="card"><div class="row"><h3 style="margin:0">👥 Kurs o‘quvchilari (${act.length})</h3><input id="fp" placeholder="Telefon raqam: 90 123 45 67" inputmode="numeric"><button class="btn" id="ff" style="flex:none">➕ Qo‘lda qo‘shish</button></div><div id="fr"></div>
    <table>${act.map((s) => row(s, `<button class="btn w sm" data-a="${s.child_id}:removed">Kursdan chiqarish</button>`)).join('')}</table>${act.length ? '' : '<p class="muted">Hali o‘quvchi yo‘q. O‘quvchilar saytdagi “Olimpiada” bo‘limidan ariza yuboradi, siz shu yerda qabul qilasiz.</p>'}</div>
    ${rem.length ? `<div class="card"><h3>Chiqarilganlar</h3><table>${rem.map((s) => row(s, `<button class="btn w sm" data-a="${s.child_id}:active">Qayta qo‘shish</button>`)).join('')}</table></div>` : ''}`;
    CV().querySelectorAll('[data-a]').forEach((b) => (b.onclick = async () => { const [cid, st] = b.dataset.a.split(':'); await api('PUT', `/teach/courses/${d.course.id}/students/${cid}`, { status: st }); toast('Saqlandi ✅'); course(d.course.id); }));
    $('#ff').onclick = async () => {
      const list = await api('GET', '/teach/find-children?phone=' + encodeURIComponent($('#fp').value));
      $('#fr').innerHTML = list.length ? list.map((c) => `<div class="item"><b style="flex:1">${esc(c.name)} · ${c.grade}-sinf · ${esc(c.region)}</b><button class="btn g sm" data-add="${c.id}">Kursga qo‘shish</button></div>`).join('') : '<div class="err">Bu raqamda ro‘yxatdan o‘tgan o‘quvchi topilmadi. Avval saytda ro‘yxatdan o‘tib, o‘quvchi profilini qo‘shishi kerak.</div>';
      $('#fr').querySelectorAll('[data-add]').forEach((b) => (b.onclick = async () => { await api('PUT', `/teach/courses/${d.course.id}/students/${b.dataset.add}`, { status: 'active' }); toast('Qo‘shildi ✅'); course(d.course.id); }));
    };
  }

  let hwFilter = 'submitted';
  async function hw(d) {
    CV().innerHTML = '<p class="muted">Yuklanmoqda...</p>';
    const list = await api('GET', `/teach/submissions?course=${d.course.id}&status=${hwFilter}`);
    CV().innerHTML = `<div class="card"><div class="row"><h3 style="margin:0">📝 Topshirilgan vazifalar</h3>
      <select id="hf" style="flex:none;width:auto"><option value="submitted">🕓 Tekshirilmaganlar</option><option value="checked">✅ Tekshirilganlar</option><option value="returned">↩️ Qaytarilganlar</option><option value="">Hammasi</option></select></div>
      <div style="overflow:auto"><table><tr><th>O‘quvchi</th><th>Dars</th><th>Topshirdi</th><th>Holat</th><th>Ball</th><th></th></tr>
      ${list.map((s) => `<tr><td><b>${esc(s.name)}</b></td><td>${esc(s.lesson)}</td><td>${A.fmtDT(s.submitted_at)}${s.hw_due && s.submitted_at > s.hw_due ? ' <span class="tag r">kechikkan</span>' : ''}</td><td>${stTag(s.status)}</td><td>${s.score != null ? `<b>${s.score}</b>/${s.hw_max}` : '—'}</td><td><button class="btn sm ${s.status === 'submitted' ? 'g' : 'w'}" data-c="${s.id}">${s.status === 'submitted' ? '✔️ Tekshirish' : 'Ko‘rish'}</button></td></tr>`).join('')}</table></div>
      ${list.length ? '' : '<p class="muted">Bu ro‘yxat bo‘sh 👍</p>'}</div>`;
    $('#hf').value = hwFilter; $('#hf').onchange = (e) => { hwFilter = e.target.value; hw(d); };
    CV().querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => check(+b.dataset.c, () => course(d.course.id, 'hw'), list.filter((x) => x.status === 'submitted').map((x) => x.id))));
  }

  async function journal(d) {
    CV().innerHTML = '<p class="muted">Yuklanmoqda...</p>';
    const j = await api('GET', `/teach/courses/${d.course.id}/journal`);
    const sub = {}; j.subs.forEach((s) => (sub[s.lesson_id + ':' + s.child_id] = s));
    const att = new Set(j.attendance.map((a) => a.lesson_id + ':' + a.child_id));
    const rows = j.students.map((s) => {
      let sum = 0, max = 0, came = 0;
      const cells = j.lessons.map((l) => { const x = sub[l.id + ':' + s.id]; const a = att.has(l.id + ':' + s.id); if (a) came++; if (x && x.score != null) sum += x.score; max += l.hw_max;
        return { a, x, txt: (a ? '🟢' : '⚪') + ' ' + (x ? (x.score != null ? x.score : x.status === 'submitted' ? '🕓' : '↩️') : '—') }; });
      return { s, cells, sum, max, came };
    });
    CV().innerHTML = `<div class="card"><div class="row"><h3 style="margin:0">📊 Jurnal</h3><button class="btn w" id="csv" style="flex:none">⬇️ Excel (CSV) yuklab olish</button></div>
      <p class="muted">🟢 jonli darsga qo‘shilgan · ⚪ qo‘shilmagan · raqam — vazifa bali · 🕓 tekshirilmagan · ↩️ qaytarilgan</p>
      <div class="jr"><table><tr><th>O‘quvchi</th>${j.lessons.map((l, i) => `<th title="${esc(l.title)}">${i + 1}<br><span class="muted">${l.starts_at ? A.fmtDT(l.starts_at).slice(0, 5) : ''}</span></th>`).join('')}<th>Davomat</th><th>Jami ball</th></tr>
      ${rows.map((r) => `<tr><td><b>${esc(r.s.name)}</b></td>${r.cells.map((c) => `<td>${c.txt}</td>`).join('')}<td><b>${r.came}/${j.lessons.length}</b></td><td><b>${r.sum}</b>/${r.max}</td></tr>`).join('')}</table></div>
      ${j.students.length ? '' : '<p class="muted">Kursda hali o‘quvchi yo‘q.</p>'}</div>`;
    $('#csv').onclick = () => {
      const q = (v) => '"' + String(v).replace(/"/g, '""') + '"';
      const lines = [['O‘quvchi', ...j.lessons.map((l, i) => `${i + 1}. ${l.title}`), 'Davomat', 'Jami ball'].map(q).join(';')];
      rows.forEach((r) => lines.push([r.s.name, ...r.cells.map((c) => (c.a ? '+ ' : '') + (c.x && c.x.score != null ? c.x.score : '')), `${r.came}/${j.lessons.length}`, r.sum].map(q).join(';')));
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv' })); a.download = `jurnal-${d.course.title.replace(/[^\w-]+/g, '_')}.csv`; a.click();
    };
  }

  function ann(d) {
    CV().innerHTML = `<div class="card"><h3>📢 Yangi e’lon</h3><textarea id="at" placeholder="Masalan: Ertangi dars soat 18:00 da boshlanadi. Daftar va chizg‘ichni tayyorlab qo‘ying."></textarea><button class="btn g" id="as" style="margin-top:8px">📤 E’lon qilish</button></div>
      <div class="card"><h3>E’lonlar</h3>${d.announcements.map((a) => `<div class="cm"><div class="muted">${A.fmtDT(a.created_at)}</div>${A.rich(a.text)}<button class="btn w sm" data-d="${a.id}">🗑️</button></div>`).join('') || '<p class="muted">Hali e’lon yo‘q</p>'}</div>`;
    $('#as').onclick = async () => { await api('POST', `/teach/courses/${d.course.id}/announcements`, { text: $('#at').value }); toast('E’lon qilindi ✅'); course(d.course.id); };
    CV().querySelectorAll('[data-d]').forEach((b) => (b.onclick = async () => { await api('DELETE', '/teach/announcements/' + b.dataset.d); course(d.course.id); }));
  }

  function settings(d) { courseForm(d.course, CV()); }

  function courseForm(c, into) {
    c = c || { title: '', grade: 7, description: '', live_url: '', published: 1, open_join: 0, sort: 0 };
    const html = `<div class="card"><h3>${c.id ? '⚙️ Kurs sozlamalari' : '➕ Yangi kurs'}</h3>
      <div class="row"><label class="f"><span>Kurs nomi</span><input id="ct" value="${esc(c.title)}" placeholder="Al-Xorazmiy olimpiadasi — 7-sinf"></label><label class="f" style="flex:none;width:110px"><span>Sinf</span><input id="cg" type="number" min="1" max="11" value="${c.grade}"></label><label class="f" style="flex:none;width:110px"><span>Tartib</span><input id="cs" type="number" value="${c.sort || 0}"></label></div>
      <label class="f"><span>Tavsif</span><textarea id="cd">${esc(c.description)}</textarea></label>
      <label class="f"><span>Doimiy jonli dars havolasi (har bir darsda alohida ko‘rsatilmasa shu ishlatiladi)</span><div class="row"><input id="cl" value="${esc(c.live_url)}" placeholder="https://meet.jit.si/... yoki Zoom / Google Meet havolasi"><button class="btn o" id="cj" type="button" style="flex:none">🎥 Jitsi xona yaratish</button></div></label>
      <label style="display:flex;gap:10px;align-items:center;font-weight:800;margin:8px 0"><input type="checkbox" id="co" style="width:22px;height:22px" ${c.open_join ? 'checked' : ''}> Ariza avtomatik qabul qilinsin (belgilanmasa, har bir o‘quvchini o‘zingiz tasdiqlaysiz)</label>
      <label style="display:flex;gap:10px;align-items:center;font-weight:800;margin:8px 0"><input type="checkbox" id="cp" style="width:22px;height:22px" ${c.published ? 'checked' : ''}> Saytda ko‘rinsin</label>
      <div id="ce"></div><div class="row"><button class="btn g" id="csv2" style="flex:none">💾 Saqlash</button>${c.id ? '<button class="btn r" id="cdel" style="flex:none">🗑️ Kursni o‘chirish</button>' : '<button class="btn w" id="cx" style="flex:none">Bekor</button>'}</div></div>`;
    if (into) into.innerHTML = html; else M.innerHTML = html;
    $('#cj').onclick = () => ($('#cl').value = A.newJitsi());
    if ($('#cx')) $('#cx').onclick = kurs;
    $('#csv2').onclick = async () => {
      const b = { title: $('#ct').value, grade: +$('#cg').value, sort: +$('#cs').value, description: $('#cd').value, live_url: $('#cl').value.trim(), open_join: $('#co').checked, published: $('#cp').checked };
      try { if (c.id) { await api('PUT', '/teach/courses/' + c.id, b); toast('Saqlandi ✅'); course(c.id); } else { const j = await api('POST', '/teach/courses', b); course(j.id, 'lessons'); } }
      catch (e) { $('#ce').innerHTML = `<div class="err">${esc(e.message)}</div>`; }
    };
    if ($('#cdel')) $('#cdel').onclick = () => { const m = modal(`<h3>Kurs o‘chirilsinmi?</h3><p class="muted">Barcha darslar, topshirilgan vazifalar va jurnal ham o‘chadi. Buni qaytarib bo‘lmaydi.</p><div class="row"><button class="btn w" id="n">Yo‘q</button><button class="btn r" id="y">O‘chirish</button></div>`);
      m.querySelector('#n').onclick = () => m.remove(); m.querySelector('#y').onclick = async () => { try { await api('DELETE', '/teach/courses/' + c.id); m.remove(); kurs(); } catch (e) { m.remove(); toast(e.message); } }; };
  }

  /* ---------- dars muharriri ---------- */
  async function lessonEdit(c, id) {
    M.innerHTML = '<p class="muted">Yuklanmoqda...</p>';
    const j = id ? await api('GET', '/teach/lessons/' + id) : null;
    const L = j ? j.lesson : { title: '', starts_at: 0, duration_min: 90, body: '', live_url: '', hw_text: '', hw_due: 0, hw_max: 10, solutions_mode: 'after_due', published: 1 };
    const its = j ? j.items.map((i) => ({ kind: i.kind, title: i.title, url: i.url, file: i.file, file_id: i.file && i.file.id })) : [];
    const liveUrl = () => $('#ll').value.trim() || c.live_url || '';
    M.innerHTML = `<div class="card"><div class="row"><button class="btn w" id="bk" style="flex:none">← ${esc(c.title)}</button><h2 style="margin:0">${id ? 'Dars' : 'Yangi dars'}</h2></div></div>
    ${id ? `<div class="live" id="lv"><b style="flex:1">🎥 Jonli dars: ${L.starts_at ? A.fmtDay(L.starts_at) : 'vaqt belgilanmagan'}</b><a href="#" id="go" target="_blank" rel="noopener">▶️ Jonli darsni boshlash</a></div>` : ''}
    <div class="card"><h3>1. Asosiy ma’lumot</h3>
      <label class="f"><span>Dars mavzusi</span><input id="lt" value="${esc(L.title)}" placeholder="Masalan: 5-dars. Bo‘linish belgilari"></label>
      <div class="row"><label class="f"><span>Boshlanish vaqti</span><input id="ls" type="datetime-local" value="${A.toInput(L.starts_at)}"></label><label class="f"><span>Davomiyligi (daqiqa)</span><input id="ld" type="number" value="${L.duration_min}"></label>
      <label class="f"><span>Holat</span><select id="lp"><option value="1">Ochiq (o‘quvchilar ko‘radi)</option><option value="0">Yashirin (qoralama)</option></select></label></div>
      <label class="f"><span>Jonli dars havolasi (bo‘sh qolsa, kursning doimiy havolasi: ${esc(c.live_url || 'belgilanmagan')})</span><div class="row"><input id="ll" value="${esc(L.live_url)}" placeholder="https://meet.jit.si/... · Zoom · Google Meet"><button class="btn o" id="lj" type="button" style="flex:none">🎥 Jitsi xona yaratish</button></div></label>
      <p class="muted" style="margin:-4px 0 8px;font-size:13px">💡 Jitsi (meet.jit.si) bepul: ekran ulashish, doska (whiteboard), chat va yozib olish bor. Darsni boshlaganingizda xonani ochish uchun bir marta Google akkaunt bilan kirish so‘raladi. Zoom yoki Google Meet havolasini ham qo‘yishingiz mumkin.</p>
      <label class="f"><span>Dars matni / konspekt (formulalar: $a^2+b^2=c^2$)</span><textarea id="lb" style="min-height:120px">${esc(L.body)}</textarea></label></div>
    <div class="card"><h3>2. Videolar, materiallar va yechimlar</h3>
      <p class="muted">🎬 Video dars — hamma vaqt ko‘rinadi. ✅ Yechim — pastdagi qoidaga ko‘ra ochiladi. Katta videolarni YouTube’ga “Ro‘yxatda yo‘q” (unlisted) qilib joylab, havolasini qo‘yish tavsiya etiladi. To‘g‘ridan-to‘g‘ri fayl yuklash ham mumkin.</p>
      <div id="its"></div>
      <div class="row" style="margin-top:8px"><select id="nk" style="flex:none;width:auto">${Object.entries(A.KIND).map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select>
        <label class="btn" style="flex:none;text-align:center">📎 Fayl yuklash<input type="file" id="nf" multiple hidden></label><button class="btn w" id="nu" style="flex:none">🔗 Havola (YouTube...)</button></div><div id="up"></div></div>
    <div class="card"><h3>3. Uyga vazifa</h3>
      <label class="f"><span>Vazifa sharti (bo‘sh qolsa, vazifa yo‘q). Fayl ko‘rinishidagi vazifani yuqorida “📝 Uy vazifasi” turi bilan yuklang.</span><textarea id="ht" style="min-height:100px">${esc(L.hw_text)}</textarea></label>
      <div class="row"><label class="f"><span>Topshirish muddati</span><input id="hd" type="datetime-local" value="${A.toInput(L.hw_due)}"></label><label class="f"><span>Maksimal ball</span><input id="hm" type="number" value="${L.hw_max}"></label>
      <label class="f"><span>Yechimlar qachon ochiladi?</span><select id="sm"><option value="after_due">Vazifa muddati tugagach</option><option value="now">Darhol</option><option value="hidden">Hozircha yashirin</option></select></label></div></div>
    <div class="card"><div id="le"></div><div class="row"><button class="btn g" id="sv" style="flex:none">💾 Saqlash</button>${id ? '<button class="btn r" id="dl" style="flex:none">🗑️ Darsni o‘chirish</button>' : ''}</div></div>
    ${id ? `<div class="card"><h3>👥 Davomat va vazifalar</h3><div style="overflow:auto"><table><tr><th>O‘quvchi</th><th>Jonli darsga</th><th>Vazifa</th><th>Ball</th><th></th></tr>
      ${j.students.map((s) => `<tr><td><b>${esc(s.name)}</b></td><td>${s.joined_at ? '🟢 ' + A.fmtDT(s.joined_at) : '⚪ qo‘shilmagan'}</td><td>${s.sub_id ? stTag(s.status) : '<span class="muted">topshirmagan</span>'}</td><td>${s.score != null ? s.score + '/' + L.hw_max : '—'}</td><td>${s.sub_id ? `<button class="btn sm" data-c="${s.sub_id}">Ochish</button>` : ''}</td></tr>`).join('')}</table></div></div>
    <div class="card"><h3>💬 Savol-javoblar</h3><div id="cms"></div><textarea id="cmt" placeholder="O‘quvchilarga javob yoki izoh yozing..."></textarea><button class="btn" id="cms2" style="margin-top:8px">📤 Yuborish</button></div>` : ''}`;
    $('#lp').value = String(L.published ? 1 : 0); $('#sm').value = L.solutions_mode;
    $('#bk').onclick = () => course(c.id, 'lessons');
    $('#lj').onclick = () => ($('#ll').value = A.newJitsi());
    if ($('#go')) $('#go').onclick = (e) => { const u = liveUrl(); if (!u) { e.preventDefault(); toast('Avval jonli dars havolasini kiriting'); } else e.currentTarget.href = u; };

    const drawItems = () => {
      $('#its').innerHTML = its.map((it, i) => `<div class="item"><select data-k="${i}">${Object.entries(A.KIND).map(([k, t]) => `<option value="${k}" ${it.kind === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <input data-t="${i}" value="${esc(it.title)}" placeholder="Nomi (masalan: 3-masala yechimi)">
        ${it.file ? `<a class="ac-file" href="${esc(it.file.url)}" target="_blank" rel="noopener"><span class="i">${A.icon(it.file.mime)}</span><b>${esc(it.file.name)}</b><small>${A.fsize(it.file.size)}</small></a>` : `<input data-u="${i}" value="${esc(it.url)}" placeholder="https://youtu.be/...">`}
        <button class="btn w sm" data-up="${i}">↑</button><button class="btn r sm" data-rm="${i}">✕</button></div>`).join('') || '<p class="muted">Hali material qo‘shilmagan.</p>';
      $('#its').querySelectorAll('[data-k]').forEach((s) => (s.onchange = () => (its[+s.dataset.k].kind = s.value)));
      $('#its').querySelectorAll('[data-t]').forEach((s) => (s.oninput = () => (its[+s.dataset.t].title = s.value)));
      $('#its').querySelectorAll('[data-u]').forEach((s) => (s.oninput = () => (its[+s.dataset.u].url = s.value.trim())));
      $('#its').querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { its.splice(+b.dataset.rm, 1); drawItems(); }));
      $('#its').querySelectorAll('[data-up]').forEach((b) => (b.onclick = () => { const i = +b.dataset.up; if (i > 0) { [its[i - 1], its[i]] = [its[i], its[i - 1]]; drawItems(); } }));
    };
    drawItems();
    $('#nu').onclick = () => { its.push({ kind: $('#nk').value, title: '', url: '' }); drawItems(); };
    $('#nf').onchange = async (e) => {
      const files = [...e.target.files]; e.target.value = '';
      for (const f of files) {
        const box = document.createElement('div'); box.innerHTML = `<b>${esc(f.name)}</b> (${A.fsize(f.size)}) <span>0%</span><div class="ac-prog"><i></i></div>`; $('#up').appendChild(box);
        try { const r = await A.upload(f, token, (p) => { box.querySelector('i').style.width = p * 100 + '%'; box.querySelector('span').textContent = Math.round(p * 100) + '%'; });
          its.push({ kind: $('#nk').value, title: f.name.replace(/\.\w+$/, ''), file: r, file_id: r.id }); box.remove(); drawItems(); }
        catch (err) { box.innerHTML = `<div class="err">${esc(f.name)}: ${esc(err.message)}</div>`; }
      }
    };
    $('#sv').onclick = async () => {
      const b = { title: $('#lt').value, starts_at: A.fromInput($('#ls').value), duration_min: +$('#ld').value, published: $('#lp').value === '1', live_url: $('#ll').value.trim(), body: $('#lb').value,
        hw_text: $('#ht').value, hw_due: A.fromInput($('#hd').value), hw_max: +$('#hm').value, solutions_mode: $('#sm').value,
        items: its.map((i) => ({ kind: i.kind, title: i.title, file_id: i.file_id || null, url: i.file_id ? '' : i.url })) };
      try { if (id) { await api('PUT', '/teach/lessons/' + id, b); toast('Saqlandi ✅'); lessonEdit(c, id); } else { const r = await api('POST', `/teach/courses/${c.id}/lessons`, b); toast('Dars yaratildi ✅'); lessonEdit(c, r.id); } }
      catch (e) { $('#le').innerHTML = `<div class="err">${esc(e.message)}</div>`; }
    };
    if (!id) return;
    $('#dl').onclick = () => { const m = modal(`<h3>Dars o‘chirilsinmi?</h3><p class="muted">Topshirilgan vazifalar va davomat ham o‘chadi.</p><div class="row"><button class="btn w" id="n">Yo‘q</button><button class="btn r" id="y">O‘chirish</button></div>`);
      m.querySelector('#n').onclick = () => m.remove(); m.querySelector('#y').onclick = async () => { await api('DELETE', '/teach/lessons/' + id); m.remove(); course(c.id, 'lessons'); }; };
    M.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => check(+b.dataset.c, () => lessonEdit(c, id))));
    const drawCm = (list) => { $('#cms').innerHTML = list.map((m) => `<div class="cm ${m.teacher ? 't' : ''}"><b>${m.teacher ? '👩‍🏫 ' : '🧒 '}${esc(m.author)}</b> <span class="muted">${A.fmtDT(m.created_at)}</span> <button class="btn w sm" data-x="${m.id}">🗑️</button>${A.rich(m.text)}</div>`).join('') || '<p class="muted">Hali savol yo‘q.</p>';
      $('#cms').querySelectorAll('[data-x]').forEach((b) => (b.onclick = async () => { await api('DELETE', '/teach/comments/' + b.dataset.x); b.closest('.cm').remove(); })); A.math($('#cms')); };
    drawCm(j.comments);
    $('#cms2').onclick = async () => { try { const r = await api('POST', `/academy/lessons/${id}/comments`, { text: $('#cmt').value }); $('#cmt').value = ''; drawCm(r.comments); } catch (e) { toast(e.message); } };
  }

  /* ---------- vazifani tekshirish ---------- */
  async function check(id, back, queue) {
    M.innerHTML = '<p class="muted">Yuklanmoqda...</p>';
    const s = await api('GET', '/teach/submissions/' + id);
    const fb = s.feedback_files.slice();
    const nextId = queue && queue.filter((x) => x !== id)[0];
    M.innerHTML = `<div class="card"><div class="row"><button class="btn w" id="bk" style="flex:none">← Orqaga</button><h2 style="margin:0">📝 ${esc(s.name)} — ${esc(s.lesson)}</h2></div>
      <p class="muted">${s.grade}-sinf · +${esc(s.phone)} · topshirdi: ${A.fmtDT(s.submitted_at)}${s.hw_due && s.submitted_at > s.hw_due ? ' <span class="tag r">muddatidan kechikkan</span>' : ''} · ${stTag(s.status)}</p></div>
      ${s.hw_text ? `<div class="card"><h3>Vazifa sharti</h3><div id="hq">${A.rich(s.hw_text)}</div></div>` : ''}
      <div class="card"><h3>O‘quvchi javobi</h3>${s.text ? `<div id="sa">${A.rich(s.text)}</div>` : '<p class="muted">Matn yozilmagan</p>'}
        <div style="margin-top:10px">${s.files.map((f) => /^image\//.test(f.mime) ? `<div style="display:inline-block;vertical-align:top;margin:4px"><a class="ac-img" href="${esc(f.url)}" target="_blank" rel="noopener"><img src="${esc(f.url)}" style="max-width:320px;max-height:320px"></a><button class="btn o sm" data-pen="${esc(f.url)}">🖍️ Ustida belgilash</button></div>` : A.fileChip(f)).join('')}</div></div>
      <div class="card"><h3>Baholash</h3>
        <div class="row"><label class="f" style="flex:none;width:200px"><span>Ball (0–${s.hw_max})</span><input id="sc" type="number" min="0" max="${s.hw_max}" step="0.5" value="${s.score ?? ''}"></label>
        <div class="row" style="flex:2">${[0, 0.5, 1].map((k) => `<button class="btn w sm" data-q="${Math.round(s.hw_max * k * 2) / 2}" style="flex:none">${Math.round(s.hw_max * k * 2) / 2}</button>`).join('')}</div></div>
        <label class="f"><span>Izoh (o‘quvchi ko‘radi)</span><textarea id="fbt" style="min-height:110px" placeholder="Masalan: 2-masalada javob to‘g‘ri, lekin isbot to‘liq emas...">${esc(s.feedback)}</textarea></label>
        <div id="fbf"></div><label class="btn w sm" style="display:inline-block;margin:6px 0">📎 Izohga fayl biriktirish<input type="file" id="fbu" multiple hidden></label><div id="fbp"></div>
        <div id="ce"></div>
        <div class="row" style="margin-top:8px"><button class="btn g" id="ok" style="flex:none">✅ Tekshirildi — saqlash</button><button class="btn o" id="ret" style="flex:none">↩️ Qayta ishlashga qaytarish</button>${nextId ? '<button class="btn" id="nx" style="flex:none">Saqlash va keyingisi →</button>' : ''}</div></div>`;
    A.math(M);
    const drawFb = () => { $('#fbf').innerHTML = fb.map((f, i) => `<span style="display:inline-block;vertical-align:top">${A.thumbs([f])}<button class="btn r sm" data-fx="${i}">✕</button></span>`).join('');
      $('#fbf').querySelectorAll('[data-fx]').forEach((b) => (b.onclick = () => { fb.splice(+b.dataset.fx, 1); drawFb(); })); };
    drawFb();
    const addFile = async (f) => { const box = document.createElement('div'); box.innerHTML = `${esc(f.name)} <div class="ac-prog"><i></i></div>`; $('#fbp').appendChild(box);
      try { const r = await A.upload(f, token, (p) => (box.querySelector('i').style.width = p * 100 + '%')); fb.push(r); drawFb(); box.remove(); } catch (e) { box.innerHTML = `<div class="err">${esc(e.message)}</div>`; } };
    $('#fbu').onchange = async (e) => { for (const f of [...e.target.files]) await addFile(await A.shrink(f)); e.target.value = ''; };
    M.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => ($('#sc').value = b.dataset.q)));
    M.querySelectorAll('[data-pen]').forEach((b) => (b.onclick = () => pen(b.dataset.pen, addFile)));
    $('#bk').onclick = back;
    const save = async (status, then) => { try { await api('PUT', '/teach/submissions/' + id, { status, score: $('#sc').value, feedback: $('#fbt').value, feedback_files: fb.map((f) => f.id) }); toast(status === 'checked' ? 'Baholandi ✅' : 'O‘quvchiga qaytarildi ↩️'); then(); } catch (e) { $('#ce').innerHTML = `<div class="err">${esc(e.message)}</div>`; } };
    $('#ok').onclick = () => save('checked', back);
    $('#ret').onclick = () => save('returned', back);
    if (nextId) $('#nx').onclick = () => save('checked', () => check(nextId, back, queue.filter((x) => x !== id)));
  }

  // O‘quvchi rasmining ustiga qizil ruchka bilan belgilash va izohga biriktirish
  function pen(url, addFile) {
    const ov = document.createElement('div'); ov.className = 'pen';
    ov.innerHTML = `<div class="bar"><b>🖍️ Rasm ustida belgilang</b>${['#e53935', '#1e63e5', '#1fbf75', '#111'].map((c, i) => `<button class="c" data-col="${c}" style="background:${c};${i ? '' : 'outline:3px solid #ffd23f'}"></button>`).join('')}
      <select id="pw" style="width:auto"><option value="3">Ingichka</option><option value="6" selected>O‘rta</option><option value="12">Qalin</option></select>
      <button class="btn w sm" id="pu">↶ Bekor qilish</button><span style="flex:1"></span><button class="btn w" id="pc">Yopish</button><button class="btn g" id="ps">💾 Izohga biriktirish</button></div><div class="wrap"><canvas></canvas></div>`;
    document.body.appendChild(ov);
    const cv = ov.querySelector('canvas'), cx = cv.getContext('2d'); const img = new Image(); let color = '#e53935'; const hist = [];
    img.onload = () => { const k = Math.min(1, 2000 / Math.max(img.width, img.height)); cv.width = img.width * k; cv.height = img.height * k; cx.drawImage(img, 0, 0, cv.width, cv.height); };
    img.src = url;
    let drawing = false;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (cv.width / r.width), (e.clientY - r.top) * (cv.height / r.height)]; };
    cv.onpointerdown = (e) => { drawing = true; cv.setPointerCapture(e.pointerId); hist.push(cx.getImageData(0, 0, cv.width, cv.height)); if (hist.length > 30) hist.shift();
      const [x, y] = pos(e); cx.strokeStyle = color; cx.lineWidth = +ov.querySelector('#pw').value * (cv.width / cv.getBoundingClientRect().width); cx.lineCap = cx.lineJoin = 'round'; cx.beginPath(); cx.moveTo(x, y); };
    cv.onpointermove = (e) => { if (!drawing) return; const [x, y] = pos(e); cx.lineTo(x, y); cx.stroke(); };
    cv.onpointerup = cv.onpointercancel = () => (drawing = false);
    ov.querySelectorAll('[data-col]').forEach((b) => (b.onclick = () => { color = b.dataset.col; ov.querySelectorAll('[data-col]').forEach((x) => (x.style.outline = x === b ? '3px solid #ffd23f' : '')); }));
    ov.querySelector('#pu').onclick = () => { const h = hist.pop(); if (h) cx.putImageData(h, 0, 0); };
    ov.querySelector('#pc').onclick = () => ov.remove();
    ov.querySelector('#ps').onclick = () => cv.toBlob((b) => { ov.remove(); addFile(new File([b], 'tekshirilgan.jpg', { type: 'image/jpeg' })); }, 'image/jpeg', 0.88);
  }

  window.kurs = kurs;
})();
