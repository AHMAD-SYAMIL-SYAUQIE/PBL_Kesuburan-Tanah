# Design Dashboard

## 1. Konsep

Dashboard berfungsi sebagai **Dashboard Monitoring Kesuburan Tanah**.

Fokus halaman hanya pada tampilan dan pengalaman pengguna:

- Monitoring data sensor terbaru
- Visualisasi data
- Tingkat kesuburan
- Rekomendasi
- Riwayat pengukuran

Dashboard dibuat **sederhana, ringan, bersih, dan mudah dibaca**.

---

## 2. Teknologi Frontend

```text
HTML5
CSS3
JavaScript
Chart.js
```

Tidak menggunakan framework frontend seperti React, Vue, atau Angular.

Struktur:

```text
dashboard/
├── index.html
├── style.css
└── app.js
```

---

## 3. Layout Utama

Dashboard menggunakan satu halaman utama.

```text
┌──────────────────────────────────────────────────────────────┐
│ HEADER                                                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ N        │ │ P        │ │ K        │ │ pH       │       │
│  │ 35 mg/kg │ │ 18 mg/kg │ │ 24 mg/kg │ │ 6.2 pH   │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Suhu     │ │Kelembapan│ │ EC       │ │Kesuburan │       │
│  │ 29.4 °C  │ │ 48.5 %   │ │ 0.82     │ │ Sedang   │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                              │
├─────────────────────────────────────┬────────────────────────┤
│                                     │                        │
│ GRAFIK MONITORING                   │ REKOMENDASI            │
│                                     │                        │
│ N ─────────────                     │ Tingkat Kesuburan      │
│ P ────────────                      │ Sedang                 │
│ K ─────────────                     │                        │
│                                     │ Pemupukan sesuai       │
│                                     │ kebutuhan tanah        │
│                                     │                        │
├─────────────────────────────────────┴────────────────────────┤
│ RIWAYAT PENGUKURAN                                           │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Header

Header berada di bagian paling atas dashboard.

Isi:

- Nama aplikasi
- Device ID
- Status perangkat
- Waktu update terakhir
- Tombol refresh

Contoh:

```text
Soil Monitoring

ESP32-001    ● Online

Last Update: 06 Oct 2026, 10:30:15

[ Refresh ]
```

### Status

Online:

```text
● Online
```

Offline:

```text
● Offline
```

Status harus menggunakan teks dan indikator visual.

---

## 5. Sensor Cards

Dashboard memiliki **8 card informasi utama**.

### Baris pertama

```text
N (Nitrogen)
35 mg/kg
```

```text
P (Phosphorus)
18 mg/kg
```

```text
K (Potassium)
24 mg/kg
```

```text
pH Tanah
6.2 pH
```

### Baris kedua

```text
Suhu Tanah
29.4 °C
```

```text
Kelembapan Tanah
48.5 %
```

```text
EC Tanah
0.82
```

```text
Tingkat Kesuburan
Sedang
```

Setiap card terdiri dari:

```text
Nama parameter
       ↓
Nilai utama
       ↓
Satuan / keterangan
       ↓
Waktu update
```

---

## 6. Prioritas Card

Card yang paling penting secara visual:

1. N
2. P
3. K
4. pH
5. Suhu
6. Kelembapan
7. EC
8. Tingkat Kesuburan

Nilai harus berukuran lebih besar daripada label.

Contoh:

```text
N (Nitrogen)

35
mg/kg
```

bukan:

```text
N (Nitrogen) 35 mg/kg
```

---

## 7. Grafik Monitoring

Grafik ditempatkan di bagian tengah dashboard.

Judul:

> **Monitoring Parameter Nutrisi**

Subjudul:

> Perubahan nilai N, P, dan K berdasarkan waktu.

Grafik menggunakan **line chart**.

Parameter:

```text
Nitrogen (N)
Phosphorus (P)
Potassium (K)
```

Sumbu:

```text
X = Waktu
Y = Nilai
```

Contoh:

```text
Nilai
 ^
40│       N
  │      / \____
30│ ____/       \___
  │
20│    P
  │   / \____
10│__/       \____
  │
  └────────────────────→ Waktu
```

Library:

```text
Chart.js
```

---

## 8. Panel Tingkat Kesuburan

Tingkat kesuburan ditampilkan secara jelas.

Contoh:

```text
TINGKAT KESUBURAN

SEDANG
```

Nilai dapat berupa:

```text
Rendah
Sedang
Tinggi
```

Tampilan kategori harus dibuat menonjol agar pengguna langsung mengetahui kondisi tanah.

---

## 9. Panel Rekomendasi

Panel rekomendasi berada di sebelah grafik.

Contoh:

```text
REKOMENDASI

Pemupukan sesuai kebutuhan tanah.
```

Jika rekomendasi lebih panjang, gunakan:

```text
REKOMENDASI

Kondisi tanah berada pada tingkat
kesuburan sedang. Lakukan pemupukan
sesuai kebutuhan unsur hara tanah.
```

Rekomendasi ditampilkan sebagai teks yang mudah dibaca, bukan hanya kode atau nilai numerik.

---

## 10. Riwayat Pengukuran

Riwayat ditempatkan di bagian bawah halaman.

Judul:

> **Riwayat Pengukuran**

Tabel:

```text
ID | Timestamp | pH | Suhu | Kelembapan | N | P | K | EC | Kesuburan
```

Contoh:

```text
3 | 10:30:15 | 6.2 | 29.4 | 48.5 | 35 | 18 | 24 | 0.82 | Sedang
2 | 10:20:15 | 6.1 | 29.1 | 47.8 | 34 | 17 | 23 | 0.79 | Sedang
1 | 10:10:15 | 6.0 | 28.9 | 46.9 | 33 | 17 | 22 | 0.77 | Sedang
```

Kolom wajib:

- ID
- Timestamp
- pH
- Suhu
- Kelembapan
- N
- P
- K
- EC
- Kesuburan

---

## 11. Navigasi

Karena dashboard masih satu halaman, navigasi dibuat minimal.

Menu yang dapat digunakan:

```text
Dashboard
Riwayat
Rekomendasi
```

Jika semua informasi sudah berada dalam satu halaman, menu dapat menggunakan anchor:

```text
Dashboard
    ↓
Monitoring
    ↓
Rekomendasi
    ↓
Riwayat
```

Tidak perlu membuat banyak halaman jika belum diperlukan.

---

## 12. Warna

Tema visual:

> **Smart Farming / Agricultural Monitoring**

Warna utama:

```text
Primary Green : #2F7D4A
Dark Green    : #183B27
Background    : #F5F7F8
Panel         : #FFFFFF
Text          : #18221D
Muted Text    : #728078
Border        : #E3E9E5
Success       : #57C878
```

Dominan:

```text
Putih + Hijau
```

Tujuannya memberikan kesan:

- Natural
- Bersih
- Modern
- Profesional
- Berhubungan dengan pertanian

---

## 13. Card Design

Card menggunakan:

```text
Background : putih
Border     : tipis
Radius     : 10–14px
Shadow     : ringan
Padding    : cukup luas
```

Contoh:

```text
┌─────────────────────┐
│ N (Nitrogen)     N  │
│                     │
│ 35                  │
│ mg/kg               │
│                     │
│ Updated 10:30       │
└─────────────────────┘
```

Tidak menggunakan shadow yang terlalu kuat.

---

## 14. Typography

Gunakan font sans-serif yang sederhana.

Prioritas:

```text
Inter
System UI
Segoe UI
sans-serif
```

Ukuran:

```text
Dashboard title : 26–32px
Section title   : 16–18px
Card value      : 28–34px
Card label      : 12–14px
Table           : 11–13px
Small text      : 10–11px
```

Nilai sensor harus lebih besar dan lebih tebal daripada label.

---

## 15. Ikon

Ikon hanya sebagai elemen pendukung.

Contoh:

```text
N          → daun
P          → nutrient
K          → plant/soil
pH         → pH
Suhu       → thermometer
Kelembapan → water drop
EC         → electricity
Kesuburan  → status
```

Ikon tidak boleh menggantikan teks parameter.

---

## 16. Responsive Design

### Desktop

```text
4 card / baris
```

### Tablet

```text
2 card / baris
```

### Mobile

```text
1 card / baris
```

Grafik mengikuti lebar container.

Tabel riwayat dapat menggunakan horizontal scrolling pada layar kecil.

---

## 17. Realtime UI

Dashboard harus memiliki indikator data terbaru.

Contoh:

```text
● Data terbaru
Last update: 10:30:15
```

Ketika data diperbarui:

```text
N        35 mg/kg
P        18 mg/kg
K        24 mg/kg
pH       6.2
Suhu     29.4 °C
Moisture 48.5 %
EC       0.82
```

semua nilai card diperbarui tanpa perlu reload halaman penuh.

---

## 18. Loading State

Ketika data sedang dimuat:

```text
Loading data...
```

Card dapat menggunakan placeholder sederhana.

Contoh:

```text
N (Nitrogen)

Loading...
```

Tidak perlu menggunakan animasi berat.

---

## 19. Empty State

Jika belum ada data:

```text
Belum ada data pengukuran.
```

Untuk riwayat:

```text
Belum terdapat riwayat pengukuran.
```

---

## 20. Error State

Jika dashboard gagal mendapatkan data:

```text
Gagal memuat data.

Periksa koneksi ke Cloud Node.

[ Coba Lagi ]
```

Error tidak boleh membuat seluruh halaman kosong.

Data terakhir yang berhasil diterima dapat tetap ditampilkan jika tersedia.

---

## 21. UX Rules

Dashboard harus mengikuti aturan:

### Informasi terbaru selalu di atas

Pengguna tidak perlu scrolling untuk melihat kondisi tanah terbaru.

### Nilai mudah dipindai

Pengguna dapat mengetahui:

```text
N
P
K
pH
Suhu
Moisture
EC
Kesuburan
```

dalam beberapa detik.

### Realtime dan history dibedakan

```text
Current data → Card
Historical data → Chart + Table
```

### Rekomendasi terlihat jelas

Rekomendasi tidak disembunyikan di dalam tabel.

---

## 22. Struktur File

```text
dashboard/
├── index.html
├── style.css
└── app.js
```

### `index.html`

Mengatur struktur:

```text
Header
Sensor Cards
Chart
Classification
Recommendation
History Table
```

### `style.css`

Mengatur:

```text
Layout
Color
Typography
Card
Table
Chart container
Responsive
Status
Loading
Error
```

### `app.js`

Mengatur:

```text
Data rendering
Card update
Chart update
History update
Realtime refresh
Loading state
Error state
```

---

## 23. Target Final

Tampilan akhir harus terasa seperti dashboard monitoring smart farming modern:

```text
                    SOIL MONITORING
              ESP32-001 ● ONLINE

┌────────┬────────┬────────┬────────┐
│   N    │   P    │   K    │   pH   │
│ 35     │ 18     │ 24     │ 6.2    │
├────────┼────────┼────────┼────────┤
│  SUHU  │MOISTURE│   EC   │KESUBURAN│
│ 29.4°C │ 48.5%  │ 0.82   │ SEDANG │
└────────┴────────┴────────┴────────┘

┌──────────────────────────┬──────────────────┐
│ MONITORING N / P / K     │ REKOMENDASI      │
│                          │                  │
│       GRAPH              │ Tingkat: Sedang  │
│                          │                  │
└──────────────────────────┴──────────────────┘

┌──────────────────────────────────────────────┐
│ RIWAYAT PENGUKURAN                           │
│ ID | Waktu | pH | Suhu | N | P | K | EC     │
└──────────────────────────────────────────────┘
```

**Prinsip desain utama:**

> **Current condition → Visualization → Recommendation → History**

Dashboard hanya berfokus pada **tampilan, monitoring, visualisasi, dan pengalaman pengguna**. Detail implementasi backend, API, database, autentikasi, dan arsitektur sistem tidak menjadi bagian dari desain UI ini.
