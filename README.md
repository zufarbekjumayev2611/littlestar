# Little Star — sayt (frontend)

Navoiy-Qorako‘l o‘quv markazining ta’limiy platformasi. Domen: **littlestar.uz**.

Bu repoda faqat **sayt (frontend)** qismi turadi. Server (API) va ma’lumotlar bazasi (Turso) alohida repoda: [`littlestar_backend`](https://github.com/zufarbekjumayev2611/littlestar_backend).

```
 Sayt (littlestar.uz, shu repo)  ──HTTPS──►  API (api.littlestar.uz)  ──►  Turso
```

## Tarkibi (`public/`)
| Fayl | Tavsif |
|---|---|
| `index.html` | Asosiy ilova (PWA). Bo‘limlar: **O‘yinlar** (serversiz ishlaydi), **Testlar**, **🎓 Olimpiada**, **Reyting**, **Kabinet** |
| `admin.html` | Admin va o‘qituvchi paneli: statistika, testlar muharriri, foydalanuvchilar, **Olimpiadaga tayyorlov** (kurslar, darslar, vazifalarni tekshirish, jurnal, to‘lovlar) |
| `olymp.js` | O‘quvchi uchun olimpiada bo‘limi: kursga yozilish/to‘lov, darslar, jonli dars, videolar, uyga vazifa |
| `teach.js` | O‘qituvchi paneli (olimpiada kurslari) |
| `acad-lib.js` | Umumiy yordamchilar: fayl yuklash, video/rasm ko‘rsatish, formulalar (KaTeX) |
| `config.js` | **Backend (API) manzili** — pastga qarang |
| `sw.js`, `manifest.webmanifest`, `icons/` | Telefonga ilova sifatida o‘rnatish (PWA) |

## Sozlash: API manzili
`public/config.js` faylida backend manzili yoziladi:
```js
window.LS_API = "https://api.littlestar.uz";
```
Sayt va API bitta domenda bo‘lsa (masalan, Nginx `/api` va `/files` yo‘llarini backendga yo‘naltirsa), `""` qoldiring.

Backend tomonida `.env` faylidagi `CORS_ORIGINS` qatoriga sayt manzili yozilgan bo‘lishi kerak (masalan `https://littlestar.uz,https://www.littlestar.uz`). Aks holda brauzer API’ga murojaat qila olmaydi.

Bu faylda maxfiy narsa **yo‘q**: API manzili baribir ochiq bo‘ladi. Barcha kalitlar (Turso, Payme, Click) faqat backend’ning `.env` faylida turadi.

## Joylashtirish (hosting)
Sayt oddiy statik fayllardan iborat, build qilish shart emas. Istalgan statik hostingga `public/` papkasini qo‘ying:
- **Cloudflare Pages / Netlify / Vercel:** repoga ulang, “Build command” bo‘sh qoldiriladi, “Output (publish) directory” = `public`.
- **O‘z serveringiz (Nginx):** `public/` ichidagi fayllarni `/var/www/littlestar` papkasiga nusxalang va `root` qilib bering.

Domen: `littlestar.uz` saytga, `api.littlestar.uz` esa backend serverga yo‘naltiriladi. PWA, ya’ni telefonga o‘rnatish, faqat **HTTPS** bilan ishlaydi.

Telefonlardagi ilova yangilanishni darhol olishi uchun har yangilashda `public/sw.js` faylidagi `VERSION` qiymatini oshiring.

Lokal sinash: `cd public && python3 -m http.server 8080`. Bunda `config.js` ichida lokal backend manzilini yozing, masalan `http://localhost:3000`.

## Asosiy imkoniyatlar
- **Kirish:** ota-ona telefon raqami va parol bilan (`+998` bilan yoki usiz yozish mumkin). Bitta akkauntga 5 tagacha bola (1–11-sinf).
- **Testlar va reyting:** Prezident maktablari, ixtisoslashtirilgan maktablar, 3–4-sinf olimpiadasi. Reytingga har bir testning birinchi urinishi hisoblanadi. Ballar respublika, viloyat va sinf bo‘yicha ko‘rsatiladi.
- **🎓 Olimpiadaga tayyorlov:** olimpiada → kurs → darslar. Hozir **“Al-Xorazmiy olimpiadasi (7–8-sinflar)”** bor, admin panelda yangi olimpiadalar qo‘shiladi. Kurslarda quyidagilar bor:
  - jonli dars havolasi (Jitsi, Zoom yoki Meet) va davomat;
  - video darslar va yechimlar (yechimlar vazifa muddati tugagach ochiladi);
  - uyga vazifa (o‘quvchi daftar rasmini yuklaydi);
  - o‘qituvchi tekshiruvi (ball, izoh, rasm ustida qizil ruchka);
  - jurnal, e’lonlar va savol-javob.
- **To‘lov:** pullik kursga Payme yoki Click orqali to‘lanadi va kurs avtomatik ochiladi. Naqd to‘lovni o‘qituvchi paneldan belgilash mumkin. Sozlash yo‘riqnomasi backend README’sida.
- **Rollar:** admin, o‘qituvchi (faqat olimpiada kurslarini boshqaradi), oddiy foydalanuvchi.
