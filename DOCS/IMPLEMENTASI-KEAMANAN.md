# Dokumentasi Implementasi Keamanan
## API Key, Validasi Request, dan HTTPS/TLS

| Item | Keterangan |
|---|---|
| Proyek | Soil Cloud API / Monitoring Kesuburan Tanah |
| Penanggung jawab bagian ini | Ahmad Syamil Syauqie — keamanan sistem |
| File utama | `server.js`, `scripts/generate-certs.js`, `package.json`, `.env.example` |
| Dokumen acuan | `DOCS/KEAMANAN.md` bagian 3.5, 5.2–5.4, 5.8, 7; `DOCS/PRD.md` VR-01…VR-08 |
| Status | API key, validasi request, dan HTTPS/TLS sudah diimplementasikan |

Dokumen ini dipakai untuk menyusun bab implementasi dan pengujian. Isinya: bagian kode yang perlu di-screenshot, daftar bukti uji beserta perintahnya, tabel hasil, contoh teks laporan, dan hal-hal yang tidak boleh dipublikasikan.

---

## 1. Ringkasan yang sudah dikerjakan

| No | Komponen | Implementasi | Lokasi |
|---|---|---|---|
| 1 | Autentikasi perangkat | Header `x-api-key`, dibandingkan dengan `crypto.timingSafeEqual`, fail closed | `server.js:64-84` |
| 2 | Pemasangan auth | Hanya di `POST /api/soil` | `server.js:90` |
| 3 | Batas ukuran body | `express.json({ limit: "8kb" })` | `server.js:10-12` |
| 4 | Validasi bentuk | 10 field wajib; 7 field numerik harus `number` dan finite | `server.js:46-47, 93-104` |
| 5 | Validasi semantik | Range sensor, panjang teks, format dan kewajaran `timestamp` | `server.js:49-62, 106-137` |
| 6 | Error handler | Body bukan JSON → `400`; body terlalu besar → `413`; error lain → `500` generik | `server.js:172-187` |
| 7 | Pencegahan kebocoran | `error.message` Supabase tidak lagi dikirim ke client | `server.js:144-148, 164-167` |
| 8 | HTTPS lokal | `https.createServer` dengan `certs/key.pem` + `certs/cert.pem`, minimal TLS 1.2 | `server.js:189-212` |
| 9 | Generator sertifikat | `npm run certs` membuat sertifikat self-signed `localhost` | `scripts/generate-certs.js` |
| 10 | Konfigurasi | Script `certs`, devDependency `selfsigned`, contoh `.env` | `package.json:6-19`, `.env.example` |

Di luar dokumen ini: JWT dashboard, rate limit login, rate limit `POST /api/soil`, penyimpanan offline, dan pengujian DoS belum diimplementasikan. Jangan menuliskan bagian itu sebagai selesai.

---

## 2. Bagian kode yang perlu di-screenshot

Saat screenshot kode di VS Code, pastikan **nama file dan nomor baris terlihat**. Jangan screenshot file `.env` yang berisi nilai asli.

| No | Yang di-screenshot | Lokasi | Alasan ditampilkan |
|---|---|---|---|
| 1 | Batas ukuran body 8 KB | `server.js:10-12` | Menunjukkan perlindungan transport |
| 2 | Konstanta range, batas teks, batas waktu | `server.js:49-62` | Menunjukkan aturan validasi yang dipakai |
| 3 | `safeEqual` | `server.js:64-69` | Menunjukkan perbandingan waktu tetap |
| 4 | `authenticateApiKey` | `server.js:71-84` | Inti autentikasi perangkat + fail closed |
| 5 | `app.post("/api/soil", authenticateApiKey, ...)` | `server.js:90` | Menunjukkan middleware benar-benar dipasang |
| 6 | Validasi V2: field wajib | `server.js:93-97` | Menunjukkan nilai `0` tetap diterima |
| 7 | Validasi V3: numerik finite | `server.js:99-104` | Menunjukkan string angka ditolak |
| 8 | Validasi V4a: range sensor | `server.js:106-114` | Menunjukkan `pH 999` ditolak |
| 9 | Validasi V4b: teks dan panjang | `server.js:116-127` | Menunjukkan batas `classification`/`recommendation` |
| 10 | Validasi V4c: timestamp | `server.js:129-137` | Menunjukkan format dan batas waktu |
| 11 | Insert + error tanpa `error.message` | `server.js:139-150` | Menunjukkan detail database tidak bocor |
| 12 | Error handler 400/413/500 | `server.js:172-187` | Menunjukkan respons error konsisten |
| 13 | Blok HTTPS + `minVersion` | `server.js:189-212` | Inti penerapan TLS |
| 14 | Isi `scripts/generate-certs.js` | seluruh file | Menunjukkan cara sertifikat dibuat |
| 15 | Script `certs` dan `selfsigned` | `package.json:6-19` | Menunjukkan cara menjalankan generator |
| 16 | `.gitignore` | baris `certs/` dan `.env` | Menunjukkan kunci tidak masuk Git |
| 17 | `.env.example` | seluruh file, nilai disamarkan | Menunjukkan variabel yang dibutuhkan |

Tips screenshot kode:

- Gunakan zoom 125–150% agar teks terbaca.
- Potong hanya bagian yang relevan, jangan seluruh layar.
- Jika satu bagian lebih dari satu layar, ambil dua screenshot dan beri nomor urut.
- Jangan menampilkan terminal yang berisi nilai `SUPABASE_KEY` atau `API_KEY`.

---

## 3. Screenshot bukti pengujian

Urutan berikut sekaligus menjadi alur demo. Jalankan dari folder proyek:

```powershell
npm start
```

Kalau sertifikat belum ada:

```powershell
npm run certs
npm start
```

Output yang benar:

```text
HTTPS server running on https://localhost:3000
```

### 3.1 Persiapan

| No | Yang di-screenshot | Perintah | Hasil yang diharapkan |
|---|---|---|---|
| 1 | Pembuatan sertifikat | `npm run certs` | `certs/key.pem` dan `certs/cert.pem` dibuat |
| 2 | Server HTTPS aktif | `npm start` | `HTTPS server running on https://localhost:3000` |
| 3 | Health check | `curl.exe -k -i https://localhost:3000/` | `200`, `{"status":"ok",...}` |

### 3.2 Autentikasi API key

| No | Skenario | Perintah | Hasil |
|---|---|---|---|
| 4 | Tanpa `x-api-key` | lihat perintah di bawah | `401 Unauthorized` |
| 5 | `x-api-key` salah | ganti header menjadi `salah` | `401 Unauthorized` |
| 6 | `x-api-key` benar | pakai nilai `API_KEY` di `.env` | `201 Data saved successfully` (butuh Supabase asli) |
| 7 | `API_KEY` kosong (fail closed) | hapus sementara `API_KEY` dari `.env`, restart | `401`, log `API_KEY belum diset` |

Perintah nomor 4:

```powershell
curl.exe -k -i -X POST "https://localhost:3000/api/soil" `
  -H "Content-Type: application/json" `
  -d "{}"
```

Perintah nomor 5:

```powershell
curl.exe -k -i -X POST "https://localhost:3000/api/soil" `
  -H "Content-Type: application/json" `
  -H "x-api-key: salah" `
  -d "{}"
```

Perintah nomor 6:

```powershell
$body = @{
  timestamp      = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  ph             = 6.2
  temperature    = 29.4
  moisture       = 48.5
  nitrogen       = 35
  phosphorus     = 18
  potassium      = 24
  ec             = 0.82
  classification = "Sedang"
  recommendation = "Pemupukan sesuai kebutuhan tanah."
} | ConvertTo-Json

curl.exe -k -i -X POST "https://localhost:3000/api/soil" `
  -H "Content-Type: application/json" `
  -H "x-api-key: test-key-123" `
  -d $body
```

Ganti `test-key-123` dengan nilai `API_KEY` di `.env`. Kalau memakai Postman, matikan **SSL certificate verification** dulu karena sertifikat lokal self-signed.

### 3.3 Validasi request

Semua contoh di bawah memakai `x-api-key` yang benar. Timestamp sengaja statis karena validasi yang diuji gagal sebelum tahap timestamp.

| No | Skenario | Body/Perlakuan | Hasil |
|---|---|---|---|
| 8 | Field kurang | hapus `moisture` | `400 Invalid or incomplete data` |
| 9 | pH string | `"ph": "6.2"` | `400 ph must be a valid number` |
| 10 | pH di luar range | `"ph": 999` | `400 ph must be between 0 and 14` |
| 11 | Moisture negatif | `"moisture": -1` | `400 moisture must be between 0 and 100` |
| 12 | EC di luar range | `"ec": 99` | `400 ec must be between 0 and 20` |
| 13 | Classification bukan teks | `"classification": 123` | `400 classification must be a valid text` |
| 14 | Recommendation terlalu panjang | 301 karakter `x` | `400 recommendation must be at most 300 characters` |
| 15 | Timestamp bukan tanggal | `"timestamp": "abc"` | `400 timestamp bukan tanggal yang sah` |
| 16 | Timestamp terlalu tua | 8 hari ke belakang | `400 timestamp di luar rentang wajar` |
| 17 | Timestamp terlalu jauh ke depan | 1 jam ke depan | `400 timestamp di luar rentang wajar` |
| 18 | Body bukan JSON | `-d "{"` | `400 Body bukan JSON yang sah` |
| 19 | Body lebih dari 8 KB | 9.000 karakter | `413 Body terlalu besar` |
| 20 | Nilai `0` | `"ph": 0, "moisture": 0` | lolos validasi; `201` kalau database aktif, atau `500` kalau database dummy |

Contoh nomor 8:

```powershell
curl.exe -k -i -X POST "https://localhost:3000/api/soil" `
  -H "Content-Type: application/json" `
  -H "x-api-key: test-key-123" `
  -d '{"timestamp":"2026-10-23T08:00:00Z","ph":6.2,"temperature":29.4,"nitrogen":35,"phosphorus":18,"potassium":24,"ec":0.82,"classification":"Sedang","recommendation":"Pemupukan sesuai kebutuhan tanah."}'
```

Contoh nomor 10:

```powershell
curl.exe -k -i -X POST "https://localhost:3000/api/soil" `
  -H "Content-Type: application/json" `
  -H "x-api-key: test-key-123" `
  -d '{"timestamp":"2026-10-23T08:00:00Z","ph":999,"temperature":29.4,"moisture":48.5,"nitrogen":35,"phosphorus":18,"potassium":24,"ec":0.82,"classification":"Sedang","recommendation":"Pemupukan sesuai kebutuhan tanah."}'
```

Contoh nomor 18:

```powershell
curl.exe -k -i -X POST "https://localhost:3000/api/soil" `
  -H "Content-Type: application/json" `
  -H "x-api-key: test-key-123" `
  -d "{"
```

Contoh nomor 19:

```powershell
$big = '{"timestamp":"2026-10-23T08:00:00Z","recommendation":"' + ('x' * 9000) + '"}'
curl.exe -k -i -X POST "https://localhost:3000/api/soil" `
  -H "Content-Type: application/json" `
  -H "x-api-key: test-key-123" `
  -d $big
```

### 3.4 HTTPS/TLS

| No | Yang di-screenshot | Perintah | Hasil |
|---|---|---|---|
| 21 | TLS yang dipakai | `curl.exe -k -v https://localhost:3000/ 2>&1 \| Select-String "SSL connection\|TLSv"` | `SSL connection using TLSv1.3` atau `TLSv1.2` |
| 22 | TLS 1.1 ditolak | `curl.exe -k --tlsv1.1 --tls-max 1.1 https://localhost:3000/` | handshake gagal / protokol tidak didukung |
| 23 | HTTP polos ditolak | `curl.exe -i http://localhost:3000/` | gagal koneksi, karena port hanya melayani HTTPS |
| 24 | Sertifikat lokal | `Get-ChildItem certs` | `key.pem` dan `cert.pem` ada |

Screenshot nomor 21–23 sebaiknya diambil dari terminal. Untuk laporan, screenshot browser dengan ikon gembok HTTPS di URL Vercel lebih kuat daripada `localhost` yang memunculkan peringatan self-signed.

### 3.5 Deployment Vercel

| No | Yang di-screenshot | Lokasi | Catatan |
|---|---|---|---|
| 25 | Environment Variables | Vercel → Project → Settings → Environment Variables | `SUPABASE_URL`, `SUPABASE_KEY`, `API_KEY`; samarkan nilainya |
| 26 | Deployment sukses | Vercel → Deployments | Status `Ready` |
| 27 | URL HTTPS aktif | Browser ke domain Vercel | Ikon gembok, bukan `localhost` |
| 28 | `401` di domain live | Postman/curl ke `https://<domain>/api/soil` tanpa key | `401 Unauthorized` |
| 29 | `201` di domain live | Postman/curl dengan key benar | `201` dan baris masuk ke Supabase |

Untuk nomor 29, buka juga **Supabase → Table Editor → `kesuburan_tanah`** dan screenshot baris yang baru masuk. Ini bukti paling kuat bahwa alur end-to-end berjalan.

### 3.6 Supabase

| No | Yang di-screenshot | Lokasi | Catatan |
|---|---|---|---|
| 30 | Secret key | Project Settings → API Keys | **Samarkan nilainya**, cukup tunjukkan nama key |
| 31 | RLS aktif | Table Editor → `kesuburan_tanah` dan `users` | Cari badge RLS enabled, atau Authentication → Policies |
| 32 | Isi tabel | Table Editor → `kesuburan_tanah` | Timestamp dan nilai sensor dari pengujian |
| 33 | Hash password | Table Editor → `users` | Tunjukkan `password_hash` acak, bukan password asli |

Kalau project masih memakai key lama, screenshot **Legacy API keys** dan tunjukkan bahwa yang dipakai adalah `service_role`, bukan `anon`.

---

## 4. Tabel hasil pengujian

Tabel ini bisa langsung dimasukkan ke bab pengujian. Status “Lulus” di bawah adalah hasil pengujian lokal yang sudah dijalankan.

| No | Pengujian | Ekspektasi | Hasil |
|---|---|---|---|
| 1 | `POST /api/soil` tanpa `x-api-key` | `401` | Lulus |
| 2 | `POST /api/soil` dengan key salah | `401` | Lulus |
| 3 | `API_KEY` tidak diset | `401` + log | Lulus |
| 4 | Field wajib kurang | `400` | Lulus |
| 5 | `ph` dikirim string `"6.2"` | `400` | Lulus |
| 6 | `ph: 999` | `400` | Lulus |
| 7 | `moisture: -1` | `400` | Lulus |
| 8 | `ec: 99` | `400` | Lulus |
| 9 | `classification` bukan teks | `400` | Lulus |
| 10 | `recommendation` 301 karakter | `400` | Lulus |
| 11 | `timestamp: "abc"` | `400` | Lulus |
| 12 | Timestamp 8 hari lalu | `400` | Lulus |
| 13 | Timestamp 1 jam ke depan | `400` | Lulus |
| 14 | Body bukan JSON | `400` JSON | Lulus |
| 15 | Body 9 KB | `413` | Lulus |
| 16 | Nilai `0` | lolos validasi | Lulus |
| 17 | `POST` valid dengan key benar | `201` + data terpetakan | Lulus dengan mock PostgREST |
| 18 | `GET /` | `200` | Lulus |
| 19 | HTTP polos ke port HTTPS | ditolak | Lulus |
| 20 | TLS 1.2 | diterima | Lulus |
| 21 | TLS 1.1 | ditolak | Lulus |
| 22 | Produksi tanpa listener lokal | app tetap ter-export | Lulus |

Catatan penting untuk laporan:

- Nomor 17 diuji dengan **mock PostgREST lokal**, bukan Supabase asli, karena saat pengujian tidak ada kredensial. Jika sudah punya `.env`, ulangi nomor 17 ke Supabase asli dan ganti keterangannya menjadi “Lulus dengan Supabase”.
- Nomor 21 bergantung pada versi curl/OpenSSL. Kalau curl menolak opsi `--tls-max`, gunakan Postman atau browser DevTools untuk melihat protokol TLS.
- Jangan menulis “semua pengujian keamanan lulus” kalau JWT, rate limit, dan DoS belum diuji. Tulis cakupannya: “pengujian API key, validasi request, dan TLS”.

---

## 5. Contoh teks laporan (siap diedit)

### 5.1 Implementasi Autentikasi API Key

> Endpoint `POST /api/soil` digunakan oleh perangkat ESP32 untuk mengirim data pengukuran. Karena endpoint ini tidak boleh diakses oleh pihak lain, permintaan wajib menyertakan header `x-api-key` yang nilainya sama dengan variabel lingkungan `API_KEY`. Pemeriksaan dilakukan oleh middleware `authenticateApiKey` sebelum data diproses. Perbandingan kunci menggunakan `crypto.timingSafeEqual` agar waktu respons tidak membocorkan panjang atau isi kunci. Middleware juga menerapkan prinsip *fail closed*: apabila `API_KEY` belum dikonfigurasi, seluruh permintaan perangkat ditolak dengan status `401 Unauthorized`. Kunci yang salah atau tidak ada juga menerima respons yang sama, sehingga penyerang tidak dapat membedakan kedua kondisi tersebut. Implementasi ditunjukkan pada Gambar [nomor].

### 5.2 Implementasi Validasi Request

> Validasi dilakukan berlapis sebelum data disimpan ke Supabase. Lapis pertama membatasi ukuran body menjadi 8 KB melalui `express.json({ limit: "8kb" })` untuk mencegah pengiriman payload besar. Lapis kedua memeriksa kelengkapan sepuluh field wajib dan memastikan tujuh field numerik bertipe `number` serta bernilai finite; nilai `0` tetap diterima, sedangkan string angka seperti `"6.2"` ditolak. Lapis ketiga memeriksa kewajaran nilai, yaitu rentang pH 0–14, suhu −10–60 °C, kelembapan 0–100%, N/P/K 0–1000 mg/kg, dan EC 0–20 mS/cm, serta panjang `classification` maksimal 32 karakter dan `recommendation` maksimal 300 karakter. `timestamp` harus dapat di-parse, tidak lebih tua dari tujuh hari, dan tidak lebih dari sepuluh menit di masa depan. Body yang bukan JSON dibalas `400`, body yang melebihi 8 KB dibalas `413`, dan kegagalan database dibalas `500` tanpa menyertakan pesan internal Supabase. Implementasi ditunjukkan pada Gambar [nomor].

### 5.3 Implementasi HTTPS/TLS

> Pada lingkungan lokal, server dijalankan menggunakan modul `https` bawaan Node.js dengan sertifikat yang disimpan di folder `certs/`. Sertifikat self-signed untuk `localhost`, `127.0.0.1`, dan `::1` dibuat melalui perintah `npm run certs` yang menjalankan `scripts/generate-certs.js`. Server dikonfigurasi dengan `minVersion: "TLSv1.2"` sehingga protokol TLS versi lama ditolak. Apabila sertifikat tidak ditemukan, server tidak lagi beralih ke HTTP secara diam-diam, melainkan menampilkan peringatan dan petunjuk pembuatan sertifikat. Folder `certs/` dan file `.env` sudah tercantum pada `.gitignore` agar kunci privat tidak masuk repositori. Pada deployment Vercel, TLS diterminasi oleh platform sehingga tidak diperlukan sertifikat lokal; aplikasi tetap diekspor melalui `api/index.js` dan hanya menyala sebagai server HTTPS saat dijalankan secara lokal. Implementasi ditunjukkan pada Gambar [nomor].

### 5.4 Hasil Pengujian

> Pengujian dilakukan terhadap 22 skenario yang mencakup autentikasi API key, validasi bentuk dan semantik, penanganan body tidak valid, serta negosiasi TLS. Hasil pengujian menunjukkan seluruh skenario sesuai dengan target: permintaan tanpa kunci atau dengan kunci salah ditolak `401`, data yang tidak lengkap atau tidak wajar ditolak `400`, body yang terlalu besar ditolak `413`, dan koneksi TLS 1.2 diterima sedangkan TLS 1.1 ditolak. Pengujian penyimpanan ke Supabase dengan respons `201` telah diverifikasi menggunakan mock PostgREST lokal; pengujian ke database Supabase asli perlu diulang setelah kredensial tersedia. Rincian hasil disajikan pada Tabel [nomor].

### 5.5 Keterbatasan

> Bagian yang belum termasuk dalam implementasi ini adalah autentikasi JWT untuk dashboard, rate limiting pada `POST /api/soil`, penyimpanan offline, dan pengujian DoS menggunakan Apache JMeter. Oleh karena itu, `GET /api/soil` masih dapat diakses tanpa token dan belum memenuhi matriks akses pada `DOCS/KEAMANAN.md` bagian 4.1. Rentang nilai sensor yang digunakan masih berupa perkiraan wajar, bukan hasil kalibrasi, sehingga perlu disesuaikan setelah sensor dikalibrasi. Keterbatasan ini dicatat sebagai rencana pengembangan berikutnya, bukan sebagai klaim bahwa seluruh aspek keamanan telah selesai.

---

## 6. Bagian yang tidak boleh di-screenshot

Jangan pernah menampilkan nilai asli dari:

- `SUPABASE_KEY` (secret key / `service_role`)
- `API_KEY`
- `JWT_SECRET`
- isi file `.env`
- token JWT pengguna

Cara aman untuk laporan:

1. Buat salinan `.env` khusus dokumentasi, lalu ganti nilainya:

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=••••••••••••••••
API_KEY=••••••••••••••••
PORT=3000
```

2. Untuk dashboard Supabase, tutup/reveal key secukupnya, lalu blur atau tempel kotak hitam.
3. Untuk Postman, gunakan variabel environment dan sembunyikan kolom nilai saat screenshot.
4. Kalau key asli sempat terlihat di screenshot yang sudah tersebar, rotasi key tersebut sebelum demo.

---

## 7. Checklist dokumentasi

Kode:

- [ ] Screenshot body limit 8 KB
- [ ] Screenshot konstanta range dan batas teks
- [ ] Screenshot `safeEqual` dan `authenticateApiKey`
- [ ] Screenshot pemasangan middleware di `POST /api/soil`
- [ ] Screenshot validasi V2, V3, V4a, V4b, V4c
- [ ] Screenshot error handler 400/413/500
- [ ] Screenshot blok HTTPS + `minVersion`
- [ ] Screenshot `scripts/generate-certs.js`
- [ ] Screenshot `package.json` bagian script dan dependency
- [ ] Screenshot `.gitignore` dan `.env.example` (nilai disamarkan)

Pengujian:

- [ ] Output `npm run certs`
- [ ] Output `npm start` (HTTPS aktif)
- [ ] `401` tanpa key
- [ ] `401` key salah
- [ ] `201` data valid ke Supabase asli
- [ ] `400` field kurang
- [ ] `400` pH string
- [ ] `400` pH 999
- [ ] `400` timestamp tidak sah
- [ ] `400` rekomendasi terlalu panjang
- [ ] `413` body besar
- [ ] `400` body bukan JSON
- [ ] TLS 1.3/1.2 aktif
- [ ] TLS 1.1 ditolak

Deployment:

- [ ] Environment Variables Vercel
- [ ] Deployment `Ready`
- [ ] URL Vercel dengan gembok HTTPS
- [ ] `401` di domain live tanpa key
- [ ] `201` di domain live dengan key benar
- [ ] Baris baru terlihat di Supabase Table Editor

---

## 8. Troubleshooting saat mengambil bukti

| Gejala | Penyebab | Perbaikan |
|---|---|---|
| `supabaseUrl is required` | `.env` kosong atau belum ada | Isi `SUPABASE_URL` dan `SUPABASE_KEY` |
| `401` padahal key benar | Nilai `API_KEY` di `.env` berbeda dengan header, atau server belum restart | Samakan nilainya, restart server |
| `401` di Vercel padahal lokal jalan | `API_KEY` belum ditambahkan di Vercel, atau deployment lama | Tambahkan env, redeploy |
| Browser memperingatkan sertifikat | Sertifikat lokal self-signed | Klik advanced/lanjutkan untuk lokal; untuk laporan pakai URL Vercel |
| `413` padahal body kecil | Body melebihi 8 KB, misalnya rekomendasi panjang | Perkecil body |
| `400 timestamp di luar rentang wajar` | Jam ESP32 salah, atau data antrean lebih dari 7 hari | Perbaiki jam perangkat / kirim timestamp terbaru |
| `500 Failed to save data` | Kredensial Supabase salah, tabel/kolom tidak cocok, atau RLS | Cek log server, pastikan nama tabel dan kolom sesuai |
| `npm start` HTTPS tidak aktif | `certs/` tidak ada | Jalankan `npm run certs` |

---

## 9. Referensi silang ke proposal

| Butir jobdesk di proposal | Status | Bukti yang ditunjukkan |
|---|---|---|
| Penerapan HTTPS/TLS | Selesai untuk lokal dan Vercel | Screenshot `server.js` blok HTTPS, `npm run certs`, TLS 1.2/1.1, URL Vercel |
| Autentikasi API Key sisi Cloud | Selesai | Screenshot `authenticateApiKey`, `401` tanpa/salah key, `201` dengan key benar |
| Autentikasi API Key sisi Dew | Belum (firmware tidak ada di repo ini) | Sebutkan sebagai pekerjaan sisi perangkat |
| Validasi data sisi Cloud | Selesai | Screenshot V2–V4, tabel hasil uji `400`/`413` |
| Validasi data sisi Dew | Belum (firmware tidak ada di repo ini) | Sebutkan sebagai pekerjaan sisi perangkat |
| Autentikasi JWT dashboard | Belum | Catat sebagai rencana berikutnya |
| Penyimpanan offline dan sinkronisasi | Belum | Catat sebagai rencana berikutnya |
| Pengujian DoS Apache JMeter | Belum | Catat sebagai rencana berikutnya |
