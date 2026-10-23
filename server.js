const express = require("express");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();
// Body sensor hanya beberapa ratus byte; 8 KB longgar dan menutup kiriman besar.
// Lihat DOCS/KEAMANAN.md bagian 5.2.
app.use(express.json({ limit: "8kb" }));
// Dev lokal memakai Express. Di Vercel baris ini diabaikan (static disajikan platform).
app.use("/dashboard", express.static(path.join(__dirname, "public", "dashboard")));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const TABLE = "kesuburan_tanah";

// device -> kolom database, dipakai saat insert
const toDb = ({ ph, temperature, moisture, nitrogen, phosphorus, potassium, ec, classification, recommendation }) => ({
  ph,
  temp: temperature,
  hum: moisture,
  n: nitrogen,
  p: phosphorus,
  k: potassium,
  ec,
  ai_label: classification,
  recommendation
});

// kolom database -> device, dipakai untuk semua respons
const toApi = (row) => ({
  timestamp: row.timestamp,
  ph: row.ph,
  temperature: row.temp,
  moisture: row.hum,
  nitrogen: row.n,
  phosphorus: row.p,
  potassium: row.k,
  ec: row.ec,
  classification: row.ai_label,
  recommendation: row.recommendation
});

const NUMERIC_FIELDS = ["ph", "temperature", "moisture", "nitrogen", "phosphorus", "potassium", "ec"];
const REQUIRED_FIELDS = ["timestamp", ...NUMERIC_FIELDS, "classification", "recommendation"];

// Batas wajar, bukan hasil kalibrasi. Sesuaikan setelah sensor dikalibrasi.
// Lihat DOCS/KEAMANAN.md bagian 5.4.
const RANGE = {
  ph: [0, 14],
  temperature: [-10, 60],
  moisture: [0, 100],
  nitrogen: [0, 1000],
  phosphorus: [0, 1000],
  potassium: [0, 1000],
  ec: [0, 20]
};
const TEXT_LIMITS = { classification: 32, recommendation: 300 };
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari
const MAX_FUTURE_MS = 10 * 60 * 1000; // 10 menit

// Perbandingan waktu tetap, supaya panjang/isi kunci tidak bocor lewat timing.
const safeEqual = (a, b) => {
  const A = Buffer.from(String(a ?? ""));
  const B = Buffer.from(String(b ?? ""));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
};

// --- auth perangkat -------------------------------------------------------
// Fail closed: kalau API_KEY tidak diset, semua request perangkat ditolak.
const authenticateApiKey = (req, res, next) => {
  if (!process.env.API_KEY) {
    console.error("API_KEY belum diset; request perangkat ditolak.");
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  if (!safeEqual(req.headers["x-api-key"], process.env.API_KEY)) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  next();
};

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "API Kesuburan Tanah berjalan" });
});

app.post("/api/soil", authenticateApiKey, async (req, res) => {
  const body = req.body || {};

  // V2: semua field wajib ada. Nilai 0 tetap sah, jadi jangan pakai cek falsy.
  const lengkap = REQUIRED_FIELDS.every((f) => body[f] !== undefined && body[f] !== null && body[f] !== "");
  if (!lengkap) {
    return res.status(400).json({ success: false, message: "Invalid or incomplete data" });
  }

  // V3: field numerik harus bertipe number dan finite. String angka ditolak.
  for (const field of NUMERIC_FIELDS) {
    if (typeof body[field] !== "number" || !Number.isFinite(body[field])) {
      return res.status(400).json({ success: false, message: `${field} must be a valid number` });
    }
  }

  // V4a: rentang nilai sensor.
  for (const [field, [min, max]] of Object.entries(RANGE)) {
    if (body[field] < min || body[field] > max) {
      return res.status(400).json({
        success: false,
        message: `${field} must be between ${min} and ${max}`
      });
    }
  }

  // V4b: classification dan recommendation harus teks dengan panjang wajar.
  for (const [field, max] of Object.entries(TEXT_LIMITS)) {
    if (typeof body[field] !== "string") {
      return res.status(400).json({ success: false, message: `${field} must be a valid text` });
    }
    if (body[field].length > max) {
      return res.status(400).json({
        success: false,
        message: `${field} must be at most ${max} characters`
      });
    }
  }

  // V4c: timestamp harus tanggal sah dan masuk akal.
  if (typeof body.timestamp !== "string" || Number.isNaN(Date.parse(body.timestamp))) {
    return res.status(400).json({ success: false, message: "timestamp bukan tanggal yang sah" });
  }

  const umur = Date.now() - Date.parse(body.timestamp);
  if (umur > MAX_AGE_MS || umur < -MAX_FUTURE_MS) {
    return res.status(400).json({ success: false, message: "timestamp di luar rentang wajar" });
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert([{ timestamp: body.timestamp, ...toDb(body) }])
    .select();

  if (error) {
    // Detail Supabase hanya ke log server, jangan ke klien.
    console.error("Supabase error:", error);
    return res.status(500).json({ success: false, message: "Failed to save data" });
  }

  res.status(201).json({ success: true, message: "Data saved successfully", data: data.map(toApi) });
});

// ponytail: Bearer JWT belum dipasang. Sisipkan authenticateUser di sini.
app.get("/api/soil", async (req, res) => {
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 200, 200));

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("timestamp", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Supabase error:", error);
    return res.status(500).json({ success: false, message: "Failed to retrieve data" });
  }

  res.json({ success: true, message: "Data retrieved successfully", data: data.map(toApi) });
});

// Body tidak bisa di-parse, terlalu besar, dan error tak terduga berakhir di sini.
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Body bukan JSON yang sah" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ success: false, message: "Body terlalu besar" });
  }

  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error("Server error:", err);
  res.status(status).json({
    success: false,
    message: status >= 500 ? "Internal server error" : "Invalid JSON body"
  });
});

// Vercel memakai module.exports dan NODE_ENV=production, jadi listen dilewati.
if (require.main === module && process.env.NODE_ENV !== "production") {
  const port = process.env.PORT || 3000;
  const keyPath = path.join(__dirname, "certs", "key.pem");
  const certPath = path.join(__dirname, "certs", "cert.pem");

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    https
      .createServer(
        {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath),
          minVersion: "TLSv1.2"
        },
        app
      )
      .listen(port, () => console.log(`HTTPS server running on https://localhost:${port}`));
  } else {
    // Jangan fallback diam-diam: beri tahu bahwa koneksi lokal tidak memakai TLS.
    console.warn("certs/key.pem atau certs/cert.pem tidak ditemukan. Server berjalan lewat HTTP (tanpa TLS).");
    console.warn("Jalankan `npm run certs` untuk membuat sertifikat lokal.");
    app.listen(port, () => console.log(`HTTP server running on http://localhost:${port}`));
  }
}

module.exports = app;
