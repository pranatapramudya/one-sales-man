import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { runAutomatedScraping } from './auto-scrape';
import { runEmailOutreach as runEmailOutreachFn } from './cli-email-outreach';
import { generateReport } from './export-report';
import { sendTelegramNotification, sendTelegramDocument } from '../lib/telegram';
import prisma from '../lib/prisma';

// ─── MASTER ORCHESTRATOR ─────────────────────────────────────────────────────
export async function runFullPipeline() {
  const startTime = Date.now();
  console.log('🚀 ===== MASTER PIPELINE STARTED =====');
  
  await sendTelegramNotification(
    `🚀 *Master Pipeline Started*\n` +
    `Time: ${new Date().toLocaleString('id-ID')}\n` +
    `Mode: FULL AUTO (Scrape → Email → Report)`
  );

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 1: AUTO SCRAPE (15 prospek per run)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n📍 PHASE 1: AUTO SCRAPING');
    await sendTelegramNotification(`📍 *Phase 1/3: Auto Scraping...*`);
    
    await runAutomatedScraping(15);
    
    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 2: EMAIL OUTREACH (kirim ke yang punya email)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n📍 PHASE 2: EMAIL OUTREACH');
    await sendTelegramNotification(`📍 *Phase 2/3: Email Outreach...*`);
    
    await runEmailOutreachFn();
    
    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 3: GENERATE REPORT & SEND VIA TELEGRAM
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n📍 PHASE 3: GENERATE REPORT');
    await sendTelegramNotification(`📍 *Phase 3/3: Generating Report...*`);
    
    const reportResult = await generateReport();
    
    // Kirim file Excel via Telegram
    if (reportResult.files && reportResult.files.length > 0) {
      const xlsxFile = reportResult.files.find(f => f.endsWith('.xlsx'));
      if (xlsxFile) {
        await sendTelegramDocument(xlsxFile, `📊 Daily Report ${new Date().toLocaleDateString('id-ID')}`);
      }
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // SUMMARY
    // ─────────────────────────────────────────────────────────────────────────
    const duration = Math.round((Date.now() - startTime) / 1000 / 60);
    
    const summary = `
✅ *MASTER PIPELINE COMPLETE*
⏱️ Durasi: ${duration} menit
📅 ${new Date().toLocaleString('id-ID')}

📊 Stats akan terlihat di file Excel yang dikirim.
    `.trim();
    
    console.log('\n✅ ===== MASTER PIPELINE COMPLETE =====');
    console.log(summary);
    
    await sendTelegramNotification(summary);
    
  } catch (err: any) {
    console.error('❌ Master pipeline error:', err);
    await sendTelegramNotification(`❌ *Master Pipeline FAILED*\n${err.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

// ─── SCHEDULER (Jalankan via cron atau Windows Task Scheduler) ───────────────
// Schedule yang direkomendasikan:
// - Auto Scrape: Setiap 2 jam (08:00, 10:00, 12:00, 14:00, 16:00, 18:00)
// - Email Outreach: Setiap hari jam 10:00 (setelah scrape pagi)
// - Full Pipeline: Setiap hari jam 09:00 (scrape + email + report)
// - Report Only: Setiap hari jam 20:00 (recap harian)

async function runScheduler() {
  console.log('⏰ Scheduler started. Press Ctrl+C to stop.');
  
  // TIDAK jalanin full pipeline langsung pas start (mencegah notif dobel pas boot)
  // Full pipeline hanya jalan via jadwal atau manual CLI
  
  const SCRAPE_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 jam
  const DAILY_EMAIL_HOUR = 10; // jam 10 pagi
  const DAILY_REPORT_HOUR = 20; // jam 8 malam
  
  setInterval(async () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();

      // Scrape setiap 2 jam (08, 10, 12, 14, 16, 18) - HANYA MENIT KE-0 s.d 4
      if ([8, 10, 12, 14, 16, 18].includes(hour) && minute < 5) {
        console.log(`\n⏰ Scheduled scrape at ${now.toLocaleTimeString('id-ID')}`);
        await runAutomatedScraping(10);
      }

      // Email outreach harian jam 10
      if (hour === DAILY_EMAIL_HOUR && minute < 5) {
        console.log(`\n⏰ Scheduled email outreach at ${now.toLocaleTimeString('id-ID')}`);
        await runEmailOutreachFn();
      }

      // Report harian jam 20
      if (hour === DAILY_REPORT_HOUR && minute < 5) {
        console.log(`\n⏰ Scheduled report at ${now.toLocaleTimeString('id-ID')}`);
        const reportResult = await generateReport();
        if (reportResult.files) {
          const xlsxFile = reportResult.files.find(f => f.endsWith('.xlsx'));
          if (xlsxFile) await sendTelegramDocument(xlsxFile, `📊 Daily Recap ${now.toLocaleDateString('id-ID')}`);
        }
      }
    }, 60 * 1000); // Check setiap menit
}

// ─── CLI ENTRY ───────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'once';
  
  if (mode === 'scheduler') {
    await runScheduler();
    // Keep process alive
    process.stdin.resume();
  } else if (mode === 'scrape') {
    await runAutomatedScraping(15);
  } else if (mode === 'email') {
    await runEmailOutreachFn();
  } else if (mode === 'report') {
    await generateReport();
  } else {
    // Default: full pipeline once
    await runFullPipeline();
  }
  
  process.exit(0);
}

main().catch(console.error);