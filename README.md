# Little Star — o‘rnatish bo‘yicha qo‘llanma (dasturchi uchun)

Navoiy-Qorako‘l o‘quv markazining 6–10 yoshli bolalar uchun ta’limiy platformasi. Domen: **littlestar.uz**.

## Tarkibi

| Qism | Tavsif |
|---|---|
| `public/index.html` | Asosiy ilova (PWA). Unda 4 bo‘lim bor: **O‘yinlar** (bepul, server talab qilmaydi), **Testlar**, **Reyting** va **Kabinet** |
| `public/admin.html` | Admin panel (`/admin`): statistika, bepul/pullik rejim, testlar va savollar muharriri, matndan import, obuna berish |
| `server/server.js` | Backend: Node.js va o‘rnatilgan SQLite (`node:sqlite`). **Tashqi kutubxona yo‘q, `npm install` shart emas** |
| `server/seed.js` | Birinchi ishga tushishda har bo‘lim uchun 3 tadan namunaviy variant yaratadi. Savollar dastur bilan hisoblangan |
| `deploy/` | systemd xizmati, Nginx konfiguratsiyasi va zaxira nusxa skripti |

Test bo‘limlari:
- **PM 1-bosqich:** matematika, 30 ta savol (10 yengil, 10 o‘rta, 10 murakkab).
- **PM 2-bosqich:** matematika 40 ta + ingliz tili 40 ta.
- **Ixtisoslashtirilgan maktab (5-sinfga):** matematika 30 ta (shundan 10 tasi mantiqiy fikrlash) + ingliz tili 15 ta, 105 daqiqa.
- **Olimpiada:** 3-sinf va 4-sinf uchun alohida.

Har bir testning vaqtini admin paneldan o‘zgartirish mumkin.

## 🎓 Olimpiadaga tayyorlov bo‘limi
Saytda **🎓 Olimpiada** sahifasi, admin panelda **🎓 Olimpiadaga tayyorlov** bo‘limi bor. Bo‘lim uch darajadan iborat: **olimpiada → sinf bo‘yicha kurs → darslar**.
Birinchi ishga tushirishda **“Al-Xorazmiy olimpiadasi”** yaratiladi. Uning ichida ikkita kurs bo‘ladi: “Al-Xorazmiy olimpiadasi — 7-sinf” va “— 8-sinf”. Keyinchalik boshqa olimpiadani qo‘shish uchun admin panelda **“➕ Yangi olimpiada”** tugmasini bosing (nom, belgi, tavsif), so‘ng uning ichida **“➕ Kurs qo‘shish”** orqali sinflarni oching. O‘quvchilar avval olimpiadani, keyin o‘z sinfini tanlaydi.

**O‘qituvchi (admin panel → Olimpiadaga tayyorlov):**
- **Darslar jadvali:** mavzu, sana-vaqt, davomiylik, konspekt. Matnda formulalar yozish mumkin: `$a^2+b^2=c^2$`.
- **Jonli dars:** “🎥 Jitsi xona yaratish” tugmasi bepul video konferensiya havolasini yaratadi. Zoom yoki Google Meet havolasini ham qo‘yish mumkin. Kursga bitta doimiy havola yoki har bir darsga alohida havola beriladi. O‘quvchi “Jonli darsga qo‘shilish” tugmasini bossa, davomat avtomatik belgilanadi.
- **Videolar va materiallar:** turlari 🎬 video dars, 📚 material, 📝 uy vazifasi fayli va ✅ yechim. Fayl to‘g‘ridan-to‘g‘ri yuklanadi (2 GB gacha) yoki YouTube havolasi qo‘yiladi. Katta videolarni YouTube’ga “unlisted” qilib joylash tavsiya etiladi.
- **Yechimlar qachon ochiladi:** vazifa muddati tugagach, darhol yoki hozircha yashirin.
- **Uyga vazifa:** shart, muddat va maksimal ball. O‘quvchi javobni matn, rasm (telefonda daftarni suratga oladi) yoki PDF ko‘rinishida topshiradi.
- **Vazifani tekshirish:** ball, izoh va fayl biriktiriladi. O‘quvchi rasmining ustiga **qizil ruchka bilan belgilash** mumkin. Vazifani “qayta ishlashga qaytarish” ham mumkin. “Saqlash va keyingisi” tugmasi navbatdagi vazifaga o‘tkazadi.
- **O‘quvchilar:** kursga yozilish arizalarini qabul qilish yoki rad etish, telefon raqami bo‘yicha qo‘lda qo‘shish, kursdan chiqarish. Sozlamalarda arizalarni avtomatik qabul qilishni yoqish mumkin.
- **Jurnal:** davomat va har bir dars bo‘yicha ball. Excel (CSV) faylga yuklab olinadi.
- **E’lonlar** va har bir dars ostida **savol-javob**.

**Rollar:** admin “Foydalanuvchilar” bo‘limida istalgan akkauntni **O‘qituvchi** qilib belgilashi mumkin. O‘qituvchi admin panelga kiradi va faqat “Olimpiada kurslari” bo‘limini ko‘radi.

**O‘quvchi:** ota-ona akkauntiga 7- yoki 8-sinf o‘quvchi profili qo‘shiladi (endi 1–11-sinflar mavjud). Keyin “Olimpiada” sahifasida kursga ariza yuboriladi. Kurs ochilgach, o‘quvchi darslarni, jonli dars tugmasini, videolarni, vazifalarni, baholarni va yechimlarni ko‘radi. Har bir olimpiada, kurs va dars uchun havola mavjud (`/#olymp-o1`, `/#olymp-c3`, `/#olymp-l12`), uni Telegram’da ulashish mumkin.

**Fayllar** `data/uploads/` papkasida saqlanadi (`DATA_DIR` o‘zgaruvchisi bilan o‘zgartirish mumkin). Havolalarda tasodifiy uzun kalit bor, uni bilmagan odam faylni ocha olmaydi. Zaxira skripti bu papkani ham nusxalaydi.

## Talablar
- Ubuntu 22.04/24.04 VPS (1 GB RAM yetarli).
- **Node.js 22.13 yoki undan yangi** (24 LTS tavsiya qilinadi).
- Nginx va certbot (HTTPS uchun). PWA va telefon ilovasi faqat **HTTPS** bilan ishlaydi.

> Diqqat: endi bu oddiy statik sayt emas. Netlify/GitHub Pages yetmaydi, chunki serverli hosting (VPS) kerak.

## O‘rnatish
```bash
# 1) Node.js 24
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - && sudo apt install -y nodejs nginx sqlite3
# 2) Fayllar
sudo useradd -r -s /usr/sbin/nologin littlestar
sudo mkdir -p /opt/littlestar && sudo cp -r . /opt/littlestar && sudo chown -R littlestar /opt/littlestar
# 3) Birinchi admin (telefon raqami 998 bilan, parol kamida 6 belgi)
cd /opt/littlestar && sudo -u littlestar node --no-warnings server/server.js --create-admin 998XXXXXXXXX KuchliParol
# 4) Xizmat
sudo cp deploy/littlestar.service /etc/systemd/system/ && sudo systemctl enable --now littlestar
# 5) Nginx + HTTPS
sudo cp deploy/nginx-littlestar.conf /etc/nginx/sites-available/littlestar
sudo ln -s /etc/nginx/sites-available/littlestar /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d littlestar.uz -d www.littlestar.uz
# 6) Kunlik zaxira nusxa
sudo crontab -e   # 15 3 * * * /opt/littlestar/deploy/backup.sh
```
DNS: `littlestar.uz` va `www` uchun A-yozuvni VPS IP manziliga yo‘naltiring.

Lokal sinash: `npm start` buyrug‘idan keyin http://localhost:3000 va http://localhost:3000/admin manzillarini oching.

## Sozlamalar (environment)
| O‘zgaruvchi | Standart qiymat |
|---|---|
| `PORT` | 3000 |
| `DB_PATH` | `data/littlestar.db` |
| `DATA_DIR` | `DB_PATH` joylashgan papka (yuklangan fayllar `uploads/` ichida) |

Barcha ma’lumotlar bitta SQLite faylida saqlanadi. Zaxira nusxasini muntazam olish kerak.

## Yangilash
`public/` va `server/` fayllarini almashtirib, `sudo systemctl restart littlestar` buyrug‘ini bering. `data/` papkasiga **tegmang**.

Telefonlardagi ilova yangi versiyani darhol olishi uchun `public/sw.js` faylidagi `VERSION` qiymatini oshiring.

## Asosiy qoidalar (biznes mantiq)
- **Kirish:** ota-onaning telefon raqami va paroli bilan. Bitta akkauntga 5 tagacha bola profili qo‘shiladi. Reyting bola nomidan yuritiladi.
- **Reyting:** har bir testning **birinchi yakunlangan urinishi** hisoblanadi, qayta urinishlar faqat mashq uchun. Ball bo‘limdagi testlarning to‘g‘ri javoblari yig‘indisiga teng. Ballar teng bo‘lsa, tezroq yechgan yuqorida turadi. Reytingni respublika, viloyat va sinf bo‘yicha ko‘rish mumkin.
- **Pullik rejim:** admin paneldagi “Hamma uchun bepul” tugmasi. U o‘chirilganda, belgilangan bo‘limlar faqat `premium_until` muddati tugamagan akkauntlarga ochiladi. O‘yinlar bo‘limi doim bepul.
- To‘g‘ri javoblar brauzerga test yakunlangandan keyingina yuboriladi. Ball server tomonida hisoblanadi.

## Keyingi bosqichlar (dasturchi uchun vazifalar)
1. **To‘lov (Click / Payme):** muvaffaqiyatli to‘lovdan keyin `accounts.premium_until` maydonini uzaytirish kifoya. Bunda `PUT /api/admin/users/:id {premium_days}` mantig‘idan foydalaning.
2. **SMS orqali tasdiqlash** (masalan, Eskiz.uz): ro‘yxatdan o‘tish va parolni tiklash uchun.
3. **Ko‘p foydalanuvchi bo‘lganda:** reyting so‘rovlarini keshlash yoki PostgreSQL’ga o‘tish. Hozirgi SQLite o‘n minglab foydalanuvchiga yetadi.
4. **Play Market:** sayt HTTPS’da ishlagach, PWABuilder orqali TWA paket yasaladi. Buning uchun `/.well-known/assetlinks.json` fayli kerak bo‘ladi.

## API qisqacha
`POST /api/auth/register|login|logout` · `GET /api/meta` · `GET /api/me` · `POST|PUT|DELETE /api/children[/:id]` ·
`GET /api/tests?section=&child=` · `POST /api/tests/:id/start {child}` · `POST /api/attempts/:id/submit {answers}` ·
`GET /api/leaderboard?section=&grade=&region=` · Admin: `GET /api/admin/stats`, `PUT /api/admin/settings`, `GET|POST|PUT|DELETE /api/admin/tests[/:id]`, `PUT /api/admin/tests/:id/questions`, `GET|PUT /api/admin/users[/:id]`.
Olimpiada: `POST /api/upload?name=` (fayl oqimi), `GET /files/:id/:key/:name` · O‘quvchi: `GET /api/academy/olympiads?child=`, `GET /api/academy/courses?child=&olympiad=`, `POST /api/academy/courses/:id/join`, `GET /api/academy/courses/:id?child=`, `GET /api/academy/lessons/:id?child=`, `POST /api/academy/lessons/:id/join|submit|comments` · O‘qituvchi: `/api/teach/olympiads[/:id]`, `/api/teach/courses[/:id]`, `/api/teach/courses/:id/lessons|students|announcements|journal`, `/api/teach/lessons/:id`, `/api/teach/submissions[/:id]`.
Avtorizatsiya: `Authorization: Bearer <token>`.
