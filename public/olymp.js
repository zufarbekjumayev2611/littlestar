"use strict";
/* Little Star — O‘QUVCHI: "Olimpiada" bo‘limi (Al-Xorazmiy olimpiadasiga tayyorlov va boshqa onlayn kurslar).
   Kabinet skripti window.OLYMP(ctx) ni chaqirib, "olymp" sahifasini ro‘yxatdan o‘tkazadi. */
window.OLYMP = function (X) {
  const A = window.AC, esc = A.esc, $ = (s) => document.querySelector(s);
  const app = X.app;
  const css = document.createElement("style");
  css.textContent = `
  .ol-hero{background:linear-gradient(135deg,#ffd23f,#ff9f1c);color:#23204a;border-radius:24px;padding:20px;box-shadow:0 8px 0 rgba(0,0,0,.15);margin-bottom:16px}
  .ol-hero h2{margin:0 0 6px;font-size:28px;font-weight:900}
  .ol-live{display:flex;gap:12px;align-items:center;flex-wrap:wrap;background:linear-gradient(135deg,#ff3d6e,#ff7a45);color:#fff;border-radius:22px;padding:16px 18px;margin-bottom:16px;box-shadow:0 8px 0 rgba(0,0,0,.15)}
  .ol-live b{font-size:20px;flex:1;min-width:200px}
  .ol-join{display:inline-flex;align-items:center;gap:8px;background:#fff;color:#d81b60;text-decoration:none;font-weight:900;font-size:19px;padding:13px 20px;border-radius:16px;box-shadow:0 4px 0 rgba(0,0,0,.18)}
  .ol-join.off{background:#f1eeff;color:#23204a}
  .ol-dot{width:12px;height:12px;border-radius:50%;background:#fff;animation:olp 1s infinite}@keyframes olp{50%{opacity:.3}}
  .ol-sec{margin-top:18px}.ol-sec h3{display:flex;gap:8px;align-items:center}
  .ol-lock{background:#f7f5ff;border-radius:16px;padding:16px;font-weight:800;color:#7a74a8;text-align:center}
  .ol-score{font-size:46px;font-weight:900;color:#1fbf75;line-height:1}
  .ol-fb{background:#fff6d6;border-radius:16px;padding:14px;margin-top:10px}
  .ol-cm{background:#f7f5ff;border-radius:14px;padding:10px 12px;margin:8px 0}.ol-cm.t{background:#e7f8ef}
  .ol-up{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}.ol-up .x{position:relative}.ol-up .x button{position:absolute;top:2px;right:8px;background:#ff5c8a;color:#fff;border-radius:50%;width:28px;height:28px;font-weight:900}
  textarea.ol-ta{font:inherit;font-weight:700;font-size:17px;padding:11px 14px;border-radius:14px;border:3px solid #e6e1ff;width:100%;min-height:110px;resize:vertical;outline:none;color:#23204a}
  textarea.ol-ta:focus{border-color:#8e5cff}
  .ol-ann{background:#fff6d6;border-radius:16px;padding:12px 14px;margin:8px 0}`;
  document.head.appendChild(css);

  const state = { course: null, lesson: null };
  // To‘g‘ridan-to‘g‘ri havola: #olymp-c3 (kurs) yoki #olymp-l12 (dars) — Telegram’da ulashish va sahifa yangilanganda joyida qolish uchun
  let deep = /^#olymp-([cl])(\d+)$/.exec(location.hash);
  const setHash = (h) => { try { history.replaceState(null, '', '#olymp' + h); } catch (e) {} };
  const nowS = () => Date.now() / 1000;
  const ST = { submitted: ['tag', '🕓 Tekshirilmoqda'], checked: ['tag g', '✅ Tekshirildi'], returned: ['tag', '↩️ Qayta ishlang'] };
  const subTag = (s, max) => (!s ? '' : s.status === 'checked' ? `<span class="tag g">✅ ${s.score}/${max} ball</span>` : `<span class="${ST[s.status][0]}">${ST[s.status][1]}</span>`);

  function joinBtn(lessonId, url, live) {
    if (!url) return `<span class="ol-join off">🎥 Havola hali qo‘yilmagan</span>`;
    return `<a class="ol-join ${live ? '' : 'off'}" href="${esc(url)}" target="_blank" rel="noopener" data-join="${lessonId}">${live ? '<span class="ol-dot" style="background:#d81b60"></span> Jonli darsga qo‘shilish' : '🎥 Dars xonasiga kirish'}</a>`;
  }
  function bindJoin() {
    app.querySelectorAll('[data-join]').forEach((a) => a.addEventListener('click', () => { X.api('POST', `/academy/lessons/${a.dataset.join}/join`, { child: X.child().id }).catch(() => {}); }));
  }

  /* ---------- kurslar ---------- */
  async function view() {
    if (state.lesson) return lesson(state.lesson);
    if (state.course) return course(state.course);
    setHash('');
    X.loading();
    try { await X.loadMe(); } catch (e) { app.innerHTML = X.errBox(e); return; }
    const ME = X.me();
    const hero = `<div class="ol-hero"><h2>🎓 Olimpiadaga tayyorlov</h2><p style="margin:0;font-weight:800">Al-Xorazmiy olimpiadasi (7–8-sinflar): jonli onlayn darslar, video yechimlar, uyga vazifalar va ularni o‘qituvchi tekshiradi.</p></div>`;
    if (!ME) { app.innerHTML = hero + `<div class="card"><p class="muted" style="margin-top:0">Kursga yozilish uchun akkauntga kiring yoki ro‘yxatdan o‘ting.</p><button class="go" id="lg">👤 Kirish / Ro‘yxatdan o‘tish</button></div>`; $('#lg').onclick = () => X.go('profile', true); return; }
    if (deep) { const [, k, n] = deep; deep = null; return k === 'l' ? lesson(+n) : course(+n); }
    if (!ME.children.length) { app.innerHTML = hero + `<div class="card"><p class="muted" style="margin-top:0">Avval o‘quvchi profilini qo‘shing (ism-familiya, sinf, viloyat).</p><button class="go" id="ak">➕ O‘quvchi qo‘shish</button></div>`; $('#ak').onclick = () => X.childForm(null, view); return; }
    let list; try { list = await X.api('GET', '/academy/courses?child=' + X.child().id); } catch (e) { app.innerHTML = X.errBox(e); return; }
    const bg = ['linear-gradient(135deg,#3d8bff,#5fb0ff)', 'linear-gradient(135deg,#8e5cff,#b07bff)', 'linear-gradient(135deg,#1fa36b,#3fd6a8)', 'linear-gradient(135deg,#ff5c8a,#ff8f6b)'];
    app.innerHTML = hero + `<div class="card"><h3>Kim o‘qiydi?</h3>${X.kidsBar()}</div>
      <div class="sgrid">${list.map((c, i) => `<button class="scard" data-c="${c.id}" style="background:${bg[i % bg.length]}">
        ${c.status === 'active' ? '<span class="lock">✅ Siz kursdasiz</span>' : c.status === 'pending' ? '<span class="lock">⏳ Ariza yuborilgan</span>' : ''}
        <span class="ic">${c.grade >= 7 ? '🧮' : '⭐'}</span><b>${esc(c.title)}</b><small>${esc(c.description)}</small>
        <small>📅 ${c.lessons} ta dars${c.next ? ` · keyingisi: ${A.fmtDay(c.next.starts_at)}` : ''}</small>
        <small style="margin-top:10px;font-weight:900;font-size:16px">${c.status === 'active' ? '▶️ Kursga kirish' : c.status === 'pending' ? 'O‘qituvchi tasdiqlashini kuting' : c.status === 'removed' ? 'O‘qituvchiga murojaat qiling' : '➕ Kursga yozilish'}</small></button>`).join('') || '<div class="card"><p class="muted">Hozircha kurs yo‘q.</p></div>'}</div>`;
    X.bindKids(view);
    app.querySelectorAll('[data-c]').forEach((b) => (b.onclick = async () => {
      const c = list.find((x) => x.id === +b.dataset.c);
      if (c.status === 'active') { state.course = c.id; return course(c.id); }
      if (c.status === 'pending') return info('⏳ Ariza yuborilgan', 'O‘qituvchi arizangizni tasdiqlagach, kurs ochiladi. Odatda bu to‘lov yoki ro‘yxatga olishdan keyin bo‘ladi.');
      if (c.status === 'removed') return info('Kurs yopiq', 'Bu kursga qayta qo‘shilish uchun o‘quv markazi bilan bog‘laning.');
      const ch = X.child();
      const m = X.modal(`<h3>${esc(c.title)}</h3><p class="muted">👦 ${esc(ch.name)} (${ch.grade}-sinf) uchun kursga yozilish arizasi yuborilsinmi?</p><div class="btns"><button class="btn w" id="n">Bekor</button><button class="btn g" id="y">📨 Ariza yuborish</button></div>`);
      m.querySelector('#n').onclick = () => m.remove();
      m.querySelector('#y').onclick = async () => { try { const r = await X.api('POST', `/academy/courses/${c.id}/join`, { child: ch.id }); m.remove(); if (r.status === 'active') { state.course = c.id; course(c.id); } else { info('✅ Ariza yuborildi', 'O‘qituvchi tasdiqlagach, kurs ochiladi.'); view(); } } catch (e) { m.querySelector('.btns').insertAdjacentHTML('beforebegin', `<div class="err">${esc(e.message)}</div>`); } };
    }));
  }
  function info(t, msg) { const m = X.modal(`<h3>${t}</h3><p class="muted">${msg}</p><div class="btns"><button class="btn" id="ok">Tushunarli</button></div>`); m.querySelector('#ok').onclick = () => m.remove(); }

  /* ---------- kurs ---------- */
  async function course(id) {
    state.course = id; state.lesson = null; setHash('-c' + id); X.loading();
    let d; try { d = await X.api('GET', `/academy/courses/${id}?child=${X.child().id}`); } catch (e) { app.innerHTML = X.errBox(e); return; }
    if (d.status !== 'active') { state.course = null; return view(); }
    const t = nowS();
    const live = d.lessons.find((l) => A.liveState(l, t) === 'live');
    const next = d.lessons.find((l) => A.liveState(l, t) === 'soon');
    const todo = d.lessons.filter((l) => l.has_hw && (!l.sub || l.sub.status === 'returned') && (!l.hw_due || l.hw_due > t - 7 * 86400));
    app.innerHTML = `<div class="bar-top"><button class="back" id="bk">← Kurslar</button><div class="ttl">🎓 ${esc(d.course.title)}</div></div>
      ${live ? `<div class="ol-live"><span class="ol-dot"></span><b>Dars hozir: ${esc(live.title)}</b><button class="ol-join" data-l="${live.id}">Darsga o‘tish →</button></div>` : next ? `<div class="card" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><div style="flex:1"><h3 style="margin:0">⏰ Keyingi dars</h3><p class="muted" style="margin:4px 0 0">${esc(next.title)} — <b>${A.fmtDay(next.starts_at)}</b></p></div><button class="btn" data-l="${next.id}">Ochish</button></div>` : ''}
      <div class="card"><div class="kids">${X.kidsBar()}</div></div>
      ${d.announcements.length ? `<div class="card"><h3>📢 E’lonlar</h3>${d.announcements.slice(0, 3).map((a) => `<div class="ol-ann"><div class="muted" style="font-size:13px">${A.fmtDT(a.created_at)}</div>${A.rich(a.text)}</div>`).join('')}</div>` : ''}
      ${todo.length ? `<div class="card"><h3>📝 Bajarilishi kerak</h3><div class="tlist">${todo.map((l) => `<div class="trow" data-l="${l.id}" style="cursor:pointer"><div class="nm">${esc(l.title)}<div class="meta">${l.hw_due ? (l.hw_due < t ? '⚠️ Muddati o‘tgan: ' : '⏳ Muddat: ') + A.fmtDT(l.hw_due) : 'Muddatsiz'}</div></div>${subTag(l.sub, l.hw_max) || '<span class="tag">Topshirilmagan</span>'}</div>`).join('')}</div></div>` : ''}
      <div class="card"><h3>📅 Darslar</h3><div class="tlist">${d.lessons.map((l, i) => `<div class="trow" data-l="${l.id}" style="cursor:pointer"><div class="nm">${i + 1}. ${esc(l.title)}<div class="meta">🗓️ ${A.fmtDay(l.starts_at)}${l.videos ? ` · 🎬 ${l.videos} ta video` : ''}</div></div>
        ${A.liveState(l, t) === 'live' ? '<span class="tag" style="background:#ff3d6e;color:#fff">🔴 Jonli</span>' : ''}${l.has_hw ? subTag(l.sub, l.hw_max) || '<span class="tag">📝 Vazifa bor</span>' : ''}<button class="btn w">Ochish →</button></div>`).join('') || '<p class="muted">Darslar jadvali tez orada qo‘shiladi.</p>'}</div></div>`;
    $('#bk').onclick = () => { state.course = null; view(); };
    X.bindKids(() => course(id));
    app.querySelectorAll('[data-l]').forEach((b) => (b.onclick = () => lesson(+b.dataset.l)));
    A.math(app);
  }

  /* ---------- dars ---------- */
  async function lesson(id) {
    state.lesson = id; setHash('-l' + id); X.loading();
    let d; try { d = await X.api('GET', `/academy/lessons/${id}?child=${X.child().id}`); } catch (e) { state.lesson = null; app.innerHTML = X.errBox(e); return; }
    const L = d.lesson; state.course = L.course_id;
    const t = d.server_time; const ls = A.liveState(L, t);
    const by = (k) => d.items.filter((i) => i.kind === k);
    const videos = by('video'), mats = by('material'), hwItems = by('homework'), sols = by('solution');
    const hasHw = !!L.hw_text || hwItems.length > 0;
    const sub = d.submission;
    const canEdit = !sub || sub.status !== 'checked';
    const files = sub && canEdit ? sub.files.slice() : [];
    app.innerHTML = `<div class="bar-top"><button class="back" id="bk">← ${esc(L.course_title)}</button><div class="ttl">${esc(L.title)}</div></div>
      ${ls === 'live' ? `<div class="ol-live"><span class="ol-dot"></span><b>Dars hozir davom etmoqda!</b>${joinBtn(L.id, L.live_url, true)}</div>` : ''}
      <div class="card"><h2>${esc(L.title)}</h2><p class="muted" style="margin:4px 0 12px">🗓️ ${A.fmtDay(L.starts_at)} · ⏱️ ${L.duration_min} daqiqa</p>
        ${ls === 'soon' ? `<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><p class="muted" style="flex:1;margin:0">🎥 Jonli dars shu vaqtda boshlanadi. Tugma 15 daqiqa oldin qizil rangga kiradi.</p>${joinBtn(L.id, L.live_url, false)}</div>` : ''}
        ${ls === 'past' || ls === 'none' ? (L.live_url && ls === 'none' ? joinBtn(L.id, L.live_url, false) : '') : ''}
        ${L.body ? `<div style="margin-top:12px">${A.rich(L.body)}</div>` : ''}</div>
      ${videos.length ? `<div class="card"><h3>🎬 Video darslar</h3>${videos.map(A.media).join('')}</div>` : ''}
      ${mats.length ? `<div class="card"><h3>📚 Materiallar</h3>${mats.map(A.media).join('')}</div>` : ''}
      ${hasHw ? `<div class="card" id="hw"><h3>📝 Uyga vazifa ${sub ? subTag(sub, L.hw_max) : ''}</h3>
        ${L.hw_due ? `<p class="muted" style="margin:0 0 8px">${L.hw_due < t ? '⚠️ Topshirish muddati o‘tgan: ' : '⏳ Topshirish muddati: '}<b>${A.fmtDT(L.hw_due)}</b> · Maksimal ball: ${L.hw_max}</p>` : `<p class="muted" style="margin:0 0 8px">Maksimal ball: ${L.hw_max}</p>`}
        ${L.hw_text ? A.rich(L.hw_text) : ''}${hwItems.map(A.media).join('')}
        ${sub && (sub.status === 'checked' || sub.status === 'returned') ? `<div class="ol-fb">${sub.status === 'checked' ? `<div class="ol-score">${sub.score} / ${L.hw_max}</div>` : '<b>↩️ O‘qituvchi vazifani qayta ishlash uchun qaytardi</b>'}
          ${sub.feedback ? `<div style="margin-top:8px"><b>👩‍🏫 O‘qituvchi izohi:</b>${A.rich(sub.feedback)}</div>` : ''}${sub.feedback_files.length ? `<div style="margin-top:8px">${A.thumbs(sub.feedback_files)}</div>` : ''}</div>` : ''}
        ${sub && sub.status === 'checked' ? `<details style="margin-top:12px"><summary class="muted" style="cursor:pointer">Mening javobim</summary>${sub.text ? A.rich(sub.text) : ''}<div>${A.thumbs(sub.files)}</div></details>` : `
        <div style="margin-top:14px">${sub && sub.status === 'submitted' ? `<div class="ok">✅ Topshirildi: ${A.fmtDT(sub.submitted_at)}. O‘qituvchi tekshirguncha o‘zgartirishingiz mumkin.</div>` : ''}
          <textarea class="ol-ta" id="ans" placeholder="Javob va yechimingizni yozing (ixtiyoriy). Daftarga yozgan bo‘lsangiz — rasmga olib yuklang 👇">${esc(sub ? sub.text : '')}</textarea>
          <div class="ol-up" id="fl"></div><div id="pr"></div>
          <div class="btns" style="justify-content:flex-start;margin-top:6px"><label class="btn w">📷 Rasm / PDF qo‘shish<input type="file" id="fi" accept="image/*,application/pdf" multiple hidden></label><button class="btn g" id="snd">📤 ${sub ? 'Qayta yuborish' : 'Vazifani topshirish'}</button></div><div id="se"></div></div>`}</div>` : ''}
      ${sols.length || L.solutions_mode !== 'now' ? `<div class="card"><h3>✅ Yechimlar</h3>${d.solutions_open ? (sols.map(A.media).join('') || '<p class="muted">Yechimlar hali joylanmagan.</p>') : `<div class="ol-lock">🔒 ${L.solutions_mode === 'after_due' && L.hw_due ? `Video yechimlar vazifa muddati tugagach (${A.fmtDT(L.hw_due)}) ochiladi. Avval o‘zingiz yechib ko‘ring! 💪` : 'Yechimlarni o‘qituvchi keyinroq ochadi.'}</div>`}</div>` : ''}
      <div class="card"><h3>💬 Savollar</h3><p class="muted" style="margin-top:0">Tushunmagan joyingizni yozing — o‘qituvchi javob beradi.</p><div id="cms"></div>
        <textarea class="ol-ta" id="cmt" style="min-height:70px" placeholder="Savolingiz..."></textarea><button class="btn" id="cms2" style="margin-top:8px">📤 Yuborish</button></div>`;
    $('#bk').onclick = () => course(L.course_id);
    bindJoin();
    const drawCm = (list) => { $('#cms').innerHTML = list.map((m) => `<div class="ol-cm ${m.teacher ? 't' : ''}"><b>${m.teacher ? '👩‍🏫 ' : '🧒 '}${esc(m.author)}</b> <span class="muted" style="font-size:13px">${A.fmtDT(m.created_at)}</span>${A.rich(m.text)}</div>`).join(''); A.math($('#cms')); };
    drawCm(d.comments);
    $('#cms2').onclick = async () => { const b = $('#cms2'); b.disabled = true; try { const r = await X.api('POST', `/academy/lessons/${id}/comments`, { child: X.child().id, text: $('#cmt').value }); $('#cmt').value = ''; drawCm(r.comments); } catch (e) { alert(e.message); } b.disabled = false; };
    if ($('#fi')) {
      const drawF = () => { $('#fl').innerHTML = files.map((f, i) => `<div class="x">${A.thumbs([f])}<button data-x="${i}" title="Olib tashlash">✕</button></div>`).join('');
        $('#fl').querySelectorAll('[data-x]').forEach((b) => (b.onclick = () => { files.splice(+b.dataset.x, 1); drawF(); })); };
      drawF();
      let busy = 0;
      $('#fi').onchange = async (e) => {
        for (const raw of [...e.target.files]) {
          busy++; const box = document.createElement('div'); box.innerHTML = `<span class="muted">${esc(raw.name)} yuklanmoqda...</span><div class="ac-prog"><i></i></div>`; $('#pr').appendChild(box);
          try { const f = await A.shrink(raw); const r = await A.upload(f, X.token(), (p) => (box.querySelector('i').style.width = p * 100 + '%')); files.push(r); drawF(); box.remove(); }
          catch (err) { box.innerHTML = `<div class="err">${esc(raw.name)}: ${esc(err.message)}</div>`; }
          busy--;
        }
        e.target.value = '';
      };
      $('#snd').onclick = async () => {
        if (busy) { $('#se').innerHTML = '<div class="err">Fayllar yuklanib bo‘lishini kuting...</div>'; return; }
        const b = $('#snd'); b.disabled = true; $('#se').innerHTML = '';
        try { await X.api('POST', `/academy/lessons/${id}/submit`, { child: X.child().id, text: $('#ans').value, files: files.map((f) => f.id) }); window.LS && window.LS.sGood && window.LS.sGood(); lesson(id); }
        catch (e) { $('#se').innerHTML = `<div class="err">${esc(e.message)}</div>`; b.disabled = false; }
      };
    }
    A.math(app);
  }

  return { olymp: () => { state.course = null; state.lesson = null; view(); } };
};
