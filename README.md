# One Salesman Bot 🤖💼

**One Salesman** adalah sebuah sistem Bot B2B Outreach Otomatis (Auto-Pilot) yang dirancang untuk mempermudah akuisisi klien UMKM lokal. Sistem ini mengombinasikan tiga fitur utama: **Scraper Google Maps**, **WhatsApp Blaster**, dan **AI Negotiator (berbasis Groq)** untuk mencari, mengontak, dan melakukan negosiasi awal dengan calon klien secara mandiri.

---

## 📋 Prerequisites

Pastikan sistem Anda telah memenuhi persyaratan berikut sebelum menjalankan proyek ini:
- **Node.js** v24 atau yang lebih baru.
- **PostgreSQL** (Direkomendasikan menggunakan [Neon Serverless Postgres](https://neon.tech/)).
- Browser **Google Chrome** / **Chromium** (untuk Playwright dan Puppeteer).

---

## 🛠 Instalasi

Kloning repositori ini, lalu install semua dependensi menggunakan `npm`:

```bash
npm install
```

---

## ⚙️ Setup Environment

1. Salin file template environment bawaan:
   ```bash
   cp .env.example .env
   ```
2. Buka file `.env` dan lengkapi variabel berikut:
   - `DATABASE_URL`: Connection string utama untuk Prisma Adapter (Neon).
   - `DIRECT_URL`: Connection string untuk perintah CLI Prisma (seperti `db push` atau `migrate`).
   - `GROQ_API_KEY` / `LLM_API_KEY`: Kunci API untuk mengaktifkan AI Negotiator dari Groq.

---

## 🚀 Cara Menjalankan Utama

Sistem ini didesain agar mudah dijalankan dalam satu perintah utama. Konfigurasi `dotenv` sudah disuntikkan secara otomatis di dalam kode.

Jalankan perintah berikut di terminal Anda:

```bash
npx tsx src/pipeline/runner.ts
```

> **Catatan:** Pada saat pertama kali dijalankan, sistem akan meminta Anda untuk memindai **QR Code** WhatsApp melalui terminal.

---

## 🔄 Alur Kerja (Workflow)

Berikut adalah bagaimana robot "One Salesman" bekerja dari awal hingga akhir:

1. **Scraping Target (Google Maps):** 
   Playwright akan membuka browser, mencari target spesifik (misal: "Klinik di Sumedang"), dan mengekstrak nama bisnis beserta nomor telepon.
2. **Penyimpanan Data:** 
   Data yang tersanitasi akan masuk ke dalam database via Prisma dengan status awal `PENDING`.
3. **Outreach & Blaster:** 
   Bot WhatsApp akan mengirimkan pesan sapaan awal yang sopan (Anti-Gatekeeper) kepada prospek `PENDING` dengan waktu tunda (delay) acak agar tidak terkena ban. Status prospek lalu berubah menjadi `CONTACTED`.
4. **AI Negotiator Beraksi:** 
   Jika prospek merespons, **Groq AI (Llama 3)** akan bertindak sebagai Sales Representative dari PJTECH untuk melakukan diagnosa masalah, menjawab pertanyaan, dan menawarkan solusi spesifik (SaaS Kasir UMKM atau Jasa Pembuatan Custom Apps/Website sesuai kebutuhan klien).
5. **Human Handoff:** 
   Ketika AI mendeteksi intensi ketertarikan kuat dari klien (misal minta meeting, harga detail, atau setuju), AI akan menyerahkan percakapan kepada tenaga manusia (Technical Lead) dan mengubah status prospek menjadi `HOT_LEAD`.