# Keamanan & Validasi — Soil Cloud API

Dokumen ini melengkapi `RANGKUMAN.md`. Fokus: autentikasi, autorisasi, dan validasi data.

Status: **sebagian diimplementasikan**. API key, validasi request, batas ukuran body, dan HTTPS lokal sudah ada di `server.js`; JWT, rate limit login, dan rate limit `POST /api/soil` belum. Semua nomor bagian mengacu ke `RANGKUMAN.md`.

---

## 1. Prinsip yang dipakai

1. **Rahasia tidak pernah meninggalkan server.** `SUPABASE_KEY` dan `JWT_SECRET` hanya ada di environment server.
2. **Setiap pintu punya kunci sendiri.** ESP32 pakai `x-api-key`, manusia pakai JWT. Tidak disatukan, supaya kelemahan satu sisi tidak menjatuhkan sisi lain.
3. **Password hanya dibandingkan di server.** Browser tidak pernah menerima hash.
4. **Tolak di pintu masuk, jangan bersihkan di belakang.** Data dianggap sah hanya setelah lolos validasi; setelah masuk database tidak ada penyaringan lagi.
5. **Pesan error tidak membocorkan informasi.** Tidak menyebut username ada atau tidak, tidak menyebut nama kolom internal ke pengguna.
6. **Hak akses ditentukan di dua tempat.** Di aplikasi (middleware) dan di database (RLS). Kalau satu salah konfigurasi, yang lain masih menahan.

---

## 2. Aset yang dilindungi

| Aset | Kalau bocor | Kalau dipalsukan |
|---|---|---|
| Password pengguna | Akun diambil alih di sistem lain bila password dipakai ulang | - |
| `JWT_SECRET` | - | Siapa pun bisa membuat token sendiri, masuk tanpa password |
| `SUPABASE_KEY` | Seluruh tabel terbaca, termasuk hash password | Seluruh tabel bisa diubah atau dihapus |
| `API_KEY` | - | Data sensor palsu bisa dimasukkan |
| Token JWT pengguna | Sesi dibajak sampai kedaluwarsa | - |
| Kredensial ESP32 | - | Data palsu masuk |

Catatan: `SUPABASE_KEY` adalah kunci paling berharga di sistem ini. Sekali bocor, RLS tidak menolong karena kunci itu memang dirancang melewati RLS.

---

## 3. Autentikasi

### 3.1 Dua jenis identitas

| Pihak | Cara membuktikan diri | Sifat | Masa berlaku |
|---|---|---|---|
| ESP32 | Header `x-api-key` | Rahasia tetap, dibagikan ke semua perangkat | Sampai dirotasi manual |
| Pengguna dashboard | Header `Authorization: Bearer <JWT>` | Token sementara hasil login | 7 hari |

Perbedaan ini disengaja. Perangkat tidak bisa diminta login berkala (tidak ada layar, tidak ada operator di lahan), jadi memakai kunci tetap. Manusia bisa login, jadi memakai token sementara.

### 3.2 Login pengguna

Alur:

```
1. Browser  -> POST /api/login { username, password }
2. Server   -> select id, username, password_hash from users where username = ?
3. Server   -> bcrypt.compare(password, password_hash)
4. Cocok    -> jwt.sign({ sub: id, username }, JWT_SECRET, { expiresIn: "7d" })
5. Browser  -> simpan token
```

Aturan yang mengikat:

| Aturan | Alasan |
|---|---|
| Password disimpan `bcrypt.hash(password, 10)`, bukan teks asli | Kalau database bocor, password tetap aman |
| Cost factor 10 | Tiap percobaan butuh ~100 ms. Memperlambat brute force tanpa membebani login normal |
| Bandingkan dengan `bcrypt.compare`, bukan `===` | `compare` menyamakan waktu, mencegah analisis waktu |
| Username tidak ada dan password salah memberi pesan **sama** | Mencegah penebakan username yang valid |
| Field kosong atau bukan teks ditolak lebih dulu | Menghindari kueri database yang sia-sia |
| Token berlaku 7 hari | Batas kompromi: cukup lama untuk kenyamanan, cukup pendek untuk membatasi kerusakan |

Isi token (payload) **bisa dibaca siapa pun**, karena JWT hanya ditandatangani, tidak dienkripsi. Jadi payload hanya berisi `sub` dan `username` (keduanya bukan rahasia). Jangan pernah menaruh password atau data pribadi di payload.

### 3.3 Rate limit login

```js
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { success: false, message: "Terlalu banyak percobaan, coba lagi nanti" }
});
```

| Parameter | Nilai | Alasan |
|---|---|---|
| `windowMs` | 15 menit | Cukup panjang untuk membuat brute force tidak praktis |
| `limit` | 10 percobaan | Manusia salah ketik paling banyak 2-3 kali; 10 sudah longgar |

Tanpa ini, password 6 digit bisa dihabiskan mesin dalam hitungan menit. Dengan bcrypt saja tidak cukup, karena bcrypt memperlambat tapi tidak menghentikan.

### 3.4 Verifikasi token pada tiap permintaan

```js
const authenticateUser = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return res.status(401).json({ success: false, message: "Unauthorized" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: "Unauthorized" });
  }
};
```

Yang dijaga oleh `jwt.verify` sekaligus: tanda tangan (tidak dipalsukan), masa berlaku (`exp`), dan bentuk payload. Satu panggilan menutup tiga celah, dan semua kegagalan bermuara ke `401` yang sama.

### 3.5 Autentikasi perangkat

```js
const authenticateApiKey = (req, res, next) => {
  if (req.headers["x-api-key"] !== process.env.API_KEY) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  next();
};
```

Pengerasan opsional (perbandingan waktu tetap):

```js
const crypto = require("crypto");

const safeEqual = (a, b) => {
  const A = Buffer.from(String(a || ""));
  const B = Buffer.from(String(b || ""));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
};
```

Nilainya kecil untuk sistem ini (perbedaan waktu lewat jaringan terlalu bising), tapi murah dan tidak merugikan.

### 3.6 Keluar (logout)

Keluar hanya menghapus token di browser. Token itu **masih sah** sampai kedaluwarsa, kalau ada yang sudah menyalinnya. Ini konsekuensi JWT stateless.

Pilihan bila ini dianggap masalah:

| Cara | Efek | Biaya |
|---|---|---|
| Masa berlaku lebih pendek (mis. 1 jam) | Jendela penyalahgunaan menyempit | Pengguna sering login ulang |
| Daftar cabut (tabel `revoked_tokens`) | Token bisa dimatikan seketika | Perlu tabel + satu kueri tiap permintaan |
| Session token di database | Paling mudah dicabut | Perlu tabel `sessions` |

Untuk versi ini: masa berlaku 7 hari diterima, dengan catatan bahwa logout bukan jaminan token tidak bisa dipakai lagi.

---

## 4. Autorisasi

### 4.1 Matriks akses

| Endpoint | Tanpa identitas | `x-api-key` salah | JWT salah / kedaluwarsa | Token sah |
|---|---|---|---|---|
| `GET /` | `200` | `200` | `200` | `200` |
| `POST /api/login` | `400` / `401` | `400` / `401` | `400` / `401` | `400` / `401` |
| `POST /api/soil` | `401` | `401` | `401` | **`401`** |
| `GET /api/soil` | `401` | **`401`** | `401` | `200` |

Perhatikan dua sel terakhir: kunci device **tidak** membuka jalur baca, dan token pengguna **tidak** membuka jalur tulis. Dua kunci tidak bisa saling menggantikan.

`POST /api/login` tidak membaca identitas apa pun. Balasannya hanya bergantung pada isi body, jadi kolom "kunci salah" di situ tidak bermakna selain tetap `400`/`401`.

### 4.2 Peran pengguna

Saat ini hanya **satu tingkat**: siapa pun yang berhasil login boleh membaca seluruh data. Belum ada peran admin, belum ada kepemilikan baris per pengguna.

Konsekuensi yang perlu disadari: kalau nanti ada beberapa petani, petani A bisa membaca data petani B. Menambah peran berarti menambah kolom pemilik pada tabel data dan aturan kepemilikan, bukan sekadar menambah nilai di kolom `role`.

### 4.3 Autorisasi di database (RLS)

```sql
alter table public.kesuburan_tanah enable row level security;
alter table public.users enable row level security;
```

RLS aktif **tanpa policy**. Artinya:

| Kunci | Bisa baca `users` | Bisa baca `kesuburan_tanah` |
|---|---|---|
| Publishable key (bisa dipublikasikan) | Tidak | Tidak |
| Secret key (hanya server) | Ya | Ya |

Cara kerjanya: tidak ada policy berarti tidak ada aturan yang mengizinkan, jadi permintaan dari kunci publik selalu kosong. Secret key punya peran khusus yang melewati RLS, dan kunci itu memang hanya ada di server.

Dua hal yang bisa membatalkan perlindungan ini:

1. **Menambahkan policy tanpa memahami urusannya.** Policy `for select using (true)` akan membuka seluruh tabel untuk kunci publik.
2. **RLS dimatikan.** Sekali dimatikan, kunci publik bisa membaca sekaligus menulis.

Pengerasan tambahan (opsional, lapis kedua):

```sql
revoke all on public.users from anon, authenticated;
revoke all on public.kesuburan_tanah from anon, authenticated;
```

Ini mencabut izin tabel dari kunci publik. Kalau suatu saat policy salah ditambahkan, izin yang sudah dicabut tetap menahan.

### 4.4 Kenapa dashboard tidak berbicara langsung ke Supabase

Publishable key memang dirancang publik, jadi menaruhnya di JavaScript bukan pelanggaran. Yang menjadi masalah: dengan pola itu, aturan akses berpindah seluruhnya ke RLS, validasi hilang, pemetaan nama kolom hilang, dan satu salah policy membuka seluruh tabel.

Karena itu dashboard memakai perantara:

```
Browser -> Express (JWT) -> Supabase (secret key) -> Express -> Browser
```

Browser tidak pernah menerima `SUPABASE_KEY`. Kalau nanti ada yang membuka DevTools, yang terlihat hanya tokennya sendiri.

---

## 5. Validasi

### 5.1 Tiga lapis

| Lapis | Menangkap | Contoh |
|---|---|---|
| Transport | Body tidak bisa dibaca | Bukan JSON, body terlalu besar |
| Bentuk | Struktur salah | Field kurang, tipe salah |
| Semantik | Nilai ngawur | pH 999, teks 1 MB, `timestamp` bukan tanggal |

Lapis 1 dan 2 murah dan wajib. Lapis 3 yang paling sering terlewat, padahal paling mungkin terjadi di lapangan (sensor tidak terkalibrasi).

### 5.2 Lapis 1: transport

```js
app.use(express.json({ limit: "8kb" }));
```

Payload sensor paling besar beberapa ratus byte. Batas 8 KB cukup longgar dan menutup kiriman besar yang tidak perlu. Tanpa batas eksplisit, nilai bawaan Express jauh lebih besar.

Body yang bukan JSON akan dilempar oleh `express.json()`. Tambahkan penangkap di akhir, supaya balasannya tetap JSON dan tidak membocorkan jejak kode:

```js
app.use((error, req, res, next) => {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Body bukan JSON yang sah" });
  }
  if (error.type === "entity.too.large") {
    return res.status(413).json({ success: false, message: "Body terlalu besar" });
  }
  console.error("Unhandled error:", error);
  res.status(500).json({ success: false, message: "Internal server error" });
});
```

### 5.3 Lapis 2: bentuk (`POST /api/soil`)

| No | Aturan | Gagal |
|---|---|---|
| V1 | `x-api-key` sama dengan `API_KEY` | `401 Unauthorized` |
| V2 | 10 field wajib ada: `timestamp`, `ph`, `temperature`, `moisture`, `nitrogen`, `phosphorus`, `potassium`, `ec`, `classification`, `recommendation` | `400 Invalid or incomplete data` |
| V3 | 7 field numerik bertipe `number` dan finite | `400 <field> must be a valid number` |

Yang perlu diperhatikan pada V2: pemeriksaan memakai `undefined`, bukan sifat "falsy". Nilai `0` itu sah (kelembapan 0%, EC 0 mS/cm), jadi jangan ditolak.

```js
if (ph === undefined || temperature === undefined /* ... */) {
  return res.status(400).json({ success: false, message: "Invalid or incomplete data" });
}
```

Pada V3, string angka ditolak:

```js
if (typeof value !== "number" || !Number.isFinite(value)) { /* 400 */ }
```

`"6.2"` ditolak, `NaN` ditolak, `Infinity` ditolak. Ini disengaja: JSON parser sudah menyediakan tipe angka, jadi ESP32 yang mengirim string menandakan ada bug di firmware, dan lebih baik ketahuan di sini daripada masuk database.

### 5.4 Lapis 3: semantik

**a. Rentang nilai sensor.** Tanpa ini, `pH: 999` atau `moisture: -50` lolos dan merusak grafik.

```js
const RANGE = {
  ph: [0, 14],
  temperature: [-10, 60],
  moisture: [0, 100],
  nitrogen: [0, 1000],
  phosphorus: [0, 1000],
  potassium: [0, 1000],
  ec: [0, 20]
};

for (const [field, [min, max]] of Object.entries(RANGE)) {
  const value = numericFields[field];
  if (value < min || value > max) {
    return res.status(400).json({
      success: false,
      message: `${field} must be between ${min} and ${max}`
    });
  }
}
```

Angka di atas adalah batas wajar untuk tanah, bukan nilai hasil kalibrasi. Sesuaikan setelah sensor dikalibrasi. Batas terlalu ketat berisiko menolak data sah, jadi lebih baik longgar dulu.

**b. Panjang teks.** `classification` dan `recommendation` dihasilkan model AI di ESP32. Model bisa berubah, dan tanpa batas, teks panjang bisa masuk dan merusak tampilan.

```js
if (classification.length > 32 || recommendation.length > 300) {
  return res.status(400).json({
    success: false,
    message: "classification atau recommendation terlalu panjang"
  });
}
```

**c. Format `timestamp`.** Tanpa validasi, `"abc"` tetap tersimpan dan dashboard menampilkan Invalid Date.

```js
if (Number.isNaN(Date.parse(timestamp))) {
  return res.status(400).json({ success: false, message: "timestamp bukan tanggal yang sah" });
}
```

Sekaligus batas kewajaran waktu, supaya jam perangkat yang salah tidak merusak urutan data:

```js
const umur = Date.now() - Date.parse(timestamp);
const BATAS_MASA_LALU = 7 * 24 * 60 * 60 * 1000;   // 7 hari
const TOLERANSI_MASA_DEPAN = 10 * 60 * 1000;       // 10 menit

if (umur > BATAS_MASA_LALU || umur < -TOLERANSI_MASA_DEPAN) {
  return res.status(400).json({ success: false, message: "timestamp di luar rentang wajar" });
}
```

Toleransi ke depan 10 menit memberi ruang untuk selisih jam kecil antar perangkat.

### 5.5 Validasi login

| No | Aturan | Gagal |
|---|---|---|
| L1 | `username` dan `password` ada, bertipe teks, tidak kosong | `400` |
| L2 | Panjang `username` ≤ 32, `password` ≤ 128 | `400` |
| L3 | Kredensial tidak cocok | `401`, pesan umum |

Batas panjang pada L2 mencegah hash bcrypt dijalankan atas masukan raksasa. Tanpa itu, penyerang bisa mengirim password 1 MB dan membuat server sibuk menghitung hash yang pasti gagal.

Catatan: batas panjang password di sini hanya untuk keamanan pemrosesan. Panjang **minimum** password diatur saat pembuatan akun di `scripts/create-user.js`, bukan di endpoint login.

### 5.6 Validasi parameter `GET /api/soil`

```js
const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 200);
```

| Masukan | Hasil | Kenapa |
|---|---|---|
| tidak dikirim | `200` | Nilai bawaan |
| `40` | `40` | Normal |
| `0` | `200` | `0` falsy, jadi jatuh ke bawaan |
| `-5` | `1` | Tanpa `Math.max`, nilai negatif diteruskan ke PostgREST dan ditafsirkan sebagai hitung dari belakang |
| `99999` | `200` | Dipotong ke batas maksimum, bukan ditolak |
| `abc` | `200` | `NaN` falsy, jatuh ke bawaan |

Tanpa `Math.max`, `?limit=-5` tidak error, tapi memberi hasil yang membingungkan. Lebih baik dijepit.

### 5.7 Field asing

Field di luar daftar diabaikan. `toDb()` hanya mengambil field yang dikenal, jadi `{"hum": 50}` tidak berpengaruh dan `moisture` tetap dianggap tidak ada → `400`. Ini disengaja: lebih baik gagal jelas daripada diam-diam menyimpan nilai default.

### 5.8 Pesan error dan kebocoran informasi

| Situasi | Balasan | Alasan |
|---|---|---|
| Kunci salah | `401 Unauthorized` | Tanpa keterangan tambahan |
| Field kurang | `400 Invalid or incomplete data` | Tidak menyebut field mana yang kurang satu per satu |
| Tipe salah | `400 <field> must be a valid number` | Menyebut nama field device, bukan nama kolom database |
| Gagal database | `500 Failed to save data` | Pesan asli Supabase **hanya ke log server** |
| Error tak terduga | `500 Internal server error` | Tanpa detail |

Satu hal yang perlu diperbaiki dari percobaan pertama: respons `500` sempat menyertakan `error.message` dari Supabase ke klien. Pesan itu bisa memuat nama tabel, nama kolom, atau bentuk kueri. Sebaiknya disimpan di log server saja, klien cukup menerima pesan umum.

---

## 6. Rahasia dan konfigurasi

### 6.1 Penyimpanan

| Rahasia | Lokasi | Jangan |
|---|---|---|
| `SUPABASE_KEY` | `.env` lokal + Environment Variables Vercel | Commit, screenshot, tempel di chat |
| `JWT_SECRET` | sama | Sama |
| `API_KEY` | sama | Sama (ini satu-satunya yang ada di firmware) |

`.gitignore` wajib memuat `.env`, `node_modules/`, `certs/` **sejak commit pertama**. Menghapus file dari commit terakhir tidak cukup; nilainya tetap ada di riwayat git.

### 6.2 Kekuatan

| Rahasia | Panjang minimal | Cara membuat |
|---|---|---|
| `JWT_SECRET` | 32 byte acak | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `API_KEY` | 16 byte acak | sama |
| Password pengguna | 8 karakter | diketik operator |

`JWT_SECRET` harus sama di lokal dan Vercel. Kalau berbeda, token selalu ditolak dan penyebabnya sulit terlihat.

### 6.3 Rotasi

| Rahasia | Kapan dirotasi | Akibat rotasi |
|---|---|---|
| `SUPABASE_KEY` | Segera, karena pernah terlihat di screenshot | Tidak ada, cukup ganti env |
| `JWT_SECRET` | Kalau dicurigai bocor, atau berkala | Semua pengguna harus login ulang |
| `API_KEY` | Kalau firmware hilang atau bocor | Firmware harus diunggah ulang |

Rotasi `SUPABASE_KEY` adalah satu-satunya yang tertunda dan perlu diselesaikan sebelum demo.

---

## 7. Transport dan deployment

| Aspek | Ketentuan |
|---|---|
| HTTPS | Wajib di Vercel (otomatis). Lokal memakai sertifikat di `certs/` |
| Penyimpanan token | `localStorage` (lihat batasan di 8.1) |
| Header `Authorization` | Dikirim manual oleh `fetch`, bukan cookie otomatis |
| CSRF | Tidak berlaku, karena token dikirim lewat header, bukan cookie. Permintaan dari situs lain tidak otomatis membawa token |
| CORS | Express tidak menambahkan header CORS, jadi browser memblokir pembacaan lintas asal secara bawaan. Ini perilaku yang diinginkan |
| Halaman statis | Disajikan Vercel dari `public/**`, bukan Express |

Catatan CSRF: pola Bearer di header memang bebas CSRF, dan itu salah satu keuntungan tidak memakai cookie. Kalau nanti pindah ke cookie `httpOnly`, perlindungan CSRF jadi wajib ditambahkan (misalnya `SameSite=Lax` plus token CSRF).

---

## 8. Ancaman dan penanganan

| Kategori | Ancaman | Penanganan | Status |
|---|---|---|---|
| Pemalsuan identitas | Menebak password | bcrypt cost 10 + rate limit 10/15 menit | Rancangan |
| Pemalsuan identitas | Membuat token sendiri | Tanda tangan `JWT_SECRET` | Rancangan |
| Pemalsuan identitas | Mengirim data sensor palsu | `x-api-key` | Rancangan |
| Pemalsuan identitas | Memakai lagi token yang sudah dicuri | Masa berlaku 7 hari | Terbatas |
| Pengubahan data | Mengubah isi token | `jwt.verify` menolak bila tanda tangan tidak cocok | Rancangan |
| Pengubahan data | Mengubah baris database langsung | Secret key hanya di server, RLS tanpa policy | Rancangan |
| Penyangkalan | Tidak ada catatan siapa login kapan | Belum ada | **Celah** |
| Pembocoran informasi | Membaca tabel lewat kunci publik | RLS aktif tanpa policy | Rancangan |
| Pembocoran informasi | Membaca hash password | Hash hanya diambil saat login, tidak pernah dikirim | Rancangan |
| Pembocoran informasi | Pesan error membocorkan struktur | Pesan umum, detail hanya di log | Perlu perbaikan |
| Pembocoran informasi | Menyadap lalu lintas | HTTPS | Rancangan |
| Pembocoran informasi | Mencuri token dari browser | Belum ada. `localStorage` rentan XSS | **Celah** |
| Penghentian layanan | Menghabiskan CPU dengan hash | Batas panjang password di login | Rancangan |
| Penghentian layanan | Membanjiri `POST /api/soil` | Belum ada rate limit | **Celah** |
| Penghentian layanan | Mengirim body raksasa | `express.json({ limit: "8kb" })` | Rancangan |
| Peningkatan hak | Naik dari pengguna ke server | Tidak ada jalur; browser tidak punya kunci server | Rancangan |
| Peningkatan hak | Menembus RLS | Kunci publik dicabut izinnya (opsional) | Opsional |

Celah yang perlu disebut jujur di laporan: tidak ada log login, token `localStorage`, dan `POST /api/soil` tanpa rate limit.

---

## 9. Batasan dan kompromi

| Batasan | Konsekuensi | Upgrade |
|---|---|---|
| Token di `localStorage` | Rentan XSS. Kalau ada skrip asing berjalan di halaman, token bisa diambil | Pindah ke cookie `httpOnly` + `SameSite` + token CSRF |
| Logout tidak mencabut token | Token yang sudah disalin tetap berlaku sampai 7 hari | Masa berlaku lebih pendek, atau daftar cabut |
| Satu peran | Semua pengguna melihat semua data | Kolom pemilik + aturan kepemilikan |
| Satu `API_KEY` bersama | Satu perangkat bocor berarti semua perangkat bocor | Kunci per perangkat + tabel `devices` |
| Tidak ada log | Kejadian tidak bisa ditelusuri | Tabel `login_attempts` |
| `POST /api/soil` tanpa rate limit | Banjir data palsu bila kunci bocor | Rate limit per kunci atau per IP |
| Rentang sensor perkiraan | Bisa menolak data sah atau meloloskan yang aneh | Kalibrasi, lalu sesuaikan `RANGE` |

Semua ini layak disebut di bab "keterbatasan" laporan. Menyebutkannya menunjukkan pemahaman, bukan kelemahan.

---

## 10. Checklist uji keamanan

Autentikasi pengguna:

- [ ] Login password salah → `401`, pesan sama seperti username tidak ada
- [ ] Login username tidak ada → `401`, pesan identik
- [ ] Login benar → `200` + token
- [ ] 11 percobaan cepat → `429`
- [ ] Token dirusak satu karakter → `401`
- [ ] Token dibuat dengan `JWT_SECRET` lain → `401`
- [ ] Token kedaluwarsa → `401`
- [ ] Isi tabel `users`: `password_hash` berupa teks acak, panjang 60

Autentikasi perangkat:

- [ ] `POST /api/soil` tanpa `x-api-key` → `401`
- [ ] `x-api-key` salah → `401`
- [ ] `x-api-key` benar → `201`

Autorisasi:

- [ ] `x-api-key` benar dipakai di `GET /api/soil` → tetap `401`
- [ ] Token pengguna dipakai di `POST /api/soil` → tetap `401`
- [ ] Tanpa token, `GET /api/soil` → `401`
- [ ] Kunci publishable Supabase diuji langsung ke PostgREST → hasil kosong, bukan error yang membuka data
- [ ] RLS aktif pada kedua tabel (cek di Supabase)
- [ ] Respons `500` tidak memuat pesan internal Supabase

Validasi:

- [ ] Body kurang satu field → `400`
- [ ] `"6.2"` sebagai string → `400`
- [ ] `ph: 999` → `400` (setelah rentang dipasang)
- [ ] `ph: 0`, `moisture: 0` → `201` (nol harus diterima)
- [ ] `timestamp: "abc"` → `400`
- [ ] `classification` 1000 karakter → `400`
- [ ] Body bukan JSON → `400` dengan bentuk JSON, bukan halaman error
- [ ] Body 1 MB → `413`
- [ ] `?limit=-5` → hasil paling banyak 1 baris, tidak error

Rahasia:

- [ ] `.env` tidak terlihat di `git log --all --name-only`
- [ ] `.env` tidak ada di GitHub
- [ ] `SUPABASE_KEY` sudah dirotasi
- [ ] `JWT_SECRET` lokal = `JWT_SECRET` Vercel
- [ ] Tidak ada kunci yang muncul di file mana pun di `public/**`

---

## 11. Referensi

| Bagian | Berkas | Isi |
|---|---|---|
| Skema tabel + RLS | `RANGKUMAN.md` bagian 4 | SQL siap jalan |
| Env vars | `RANGKUMAN.md` bagian 5 | Daftar rahasia |
| Kontrak endpoint | `RANGKUMAN.md` bagian 6 | Aturan balasan |
| Kerangka middleware | `RANGKUMAN.md` bagian 7 | `authenticateApiKey`, `authenticateUser`, `loginLimiter` |
| Pembuatan akun | `RANGKUMAN.md` bagian 8 | `scripts/create-user.js` |
| Kesalahan keamanan lama | `RANGKUMAN.md` bagian 13 | Kunci bocor, pesan error bocor |
| Rencana pengembangan | `RANGKUMAN.md` bagian 14 | Item keamanan yang ditunda |

---

## 12. Glosarium

| Istilah | Arti |
|---|---|
| Autentikasi | Membuktikan siapa yang mengirim permintaan |
| Autorisasi | Menentukan apa yang boleh dilakukan pihak yang sudah terautentikasi |
| Validasi | Memastikan data masuk sesuai bentuk dan nilai yang diterima |
| bcrypt | Algoritma hash password satu arah, lambat dengan sengaja |
| Cost factor | Angka yang menentukan berat komputasi bcrypt |
| JWT | Token bertanda tangan berisi identitas, ditandatangani tetapi tidak dienkripsi |
| Tanda tangan | Kode yang membuktikan token dibuat server, tidak bisa dipalsukan tanpa `JWT_SECRET` |
| RLS | Row Level Security, aturan akses per baris di PostgreSQL |
| Policy | Aturan RLS yang menentukan siapa boleh apa |
| Stateless | Server tidak menyimpan daftar sesi; verifikasi cukup dari token |
| XSS | Penyisipan skrip asing ke halaman, bisa mencuri token dari `localStorage` |
| CSRF | Pemaksaan permintaan dari situs lain; tidak berlaku bila token dikirim lewat header |
| Timing attack | Menyimpulkan rahasia dari perbedaan waktu proses |
| Rate limit | Pembatasan jumlah percobaan per jangka waktu |
