const fs = require("fs");
const path = require("path");
const selfsigned = require("selfsigned");

(async () => {
  const dir = path.join(__dirname, "..", "certs");
  const notBefore = new Date();
  const notAfter = new Date(notBefore);
  notAfter.setFullYear(notAfter.getFullYear() + 1);

  const pems = await selfsigned.generate(
    [{ name: "commonName", value: "localhost" }],
    {
      keySize: 2048,
      algorithm: "sha256",
      notBeforeDate: notBefore,
      notAfterDate: notAfter,
      extensions: [
        { name: "basicConstraints", cA: false },
        { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
        { name: "extKeyUsage", serverAuth: true },
        {
          name: "subjectAltName",
          altNames: [
            { type: 2, value: "localhost" },
            { type: 7, ip: "127.0.0.1" },
            { type: 7, ip: "::1" }
          ]
        }
      ]
    }
  );

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "key.pem"), pems.private);
  fs.writeFileSync(path.join(dir, "cert.pem"), pems.cert);

  console.log("Sertifikat lokal dibuat:");
  console.log("  certs/key.pem");
  console.log("  certs/cert.pem");
  console.log(`Berlaku sampai ${notAfter.toISOString()}`);
})().catch((error) => {
  console.error("Gagal membuat sertifikat:", error.message);
  process.exit(1);
});
