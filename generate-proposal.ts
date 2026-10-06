/**
 * Usage:
 * npx tsx generate-proposal.ts "Klinik Gigi Amanah" "dr. Ahmad" "Bandung" "PJTech Clinic" "Rp 2.990.000 / tahun"
 *
 * Args:
 *   1. Nama Usaha
 *   2. Nama PIC / Penanggung Jawab
 *   3. Kota / Alamat
 *   4. Nama Paket  (PJTech Clinic | PJTech Fitness | PJTech UMKM)
 *   5. Harga       (Rp 2.990.000 / tahun)
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const [, , namaUsaha, namaPIC, alamat, namaPaket, harga] = process.argv;

if (!namaUsaha || !namaPIC || !alamat || !namaPaket || !harga) {
  console.error(`
❌ Argumen kurang!

Contoh:
  npx tsx generate-proposal.ts "Klinik Gigi Amanah" "dr. Ahmad" "Bandung" "PJTech Clinic" "Rp 2.990.000 / tahun"
  npx tsx generate-proposal.ts "Purnama Gym" "Pak Doni" "Sumedang" "PJTech Fitness" "Rp 1.990.000 / tahun"
  npx tsx generate-proposal.ts "Toko Berkah Jaya" "Bu Sari" "Cirebon" "PJTech UMKM" "Rp 990.000 / tahun"
`);
  process.exit(1);
}

const today = new Date();
const HARI_LIST = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];
const BULAN_LIST = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];
const tanggalStr = `${HARI_LIST[today.getDay()]}, ${today.getDate()} ${BULAN_LIST[today.getMonth()]} ${today.getFullYear()}`;
const tahun = today.getFullYear().toString();

// No SPK otomatis dari timestamp
const noSPK = `${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}${today.getHours()}${today.getMinutes()}`;

// No Invoice
const noInvoice = `INV-PJT-${tahun}-${noSPK}`;

// Jatuh tempo 7 hari dari sekarang
const jatuhTempo = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
const jatuhTempoStr = `${jatuhTempo.getDate()} ${BULAN_LIST[jatuhTempo.getMonth()]} ${jatuhTempo.getFullYear()}`;

// Periode langganan: mulai hari ini, selesai 1 tahun
const tglSelesai = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000);
const tglMulaiStr = `${today.getDate()} ${BULAN_LIST[today.getMonth()]} ${today.getFullYear()}`;
const tglSelesaiStr = `${tglSelesai.getDate()} ${BULAN_LIST[tglSelesai.getMonth()]} ${tglSelesai.getFullYear()}`;

// Output dir
const outDir = path.join(
  process.env.USERPROFILE || "C:/Users/Pranata Pramudya",
  "Documents",
  "PJTech-Dokumen",
);
fs.mkdirSync(outDir, { recursive: true });

const safeName = namaUsaha.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
const proposalOut = path.join(outDir, `Proposal_${safeName}.docx`);
const spkOut = path.join(outDir, `SPK_${safeName}.docx`);
const invoiceOut = path.join(outDir, `Invoice_${safeName}.docx`);

// Template paths
const templateDir = path.join(__dirname, "templates");
const proposalTpl = path.join(templateDir, "proposal_template.docx");
const spkTpl = path.join(templateDir, "spk_template.docx");
const invoiceTpl = path.join(templateDir, "invoice_template.docx");

const PYTHON =
  "C:/Users/Pranata Pramudya/AppData/Local/hermes/hermes-agent/venv/Scripts/python.exe";
const DOCX_TEMPLATE =
  "C:/Users/Pranata Pramudya/AppData/Local/hermes/skills/productivity/docx/scripts/docx_template.py";

// Values untuk fill template
const proposalValues = {
  NAMA_KLIEN: namaUsaha,
  ALAMAT_KLIEN: `${namaPIC} — ${alamat}`,
};

const spkValues = {
  NO_SPK: noSPK,
  TAHUN: tahun,
  HARI: tanggalStr,
  TANGGAL: tanggalStr,
  NAMA_PIC: namaPIC,
  NAMA_USAHA: namaUsaha,
  ALAMAT_USAHA: alamat,
  KONTAK_KLIEN: "(isi nomor HP/email klien)",
  NAMA_PAKET: namaPaket,
  HARGA: harga,
  JABATAN_PIC: "Pemilik / Penanggung Jawab",
};

const invoiceValues = {
  NO_INVOICE: noInvoice,
  TANGGAL_INVOICE: tanggalStr,
  JATUH_TEMPO: jatuhTempoStr,
  NAMA_USAHA: namaUsaha,
  NAMA_PIC: namaPIC,
  ALAMAT_USAHA: alamat,
  KONTAK_KLIEN: "(isi nomor HP/email klien)",
  NAMA_PAKET: namaPaket,
  HARGA: harga,
  TGL_MULAI: tglMulaiStr,
  TGL_SELESAI: tglSelesaiStr,
};

function fillTemplate(
  tplPath: string,
  values: Record<string, string>,
  outPath: string,
  label: string,
) {
  const valuesPath = path.join(outDir, `_values_${label}.json`);
  fs.writeFileSync(valuesPath, JSON.stringify(values, null, 2), "utf-8");
  try {
    execSync(
      `"${PYTHON}" "${DOCX_TEMPLATE}" "${tplPath}" "${valuesPath}" "${outPath}"`,
      { stdio: "pipe" },
    );
    fs.unlinkSync(valuesPath);
    console.log(`✅ ${label}: ${outPath}`);
  } catch (err: any) {
    console.error(
      `❌ Gagal generate ${label}:`,
      err.stderr?.toString() || err.message,
    );
    fs.unlinkSync(valuesPath);
  }
}

console.log(`\n📄 Generating dokumen untuk: ${namaUsaha} (${namaPaket})\n`);

fillTemplate(proposalTpl, proposalValues, proposalOut, "Proposal");
fillTemplate(spkTpl, spkValues, spkOut, "SPK");
fillTemplate(invoiceTpl, invoiceValues, invoiceOut, "Invoice");

console.log(`\n📁 Semua dokumen tersimpan di: ${outDir}`);
console.log(`\n🚀 Siap dikirim via WA ke klien!\n`);
