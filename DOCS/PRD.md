# Product Requirements Document (PRD)
## Soil Cloud API & Dashboard Monitoring Kesuburan Tanah

| Item | Keterangan |
|---|---|
| Nama proyek | soil-cloud-api |
| Jenis | Proyek pembelajaran (base learning semester 5) |
| Target pengguna | Petani |
| Status dokumen | Draft v2.1 |
| Sumber acuan | Kode repositori, skema Supabase, `docs/design.md` |
| Catatan versi | v2.0 menambahkan autentikasi pengguna. v2.1 menyelaraskan dokumen dengan skema Supabase yang sebenarnya (`users`, `kesuburan_tanah`) |

---

## 1. Ringkasan Produk

Soil Cloud adalah sistem monitoring kesuburan tanah yang terdiri dari tiga bagian:

1. **Perangkat sensor (ESP32)** di lahan petani. Membaca parameter tanah, menghitung klasifikasi kesuburan dan rekomendasi pemupukan, lalu mengirimkannya ke cloud.
2. **Soil Cloud API** (Express.js + Supabase). Menerima, menyimpan, dan menyajikan data pengukuran, serta menangani autentikasi pengguna dashboard.
3. **Dashboard web** untuk petani. Setelah login, menampilkan kondisi tanah terkini, grafik N/P/K, rekomendasi, dan riwayat pengukuran.

Tujuan utama: petani dapat mengetahui kondisi tanah secara cepat dan memperoleh rekomendasi pemupukan tanpa harus melakukan uji laboratorium setiap saat, dengan akses data yang terbatas pada pengguna terdaftar.

---

## 2. Tujuan Produk

| No | Tujuan | Indikator Keberhasilan |
|---|---|---|
| T-1 | Mengambil data tanah secara otomatis dari sensor | Data N, P, K, pH, suhu, kelembapan, EC masuk ke database secara berkala |
| T-2 | Menyimpan data pengukuran secara aman | Hanya perangkat dengan API key valid yang dapat menulis data |
| T-3 | Membatasi akses dashboard ke pengguna terdaftar | Hanya pengguna yang lolos login dapat membaca data melalui API |
| T-4 | Menampilkan kondisi tanah terbaru dengan jelas | Nilai terbaru tampil di bagian atas halaman tanpa scroll |
| T-5 | Memberi rekomendasi yang mudah dipahami | Tingkat kesuburan dan rekomendasi tampil sebagai teks, bukan kode |
| T-6 | Menyediakan riwayat dan tren | Grafik N/P/K dan tabel riwayat tersedia |

---

## 3. Ruang Lingkup

### 3.1 Termasuk dalam lingkup

- Kebutuhan perangkat ESP32 (kontrak data dan perilaku pengiriman). Implementasi firmware tidak dibahas.
- API backend: penerimaan data, penyajian data, dan autentikasi pengguna.
- Login dashboard dengan username dan password, menghasilkan token JWT.
- Dashboard web satu halaman untuk petani, di balik login.
- Penyimpanan data pada Supabase: tabel `kesuburan_tanah` dan tabel `users`.
- Deployment: HTTPS lokal dan konfigurasi Vercel.

### 3.2 Di luar lingkup (versi saat ini)

- Halaman signup atau pendaftaran mandiri. Akun dibuat manual oleh operator melalui skrip.
- Lupa password dan reset password.
- Peran pengguna bertingkat (admin, operator, petani). Saat ini satu tingkat akses saja.
- Multi-perangkat dan multi-lahan dalam satu dashboard.
- Notifikasi (SMS, email, push).
- Perhitungan klasifikasi atau rekomendasi di sisi server. Keduanya dihasilkan oleh model AI di ESP32.
- Aplikasi mobile native.
- Kontrol aktuator (misalnya pompa atau dosing pupuk).

---

## 4. Arsitektur Sistem

```text
┌──────────────┐  HTTPS POST /api/soil       ┌────────────────┐        ┌──────────────────┐
│    ESP32     │  Header: x-api-key          │  Soil Cloud    │ insert │    Supabase      │
│ sensor tanah │ ──────────────────────────► │  API (Express) │ ─────► │  kesuburan_tanah │
│ + model AI   │                             │  server.js     │        │  users           │
└──────────────┘                             │                │ ◄───── │                  │
                                             │                │        └──────────────────┘
┌──────────────┐  POST /api/login            │                │
│   Dashboard  │  (username + password)      │                │
│ public/      │ ──────────────────────────► │                │
│ dashboard    │ ◄──── JWT ────────────────  │                │
│              │                             │                │
│              │  GET /api/soil + Bearer JWT │                │
│              │ ──────────────────────────► │                │
└──────────────┘                             └────────────────┘
```

Alur ringkas:

1. ESP32 menulis data dengan `x-api-key`.
2. Pengguna login sekali, menerima JWT.
3. JWT dipakai untuk setiap permintaan data dashboard.
4. Dashboard tidak pernah berbicara langsung ke Supabase.

Referensi kode:
- Static dashboard: `server.js:11`
- Inisialisasi Supabase: `server.js:25-28`
- Autentikasi API key: `server.js:12-23`
- Server HTTPS lokal: `server.js:207-216`
- Export aplikasi untuk Vercel: `server.js:218`
- Redirect Vercel: `vercel.json:2-4`

---

## 5. Peran Pengguna

| Peran | Deskripsi | Akses |
|---|---|---|
| Petani (pengguna terdaftar) | Melihat kondisi tanah dan rekomendasi | Login dashboard, lalu `GET /api/soil` dengan JWT |
| Perangkat ESP32 | Mengirim data pengukuran | `POST /api/soil` dengan `x-api-key` |
| Pengembang / operator | Mengelola server, database, akun, dan API key | Akses `.env`, Supabase, dan server |

Catatan: device ID tidak pernah ditampilkan atau dikirim ke dashboard.

---

## 6. Kebutuhan Fungsional

### 6.1 Autentikasi pengguna

| ID | Kebutuhan | Status |
|---|---|---|
| FR-AUTH-01 | Operator dapat membuat akun pengguna (username dan password) melalui skrip `scripts/create-user.js`, bukan melalui endpoint publik. | Direncanakan |
| FR-AUTH-02 | Password disimpan sebagai hash bcrypt pada kolom `users.password_hash`, tidak pernah sebagai teks asli. | Direncanakan |
| FR-AUTH-03 | `POST /api/login` memverifikasi username dan password, lalu mengembalikan token JWT. | Direncanakan |
| FR-AUTH-04 | Username tidak dikenal dan password salah menghasilkan respons yang sama (HTTP 401, pesan umum), untuk menghindari penebakan username. | Direncanakan |
| FR-AUTH-05 | `POST /api/login` dibatasi laju percobaan: maksimum 10 percobaan per 15 menit per alamat IP, membalas HTTP 429 saat terlampaui. | Direncanakan |
| FR-AUTH-06 | `GET /api/soil` menolak request tanpa JWT yang valid dengan HTTP 401. | Direncanakan |
| FR-AUTH-07 | JWT memiliki masa berlaku 7 hari. Setelah kedaluwarsa, pengguna harus login kembali. | Direncanakan |
| FR-AUTH-08 | Dashboard menyediakan tombol keluar yang menghapus token di browser. | Direncanakan |
| FR-AUTH-09 | Tabel `users` mengaktifkan Row Level Security tanpa policy, sehingga hanya server (secret key) yang dapat mengaksesnya. | Direncanakan |
| FR-AUTH-10 | Tabel `users` memakai `id` bertipe `int8` dengan nilai otomatis (identity). | Ada di skema |

### 6.2 Perangkat ESP32 (kebutuhan saja)

| ID | Kebutuhan |
|---|---|
| FR-ESP-01 | Perangkat membaca nilai N, P, K, pH, suhu, kelembapan (moisture), dan EC dari sensor tanah. |
| FR-ESP-02 | Perangkat menghasilkan `classification` (Rendah / Sedang / Tinggi) dan `recommendation` (teks) melalui model AI di perangkat. |
| FR-ESP-03 | Perangkat mengirim data ke `POST /api/soil` dalam format JSON sesuai kontrak data pada bagian 7. |
| FR-ESP-04 | Perangkat menyertakan header `x-api-key` yang valid pada setiap pengiriman. |
| FR-ESP-05 | Perangkat mengirim `timestamp` pada setiap pengukuran. |
| FR-ESP-06 | Perangkat mengirim data secara berkala. Interval pengiriman harus sesuai dengan window status online dashboard (2 menit, lihat FR-DASH-03). |
| FR-ESP-07 | Perangkat tidak terpengaruh oleh sistem login dashboard. Alur pengiriman data tidak berubah. |

### 6.3 API Backend

Kondisi akhir setelah backend dan login terpasang:

| ID | Endpoint | Deskripsi | Auth | Status |
|---|---|---|---|---|
| FR-API-01 | `GET /` | Health check. Mengembalikan `status: ok`. | Publik | Ada (`server.js:30-35`) |
| FR-API-02 | `POST /api/login` | Memverifikasi kredensial, mengembalikan JWT. | Publik + rate limit | Direncanakan |
| FR-API-03 | `POST /api/soil` | Menerima data pengukuran, memvalidasi, menyimpan ke `kesuburan_tanah`, membalas 201. | `x-api-key` | Ada; API key + validasi lengkap (`server.js`) |
| FR-API-04 | `GET /api/soil?limit=40` | Mengembalikan data terbaru untuk dashboard. | `Bearer <JWT>` | Ada, auth dan tabel perlu disesuaikan (`server.js:172-203`) |
| FR-API-05 | `GET /api/soil/latest` | Sementara: 40 data terbaru tanpa login, agar dashboard lama tetap jalan selama masa peralihan. | Publik | Ada, dijadwalkan dihapus (`server.js:138-170`) |

Endpoint yang dijadwalkan dihapus:

| ID | Endpoint | Alasan |
|---|---|---|
| FR-API-05 (dihapus) | `GET /api/soil/latest` | Hanya ada karena dashboard belum berlogin. Setelah dashboard memakai `GET /api/soil`, endpoint ini tidak diperlukan lagi. |

#### Aturan validasi FR-API-03 (POST /api/soil)

| ID | Aturan | Respons jika gagal | Referensi |
|---|---|---|---|
| VR-01 | `x-api-key` harus sama dengan `API_KEY` | HTTP 401, `Unauthorized` | `server.js` — `authenticateApiKey` |
| VR-02 | Field wajib: `timestamp`, `ph`, `temperature`, `moisture`, `nitrogen`, `phosphorus`, `potassium`, `ec`, `classification`, `recommendation` harus ada | HTTP 400, `Invalid or incomplete data` | `server.js` — validasi V2 |
| VR-03 | Field numerik (`ph`, `temperature`, `moisture`, `nitrogen`, `phosphorus`, `potassium`, `ec`) harus bertipe `number` dan finite | HTTP 400, `<field> must be a valid number` | `server.js` — validasi V3 |
| VR-04 | Kegagalan database | HTTP 500, `Failed to save data` | `server.js` — insert |
| VR-05 | Error tidak terduga | HTTP 500, `Internal server error` | `server.js` — error handler |
| VR-06 | Rentang nilai sensor | HTTP 400 | `DOCS/KEAMANAN.md` bagian 5.4 |
| VR-07 | Panjang `classification` dan `recommendation` | HTTP 400 | `DOCS/KEAMANAN.md` bagian 5.4 |
| VR-08 | Format dan kewajaran `timestamp` | HTTP 400 | `DOCS/KEAMANAN.md` bagian 5.4 |

Catatan: nilai `0` diterima karena tipe-nya `number`. String angka seperti `"6.2"` ditolak.

#### Aturan validasi FR-API-02 (POST /api/login)

| ID | Aturan | Respons jika gagal |
|---|---|---|
| LR-01 | `username` dan `password` harus ada dan berupa teks | HTTP 400 |
| LR-02 | Username tidak ditemukan atau password tidak cocok | HTTP 401, pesan umum |
| LR-03 | Terlalu banyak percobaan dalam 15 menit | HTTP 429 |
| LR-04 | Kegagalan query ke tabel `users` | HTTP 500 |
| LR-05 | `JWT_SECRET` tidak tersedia | HTTP 500 |

#### Aturan akses FR-API-04 (GET /api/soil)

| ID | Aturan | Respons jika gagal |
|---|---|---|
| GR-01 | Header `Authorization: Bearer <JWT>` harus ada | HTTP 401 |
| GR-02 | Tanda tangan dan masa berlaku JWT harus valid | HTTP 401 |
| GR-03 | Parameter `limit` opsional, nilai dijepit ke rentang 1 sampai 200 | Nilai dijepit, bukan ditolak |
| GR-04 | Kolom `id` tidak diikutkan pada respons | - |

### 6.4 Dashboard

| ID | Kebutuhan | Referensi |
|---|---|---|
| FR-DASH-01 | Dashboard meminta data ke `GET /api/soil?limit=40` dengan header `Authorization`, hanya setelah pengguna berhasil login. | `app.js:4`, `app.js:398-432` |
| FR-DASH-02 | Dashboard memperbarui data otomatis setiap 30 detik. | `app.js:5`, `app.js:498` |
| FR-DASH-03 | Status ditampilkan **Online** jika data terbaru tidak lebih tua dari 2 menit, selain itu **Offline**. Status juga ditampilkan **Menunggu data** jika belum ada data. | `app.js:6`, `app.js:166-181` |
| FR-DASH-04 | Dashboard menampilkan waktu pembaruan terakhir di header. | `index.html:36-38`, `app.js:180` |
| FR-DASH-05 | Dashboard menampilkan 8 kartu: N, P, K, pH, Suhu, Kelembapan, EC, dan Tingkat Kesuburan. | `index.html:75-190`, `app.js:9-17` |
| FR-DASH-06 | Setiap kartu menampilkan nilai utama, satuan, dan waktu update. | `app.js:183-222` |
| FR-DASH-07 | Nilai kartu diformat sesuai jumlah desimal: N/P/K 0 desimal, pH dan suhu dan kelembapan 1 desimal, EC 2 desimal. | `app.js:9-17`, `app.js:107-113` |
| FR-DASH-08 | Kartu yang nilainya berubah diberi animasi kilat ringan (class `flash`). | `app.js:142-158` |
| FR-DASH-09 | Dashboard menampilkan grafik garis N, P, dan K terhadap waktu, maksimal 40 titik terbaru. | `app.js:7`, `app.js:19-23`, `app.js:244-322` |
| FR-DASH-10 | Dashboard menampilkan tingkat kesuburan (Rendah / Sedang / Tinggi) dengan skala visual dan teks rekomendasi. | `index.html:199-217`, `app.js:224-242` |
| FR-DASH-11 | Tingkat kesuburan dipetakan dari teks `classification`: mengandung "tinggi"/"high" menjadi tinggi, "rendah"/"low" menjadi rendah, "sedang"/"medium" menjadi sedang, lainnya menjadi idle. | `app.js:115-127` |
| FR-DASH-12 | Dashboard menampilkan tabel riwayat dengan kolom Waktu, pH, Suhu, Kelembapan, N, P, K, EC, dan Kesuburan. | `index.html:220-245`, `app.js:331-374` |
| FR-DASH-13 | Dashboard menyediakan tombol "Perbarui" untuk memuat ulang data secara manual. | `index.html:40-46`, `app.js:479` |
| FR-DASH-14 | Dashboard menampilkan banner error dengan tombol "Coba Lagi" jika pengambilan data gagal. Data terakhir yang berhasil tetap tampil. | `index.html:61-67`, `app.js:412-432` |
| FR-DASH-15 | Dashboard memuat ulang data saat tab kembali aktif (`visibilitychange`). | `app.js:489-493` |
| FR-DASH-16 | Navigasi bagian (Ringkasan, Monitoring, Rekomendasi, Riwayat) ditandai aktif saat pengguna scroll. | `index.html:51-58`, `app.js:441-477` |
| FR-DASH-17 | Dashboard menampilkan state loading, empty, dan error sesuai `design.md` bagian 18-20. | `app.js:386-396` |
| FR-DASH-18 | Dashboard responsif: 4 kartu per baris (desktop), 2 (tablet), 1 (mobile). Tabel dapat di-scroll horizontal pada layar kecil. | `docs/design.md` bagian 16 |
| FR-DASH-19 | Dashboard menampilkan layar login (username, password, tombol masuk, pesan error) sebelum konten. Konten disembunyikan sampai login berhasil. | Direncanakan |
| FR-DASH-20 | Jika server membalas 401 saat mengambil data, dashboard menghapus token dan kembali menampilkan layar login. | Direncanakan |
| FR-DASH-21 | Dashboard menyediakan tombol keluar di header. | `index.html:30-47`, direncanakan |
| FR-DASH-22 | Dashboard menyimpan token di browser agar sesi bertahan saat halaman dimuat ulang. | Direncanakan |

### 6.5 Pengiriman dan keandalan data

| ID | Kebutuhan |
|---|---|
| FR-DATA-01 | Setiap data tersimpan sebagai satu baris di `kesuburan_tanah`. |
| FR-DATA-02 | Data diurutkan berdasarkan `timestamp` secara menurun (terbaru di atas). |
| FR-DATA-03 | Chart membalik urutan data agar waktu tampil dari kiri (lama) ke kanan (baru). |
| FR-DATA-04 | API memakai satu fungsi pemetaan (`toApi()` dan `toDb()`) untuk mengubah nama kolom database menjadi nama field device, dipakai bersama oleh `POST` dan `GET`. |

---

## 7. Kontrak Data

### 7.1 Request `POST /api/soil`

Header:

```text
Content-Type: application/json
x-api-key: <API_KEY>
```

Body:

```json
{
  "timestamp": "2026-10-22T08:15:30Z",
  "ph": 6.2,
  "temperature": 29.4,
  "moisture": 48.5,
  "nitrogen": 35,
  "phosphorus": 18,
  "potassium": 24,
  "ec": 0.82,
  "classification": "Sedang",
  "recommendation": "Pemupukan sesuai kebutuhan tanah."
}
```

### 7.2 Pemetaan field

| Field device | Kolom database | Field respons | Satuan |
|---|---|---|---|
| `timestamp` | `timestamp` | `timestamp` | ISO 8601 disarankan |
| `ph` | `pH` | `ph` | pH |
| `temperature` | `temp` | `temperature` | °C |
| `moisture` | `hum` | `moisture` | % |
| `nitrogen` | `N` | `nitrogen` | mg/kg |
| `phosphorus` | `P` | `phosphorus` | mg/kg |
| `potassium` | `K` | `potassium` | mg/kg |
| `ec` | `EC` | `ec` | mS/cm |
| `classification` | `ai_label` | `classification` | teks |
| `recommendation` | `recommendation` | `recommendation` | teks |
| - | `id` | tidak dikirim | - |

Catatan: satuan EC pada kode dashboard `mS/cm` (`index.html:172`). Nilai normal EC belum didokumentasikan.

### 7.3 Request `POST /api/login`

Body:

```json
{ "username": "petani", "password": "<password>" }
```

Respons sukses (HTTP 200):

```json
{ "success": true, "token": "<JWT>" }
```

Respons gagal (HTTP 401):

```json
{ "success": false, "message": "Username atau password salah" }
```

### 7.4 Respons endpoint data

Sukses `POST /api/soil` (HTTP 201):

```json
{
  "success": true,
  "message": "Data saved successfully",
  "data": [
    {
      "timestamp": "2026-10-22T08:15:30Z",
      "ph": 6.2,
      "temperature": 29.4,
      "moisture": 48.5,
      "nitrogen": 35,
      "phosphorus": 18,
      "potassium": 24,
      "ec": 0.82,
      "classification": "Sedang",
      "recommendation": "Pemupukan sesuai kebutuhan tanah."
    }
  ]
}
```

Sukses `GET /api/soil` (HTTP 200):

```json
{
  "success": true,
  "message": "Data retrieved successfully",
  "data": [ "... sama bentuknya dengan di atas ..." ]
}
```

Gagal: `{ "success": false, "message": "...", "error": "..." }` (field `error` hanya pada kegagalan database, dan sebaiknya hanya masuk log server, lihat `docs/KEAMANAN.md` bagian 5.8).

### 7.5 Model data `kesuburan_tanah`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | `int8` | Kunci utama, nilai otomatis (identity) |
| `timestamp` | `timestamp` | Waktu pengukuran dari perangkat |
| `hum` | `numeric` | Kelembapan tanah |
| `temp` | `numeric` | Suhu tanah |
| `N` | `numeric` | Nitrogen |
| `P` | `numeric` | Phosphorus |
| `K` | `numeric` | Potassium |
| `pH` | `numeric` | pH tanah |
| `EC` | `numeric` | Electrical conductivity |
| `ai_label` | `text` | Klasifikasi dari AI |
| `recommendation` | `text` | Rekomendasi dari AI |

Catatan: nama kolom bersifat campur huruf besar dan kecil (`hum`, `temp`, `N`, `P`, `K`, `pH`, `EC`). Karena itu API memakai `select("*")` lalu memetakan nama di JavaScript, bukan alias PostgREST yang peka huruf besar/kecil. `docs/RANGKUMAN.md` menormalkan nama kolom menjadi huruf kecil untuk pembangunan ulang; kalau tabel yang ada dipakai apa adanya, ikuti tabel di atas.

Catatan: tidak ada kolom `device_id`. Satu tabel diasumsikan untuk satu perangkat.

### 7.6 Model data `users`

| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | `int8` | Kunci utama, nilai otomatis (identity) |
| `username` | `text` | Unik, dipakai untuk login |
| `password_hash` | `text` | Hash bcrypt, bukan password asli |
| `created_at` | `timestamptz` | Waktu pembuatan akun |

Nama awal tabel adalah `user` dan kolomnya `password`. Dua nama itu perlu diganti sebelum implementasi: `user` adalah kata kunci SQL yang menyulitkan penulisan query, dan `password` yang berisi hash berpotensi disalahpahami sebagai password asli.

```sql
alter table public."user" rename to users;
alter table public.users rename column password to password_hash;
alter table public.users enable row level security;
alter table public.kesuburan_tanah enable row level security;
```

Row Level Security aktif pada kedua tabel. Tidak ada policy, sehingga tabel hanya dapat diakses oleh server yang memegang secret key Supabase.

---

## 8. Kebutuhan Non-Fungsional

### 8.1 Keamanan

Rincian lengkap ada di `docs/KEAMANAN.md`.

| ID | Kebutuhan | Referensi |
|---|---|---|
| NFR-SEC-01 | Endpoint tulis (`POST /api/soil`) wajib menggunakan `x-api-key`. | `server.js` — `authenticateApiKey` |
| NFR-SEC-02 | Semua kredensial (Supabase, `API_KEY`, `JWT_SECRET`) disimpan di `.env` dan di environment Vercel, tidak di-commit. | `.gitignore:1` |
| NFR-SEC-03 | Folder `certs/` (kunci dan sertifikat) tidak di-commit. | `.gitignore:3` |
| NFR-SEC-04 | Server lokal berjalan melalui HTTPS. | `server.js` — blok HTTPS lokal; buat sertifikat dengan `npm run certs` |
| NFR-SEC-05 | Password pengguna disimpan hanya sebagai hash bcrypt, dengan cost factor 10. | Direncanakan |
| NFR-SEC-06 | Pengecekan password hanya dilakukan di server, tidak pernah di browser. | Direncanakan |
| NFR-SEC-07 | Endpoint data dilindungi JWT, bukan API key, sehingga kunci perangkat tidak pernah sampai ke browser. | Direncanakan |
| NFR-SEC-08 | Tabel `users` dan `kesuburan_tanah` memakai RLS tanpa policy. | Direncanakan |
| NFR-SEC-09 | Login dibatasi laju percobaan. | Direncanakan |
| NFR-SEC-10 | Secret key Supabase hanya berada di server, tidak pernah dikirim ke browser. | Saat ini |
| NFR-SEC-11 | Data pengukuran tidak mengandung data pribadi petani. | Asumsi desain |

Catatan kompromi: token JWT disimpan di `localStorage` untuk kesederhanaan versi ini. Penyimpanan di cookie `httpOnly` lebih tahan XSS, tetapi memerlukan penanganan CORS dan `SameSite`, sehingga ditunda ke versi berikutnya.

### 8.2 Performa

| ID | Kebutuhan |
|---|---|
| NFR-PERF-01 | Dashboard memuat data terbaru tanpa memerlukan reload halaman penuh. |
| NFR-PERF-02 | Respons `GET /api/soil` dibatasi jumlah baris melalui parameter `limit` (default dashboard: 40, maksimum 200). |
| NFR-PERF-03 | Dashboard tidak memakai framework frontend (HTML, CSS, JavaScript vanilla, Chart.js). |
| NFR-PERF-04 | Animasi dan efek tidak berat (`design.md` bagian 18). |

### 8.3 Ketersediaan dan keandalan

| ID | Kebutuhan |
|---|---|
| NFR-REL-01 | Kegagalan pengambilan data tidak mengosongkan halaman. Data terakhir tetap tampil. |
| NFR-REL-02 | Dashboard mencoba ulang otomatis setiap 30 detik. |
| NFR-REL-03 | Request ganda saat data masih dimuat diabaikan (`isFetching`). |
| NFR-REL-04 | Kedaluwarsa token tidak membuat halaman rusak; dashboard kembali ke layar login dengan pesan yang jelas. |
| NFR-REL-05 | Selama masa peralihan, `GET /api/soil/latest` tetap tersedia sehingga dashboard lama tidak mati sebelum frontend dipindah. |

### 8.4 Usabilitas dan aksesibilitas

| ID | Kebutuhan | Referensi |
|---|---|---|
| NFR-UX-01 | Informasi terbaru di atas, tanpa perlu scroll. | `docs/design.md` bagian 21 |
| NFR-UX-02 | Nilai kartu lebih besar dan tebal daripada label. | `docs/design.md` bagian 14 |
| NFR-UX-03 | Status menggunakan teks dan indikator visual, tidak hanya warna. | `docs/design.md` bagian 4 |
| NFR-UX-04 | Bahasa antarmuka Indonesia (`lang="id"`). | `index.html:2` |
| NFR-UX-05 | Tautan "Lewati ke konten utama" tersedia untuk navigasi keyboard. | `index.html:14` |
| NFR-UX-06 | Grafik memiliki `role="img"` dan `aria-label`. | `index.html:200` |
| NFR-UX-07 | Tabel memiliki `caption` tersembunyi (sr-only) dan `scope` pada header. | `index.html:227-238` |
| NFR-UX-08 | Form login dapat dioperasikan penuh dengan keyboard dan memiliki label yang terlihat. | Direncanakan |

### 8.5 Kompatibilitas dan deployment

| ID | Kebutuhan |
|---|---|
| NFR-DEP-01 | Runtime Node.js dengan `type: commonjs`. |
| NFR-DEP-02 | Dependensi: `express` 5, `@supabase/supabase-js`, `dotenv`. Tambahan yang direncanakan: `bcryptjs`, `jsonwebtoken`, `express-rate-limit`. |
| NFR-DEP-03 | Dashboard dapat diakses melalui `/dashboard`, dengan redirect permanen ke `/dashboard/` di Vercel. |
| NFR-DEP-04 | Browser modern dengan dukungan `fetch`, `Intl` locale `id-ID`, dan ES5-style JavaScript. |

### 8.6 Konfigurasi lingkungan

| Variabel | Fungsi | Status |
|---|---|---|
| `SUPABASE_URL` | URL proyek Supabase | Ada |
| `SUPABASE_KEY` | Kunci Supabase (secret, hanya server) | Ada |
| `API_KEY` | Kunci autentikasi perangkat | Ada |
| `PORT` | Port server (default 3000) | Ada |
| `JWT_SECRET` | Kunci penandatanganan JWT | Direncanakan |

---

## 9. Desain Antarmuka

Desain antarmuka mengacu sepenuhnya pada `docs/design.md`. Ringkasan:

### 9.1 Konsep

Dashboard adalah **Dashboard Monitoring Kesuburan Tanah**: sederhana, ringan, bersih, dan mudah dibaca.

Tema visual: **Smart Farming / Agricultural Monitoring**.

### 9.2 Layout utama (urutan dari atas)

1. Layar login (tampil sebelum autentikasi).
2. Header: nama aplikasi, status, waktu update, tombol refresh, tombol keluar.
3. Navigasi bagian: Ringkasan, Monitoring, Rekomendasi, Riwayat.
4. Banner error (tersembunyi jika tidak ada error).
5. Kartu kondisi tanah (8 kartu dalam 2 baris, 4 kartu per baris pada desktop).
6. Grafik monitoring N/P/K (kiri) dan panel rekomendasi (kanan).
7. Riwayat pengukuran (tabel).
8. Footer: sumber data dan pembaruan otomatis setiap 30 detik.

### 9.3 Layar login

| Elemen | Keterangan |
|---|---|
| Judul | Nama aplikasi dan tujuan singkat |
| Kolom username | Label terlihat |
| Kolom password | Tersembunyi, label terlihat |
| Tombol masuk | Menonjol, satu aksi utama |
| Pesan error | Muncul di dekat form, teks jelas, tidak hanya warna |

Konten dashboard tidak dirender sebelum login berhasil.

### 9.4 Prioritas kartu

1. N
2. P
3. K
4. pH
5. Suhu
6. Kelembapan
7. EC
8. Tingkat Kesuburan

Nilai harus lebih besar daripada label. Ikon hanya pendukung dan tidak menggantikan teks.

### 9.5 Warna

| Token | Nilai |
|---|---|
| Primary Green | `#2F7D4A` |
| Dark Green | `#183B27` |
| Background | `#F5F7F8` |
| Panel | `#FFFFFF` |
| Text | `#18221D` |
| Muted Text | `#728078` |
| Border | `#E3E9E5` |
| Success | `#57C878` |

Warna dominan: putih dan hijau. Warna grafik: N `#2F7D4A`, P `#C77D0A`, K `#2A6F97` (`app.js:20-22`).

### 9.6 Kartu

- Latar putih, border tipis, radius 10-14px, shadow ringan, padding cukup.
- Isi kartu: nama parameter, nilai utama, satuan, waktu update.

### 9.7 Tipografi

- Font: Inter, System UI, Segoe UI, sans-serif. Kode memuat Plus Jakarta Sans dari Google Fonts (`index.html:10`). Perbedaan ini tercatat di bagian 12.
- Judul dashboard 26-32px, judul section 16-18px, nilai kartu 28-34px, label kartu 12-14px, tabel 11-13px, teks kecil 10-11px.

### 9.8 Status dan state

| State | Tampilan |
|---|---|
| Online | `● Online` |
| Offline | `● Offline` |
| Loading | Teks "Memuat data..." dan placeholder sederhana |
| Empty | "Belum ada data pengukuran." dan "Belum terdapat riwayat pengukuran." |
| Error | "Gagal memuat data." dengan tombol "Coba Lagi" |
| Belum login | Layar login dengan form username dan password |
| Sesi berakhir | Layar login dengan pesan sesi berakhir |

### 9.9 Aturan UX

- Informasi terbaru di atas.
- Nilai mudah dipindai dalam beberapa detik.
- Kartu untuk data realtime. Grafik dan tabel untuk data historis.
- Rekomendasi tampil jelas, tidak disembunyikan di tabel.

### 9.10 Responsif

| Layar | Kartu per baris |
|---|---|
| Desktop | 4 |
| Tablet | 2 |
| Mobile | 1 |

Grafik mengikuti lebar kontainer. Tabel di-scroll horizontal pada layar kecil. Form login satu kolom pada semua ukuran.

---

## 10. Alur Pengguna

### 10.1 Alur petani

1. Petani membuka URL dashboard.
2. Dashboard menampilkan layar login.
3. Petani memasukkan username dan password.
4. Server memverifikasi dan mengembalikan JWT.
5. Dashboard menampilkan kondisi tanah terbaru dan status perangkat.
6. Petani membaca tingkat kesuburan dan rekomendasi.
7. Petani melihat grafik tren N/P/K atau riwayat jika diperlukan.
8. Dashboard memperbarui data otomatis atau petani menekan "Perbarui".
9. Petani menekan "Keluar" saat selesai.

### 10.2 Alur perangkat

1. ESP32 membaca sensor.
2. ESP32 menghasilkan klasifikasi dan rekomendasi.
3. ESP32 mengirim data ke `POST /api/soil`.
4. Server memvalidasi, menyimpan ke `kesuburan_tanah`, dan membalas 201.

### 10.3 Alur error

| Kondisi | Respons / perilaku |
|---|---|
| API key perangkat salah atau tidak ada | HTTP 401 |
| Field perangkat kurang | HTTP 400 |
| Tipe numerik perangkat salah | HTTP 400 |
| Database gagal | HTTP 500 |
| Login: field kosong | HTTP 400, pesan di form |
| Login: kredensial salah | HTTP 401, pesan umum |
| Login: terlalu banyak percobaan | HTTP 429 |
| Token hilang atau kedaluwarsa | HTTP 401, dashboard kembali ke login |
| Operator membuat akun | Skrip lokal, bukan endpoint |

---

## 11. Known Issue

| ID | Deskripsi | Referensi | Status |
|---|---|---|---|
| KI-01 | Field `main` di `package.json` mengarah ke `index.js`, file yang tidak ada. Entry point sebenarnya `server.js`. | `package.json:5` | Terbuka |
| KI-02 | Script `test` masih placeholder. Tidak ada test otomatis. | `package.json:7` | Terbuka |
| KI-03 | Tidak ada `device_id`. Satu tabel diasumsikan untuk satu perangkat. | Skema | Diterima (sesuai keputusan) |
| KI-04 | Header dashboard tidak menampilkan Device ID dan status perangkat sesuai `design.md`. | `index.html:16-49` | Diterima (device ID sengaja tidak ditampilkan) |
| KI-05 | Tabel riwayat tidak memiliki kolom ID. Kolom Waktu memakai format `dd MMM, HH:MM:SS`. | `index.html:230-239`, `app.js:93-105` | Terbuka |
| KI-06 | `GET /api/soil/latest` publik, sementara `GET /api/soil` butuh token. Ketidakcocokan ini hilang setelah frontend dipindah dan endpoint lama dihapus. | `server.js:138`, `server.js:172` | Akan ditutup |
| KI-07 | Kolom `id` tidak diikutkan pada respons API. | fungsi pemetaan di `server.js` | Diterima |
| KI-08 | Klasifikasi dashboard bergantung pada kata kunci teks. Teks lain menjadi status idle. | `app.js:115-127` | Terbuka |
| KI-09 | Validasi format `timestamp` dan rentang nilai sensor sudah ada. | `server.js` — validasi V4 | Tertutup (`DOCS/KEAMANAN.md` bagian 5.4) |
| KI-10 | Validasi panjang dan tipe `classification` dan `recommendation` sudah ada. | `server.js` — validasi V4 | Tertutup (`DOCS/KEAMANAN.md` bagian 5.4) |
| KI-11 | Dashboard memuat Chart.js dan font dari CDN eksternal. | `index.html:10`, `index.html:252` | Terbuka |
| KI-12 | Tidak ada rate limit pada `POST /api/soil`. | `server.js:37` | Terbuka |
| KI-13 | Tidak ada pagination. `GET /api/soil` mengembalikan maksimum 200 baris terbaru, tidak ada halaman berikutnya. | `server.js:172-203` | Diterima |
| KI-14 | Font di kode (Plus Jakarta Sans) berbeda dengan `design.md` (Inter). | `index.html:10` | Terbuka |
| KI-15 | Unit EC dan rentang nilai normal belum didokumentasikan. | `index.html:172` | Terbuka |
| KI-16 | Label "Kelembapan" dan "Moisture" bergantian pada dokumen desain. | `docs/design.md` bagian 17 | Terbuka |
| KI-17 | Kredensial `.env` ada di folder proyek. Sudah di `.gitignore`. | `.gitignore:1` | Terkendali |
| KI-18 | Belum ada mekanisme ubah password selain menjalankan skrip. | - | Terbuka |
| KI-19 | Belum ada pemulihan password jika lupa. | - | Terbuka |
| KI-20 | Secret key Supabase pernah terbuka pada screenshot dan perlu dirotasi. | - | Tindakan tertunda |
| KI-21 | Nama kolom `kesuburan_tanah` tidak konsisten huruf besar/kecil (`hum`, `temp` huruf kecil; `N`, `P`, `K`, `pH`, `EC` huruf besar). Pemetaan dilakukan di JavaScript. | Skema | Diterima |
| KI-22 | Kolom `id` bertipe `int8` dan bergantung pada nilai otomatis (identity). Jika default tersebut hilang, `POST /api/soil` gagal. | Skema | Terbuka |
| KI-23 | Kode dan dokumen masih menyebut tabel `soil_measurements` dengan kolom `Temp` dan `Hum`, sedangkan proyek Supabase aktif memakai `kesuburan_tanah` dengan `temp` dan `hum`. Selama belum diseragamkan, `POST /api/soil` akan gagal. | `server.js:92`, `server.js:135` | **Terbuka, prioritas** |
| KI-24 | Bug `limit` non-positif: `Number("-5") \|\| 200` menghasilkan `-5`, lalu `Math.min(-5, 200)` tetap `-5`. Perbaikan: jepit dengan `Math.max`. | `server.js:173-177` | Terbuka |

---

## 12. Perbedaan Desain dan Implementasi

| Aspek | `docs/design.md` | Implementasi saat ini |
|---|---|---|
| Header | Device ID dan status perangkat | Hanya status, waktu update, tombol refresh (device ID sengaja dihilangkan) |
| Tabel riwayat | Kolom ID | Tidak ada kolom ID |
| Tabel riwayat | Kolom Kesuburan | Ada |
| Kartu | 8 kartu | 8 kartu (sesuai) |
| Grafik | N, P, K | N, P, K (sesuai) |
| Font | Inter, System UI, Segoe UI | Plus Jakarta Sans dari Google Fonts |
| Navigasi | Dashboard, Riwayat, Rekomendasi | Ringkasan, Monitoring, Rekomendasi, Riwayat |
| Struktur file | `index.html`, `style.css`, `app.js` | Sesuai, berada di `public/dashboard/` |
| Akses | Tidak dibahas | Dashboard di balik login |
| Login | Tidak dibahas | Direncanakan: form username + password |

---

## 13. Asumsi

| ID | Asumsi |
|---|---|
| AS-01 | Satu perangkat ESP32 mengirim data ke satu database. |
| AS-02 | Format `timestamp` dikirim perangkat dalam format yang dapat di-parse `Date`. |
| AS-03 | Model AI di ESP32 menghasilkan `classification` dengan kata "Rendah", "Sedang", atau "Tinggi". |
| AS-04 | Petani mengakses dashboard melalui browser dengan koneksi internet. |
| AS-05 | Jumlah pengguna dashboard kecil (satu sampai beberapa akun), dibuat manual oleh operator. |
| AS-06 | Proyek digunakan untuk pembelajaran dan belum dipakai pada lahan produksi. |
| AS-07 | Data pengukuran bersifat privat, hanya untuk pengguna yang login. |
| AS-08 | Signup publik tidak dibuka, sehingga tidak ada pendaftaran mandiri. |
| AS-09 | Kolom `id` pada kedua tabel sudah memiliki nilai otomatis dari Supabase. |

---

## 14. Risiko

| ID | Risiko | Dampak | Mitigasi yang sudah ada | Mitigasi yang direncanakan |
|---|---|---|---|---|
| R-01 | API key bocor dari firmware ESP32 | Data palsu dapat masuk | Key di `.env` dan header `x-api-key` | Rotasi key, pertimbangkan key per perangkat |
| R-02 | Koneksi internet lahan terputus | Data tidak terkirim, status Offline | Status Offline di dashboard | Buffer lokal di ESP32 |
| R-03 | Model AI salah klasifikasi | Rekomendasi pemupukan keliru | Tidak ada | Validasi model dan kalibrasi sensor |
| R-04 | Sensor tidak terkalibrasi | Nilai tidak akurat | Tidak ada | Prosedur kalibrasi berkala |
| R-05 | Supabase atau CDN tidak tersedia | Dashboard atau API gagal | Pesan error di dashboard | Fallback Chart.js lokal |
| R-06 | Brute force password login | Akun dibajak | Belum ada | Rate limit 10 percobaan per 15 menit |
| R-07 | Token di `localStorage` dicuri lewat XSS | Sesi dibajak | Belum ada | Migrasi ke cookie `httpOnly`; hindari menyisipkan HTML dari data eksternal |
| R-08 | `JWT_SECRET` bocor | Token dapat dipalsukan | Belum ada | Simpan hanya di env, rotasi berkala, jangan pernah masuk kode atau repo |
| R-09 | Lupa password | Pengguna terkunci | Belum ada | Operator dapat menimpa hash lewat skrip |
| R-10 | Login rusak atau JWT salah konfigurasi | Dashboard kosong total, data tidak terbaca | Belum ada | Uji login sebelum demo; siapkan cara menonaktifkan proteksi sebagai jalan darurat |
| R-11 | Nama kolom database berubah sewaktu-waktu | `POST` atau `GET` gagal | Pemetaan terpusat di `toApi()` dan `toDb()` | Catat skema di dokumen ini; ubah satu tempat saja saat skema berubah |
| R-12 | Kode dan dokumen belum selaras dengan skema Supabase | `POST` gagal, dashboard kosong | Belum ada | Seragamkan nama tabel dan kolom (lihat KI-23) |

---

## 15. Referensi Kode

| Komponen | File | Baris penting |
|---|---|---|
| Server dan endpoint | `server.js` | 1-218 |
| Autentikasi API key | `server.js` | 12-23 |
| Validasi POST | `server.js` | 37-133 |
| Query GET | `server.js` | 135-203 |
| Konfigurasi konstanta dashboard | `public/dashboard/app.js` | 4-23 |
| Render dashboard | `public/dashboard/app.js` | 166-374 |
| Pengambilan data | `public/dashboard/app.js` | 398-432 |
| Struktur HTML | `public/dashboard/index.html` | 1-255 |
| Dependensi dan script | `package.json` | 1-21 |
| Redirect deployment | `vercel.json` | 1-5 |
| Desain UI | `docs/design.md` | 1-729 |
| Keamanan dan validasi | `docs/KEAMANAN.md` | 1-... |
| Blueprint bangun ulang | `docs/RANGKUMAN.md` | 1-... |
| Pemetaan nama kolom (`toApi`, `toDb`) | `server.js` | Direncanakan |
| Autentikasi JWT dan login | `server.js` | Direncanakan |
| Layar login | `public/dashboard/index.html`, `app.js`, `style.css` | Direncanakan |
| Skrip pembuatan akun | `scripts/create-user.js` | Direncanakan |

---

## 16. Glosarium

| Istilah | Arti |
|---|---|
| N (Nitrogen) | Unsur hara nitrogen, satuan mg/kg |
| P (Phosphorus) | Unsur hara fosfor, satuan mg/kg |
| K (Potassium) | Unsur hara kalium, satuan mg/kg |
| EC | Electrical conductivity, daya hantar listrik tanah, satuan mS/cm |
| Kesuburan | Klasifikasi tingkat kesuburan tanah: Rendah, Sedang, Tinggi |
| Online/Offline | Status perangkat berdasarkan waktu data terakhir |
| API key | Kunci rahasia untuk autentikasi perangkat |
| JWT | JSON Web Token, token bertanda tangan sebagai bukti sesi login |
| bcrypt | Algoritma hash password satu arah |
| Hash | Bentuk acak tak dapat dibalik dari password, dipakai untuk pencocokan |
| RLS | Row Level Security di Supabase/PostgreSQL, membatasi akses per baris |
| Rate limit | Pembatasan jumlah percobaan dalam jangka waktu tertentu |
| Identity | Nilai otomatis pada kolom `id` sehingga tidak perlu diisi saat insert |
| Token | Bukti sesi yang dikirim browser pada setiap permintaan |
| Supabase | Layanan database dan backend berbasis PostgreSQL |
