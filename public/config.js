// Little Star — sayt sozlamasi.
// Backend (API) manzili — Render'dagi xizmat (oxirida "/" siz).
// Sayt va API bitta xizmatda bo'lsa — bo'sh qoldiring: "".
// DIQQAT: manzil o'zgarsa, public/_headers va vercel.json dagi "connect-src" qatorini ham yangilang.
window.LS_API = "https://littlestar-backend-1y5p.onrender.com";

// Tezlik uchun: API serveriga ulanish sahifa ochilishi bilan boshlanadi va uxlab qolgan
// (Render bepul rejasi) server darhol uyg'otiladi — foydalanuvchi kirishni bosguncha tayyor bo'ladi.
(function () {
  if (!window.LS_API) return;
  try {
    var l = document.createElement("link"); l.rel = "preconnect"; l.href = window.LS_API; l.crossOrigin = "anonymous";
    document.head.appendChild(l);
    fetch(window.LS_API + "/api/health", { mode: "cors", cache: "no-store" }).catch(function () {});
  } catch (e) {}
})();
