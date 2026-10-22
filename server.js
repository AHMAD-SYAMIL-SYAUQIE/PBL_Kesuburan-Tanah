const express = require("express");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();
app.use(express.json());
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

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Soil Cloud API is running" });
});

// ponytail: x-api-key belum dipasang (keamanan di luar lingkup minggu ini).
// Sisipkan authenticateApiKey di sini saat bagian keamanan dikerjakan.
app.post("/api/soil", async (req, res) => {
  const body = req.body || {};

  const lengkap = REQUIRED_FIELDS.every((f) => body[f] !== undefined && body[f] !== null && body[f] !== "");
  if (!lengkap) {
    return res.status(400).json({ success: false, message: "Invalid or incomplete data" });
  }

  for (const field of NUMERIC_FIELDS) {
    if (typeof body[field] !== "number" || !Number.isFinite(body[field])) {
      return res.status(400).json({ success: false, message: `${field} must be a valid number` });
    }
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert([{ timestamp: body.timestamp, ...toDb(body) }])
    .select();

  if (error) {
    console.error("Supabase error:", error);
    return res.status(500).json({ success: false, message: "Failed to save data", error: error.message });
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
    return res.status(500).json({ success: false, message: "Failed to retrieve data", error: error.message });
  }

  res.json({ success: true, message: "Data retrieved successfully", data: data.map(toApi) });
});

// Body tidak bisa di-parse dan error tak terduga sama-sama berakhir di sini.
app.use((err, req, res, next) => {
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
  const options = {
    key: path.join(__dirname, "certs", "key.pem"),
    cert: path.join(__dirname, "certs", "cert.pem")
  };

  try {
    https
      .createServer({ key: fs.readFileSync(options.key), cert: fs.readFileSync(options.cert) }, app)
      .listen(port, () => console.log(`HTTPS server running on https://localhost:${port}`));
  } catch (error) {
    app.listen(port, () => console.log(`HTTP server running on http://localhost:${port} (certs/ tidak ada)`));
  }
}

module.exports = app;
