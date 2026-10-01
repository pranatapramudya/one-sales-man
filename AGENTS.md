# one-sales-man — AI Agent Context

## Apa ini?
Sales automation CLI untuk PJTech. Scrape Google Maps → Extract email dari website → Kirim cold email via Resend API. Dijalankan sebagai **subprocess** oleh `pjtech-autonomous/video-engine/src/sales-orchestrator.ts`.

## Arsitektur

```
src/
  scraper/
    gmaps.ts          ← Google Maps scraper (Playwright)
    email-extractor.ts ← Extract email dari website bisnis
  pipeline/
    auto-scrape.ts     ← Batch scraping dengan state persistence
    cli-email-outreach.ts  ← Cold email outreach (Resend API)
    cli-email-followup.ts  ← Follow-up email hari ke-3 & ke-7
    master-pipeline.ts ← Scheduler scraping internal (tidak dipakai langsung)
  email/
    resend-client.ts   ← Resend API client + template builder
  lib/
    prisma.ts          ← Prisma client (Neon PostgreSQL)
```

## Database Schema (Neon PostgreSQL)
Model utama: `Prospect`
- `status`: `PENDING` → `CONTACTED` → `FOLLOW_UP_1` → `FOLLOW_UP_2` → `DONE`
- `email`: hasil scraping dari website bisnis (null jika tidak ditemukan)
- `emailSource`: `website` | `facebook`
- `lastContactedAt`: timestamp email terakhir dikirim

## Changelog / Perbaikan Terakhir
- **2026-10-01**: 
  - Fix crash pada `master-pipeline.ts` scheduler yang menyebabkan notifikasi Telegram tidak muncul dan eksekusi email berhenti diam-diam (Reference Error missing `DAILY_EMAIL_HOUR`). Jam pengiriman telah di-hardcode ke `10` pagi dan `20` malam.
  - Fix pengiriman dobel: error yang membunuh proses di tengah jalan mengakibatkan email gagal ter-flag `CONTACTED`. Sudah diperbaiki.

## Flow Email
1. Scrape → prospek masuk DB dengan `status=PENDING`
2. `cli-email-outreach.ts` → ambil PENDING yang punya email → kirim → update `CONTACTED`
3. `cli-email-followup.ts` → ambil CONTACTED >3 hari → kirim FU1 → ambil CONTACTED >7 hari → kirim FU2 → update `DONE`

## Output Format Subprocess (PENTING untuk parser di sales-orchestrator.ts)
```
# Progress per email:
✅ [N/Total] Email sent to BusinessName (email@domain.com) [src: website]
⏳ Waiting Ns...

# SUMMARY block (yang diparse parent process):
📊 EMAIL OUTREACH SUMMARY
✅ Sent: 50
❌ Failed: 0
📋 Total processed: 50
```

## Config .env
- `RESEND_API_KEY` — API key Resend
- `EMAIL_DAILY_LIMIT` — default 50
- `EMAIL_DELAY_MS` — jeda antar kirim, default 5000ms (random +3s)
- `DATABASE_URL` — Neon PostgreSQL connection string
- `PLAYWRIGHT_BROWSERS_PATH` — path Chromium untuk scraping

## Rules Penting untuk Agent
1. **Anti-duplikat built-in** — query `WHERE status='PENDING'` mencegah email ganda ke prospek yang sama
2. **Rate limit Resend** — 3000 email/bulan (gratis). Jangan ubah `DAILY_LIMIT` >50 tanpa hitung sisa kuota
3. **Playwright scraper** — harus ada Chromium ter-install. Cek: `npx playwright install chromium`
4. **`--batch=N`** — `cli-email-outreach.ts` menerima arg `--batch=50` dari command line
5. **Subprocess spawn** — dijalankan via `spawn('npx', ['tsx', 'src/pipeline/cli-email-outreach.ts'])` dari `sales-orchestrator.ts`. Jangan jalankan direct kecuali untuk testing
6. **Neon cold start** — DB Neon bisa idle suspend. Pre-warm via `getSalesStats()` sebelum batch besar

## Cara Jalankan (Testing Manual)
```bash
# Test email outreach manual
npx tsx src/pipeline/cli-email-outreach.ts

# Test follow-up
npx tsx src/pipeline/cli-email-followup.ts

# Test scraping
npx tsx src/pipeline/auto-scrape.ts

# Prisma studio (lihat DB)
npx prisma studio

# Sync schema ke Neon
npx prisma db push
```
