import { runAutomatedScraping } from "./auto-scrape";
import { runEmailOutreach as runEmailOutreachFn } from "./cli-email-outreach";
import { generateReport } from "./export-report";
import {
  sendTelegramNotification,
  sendTelegramDocument,
} from "../services/telegram";
import prisma from "../config/db";

// â”€â”€â”€ MASTER ORCHESTRATOR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function runFullPipeline() {
  const startTime = Date.now();
  console.log("ðŸš€ ===== MASTER PIPELINE STARTED =====");

  await sendTelegramNotification(
    `ðŸš€ *Master Pipeline Started*\n` +
      `Time: ${new Date().toLocaleString("id-ID")}\n` +
      `Mode: FULL AUTO (Scrape â†’ Email â†’ Report)`,
  );

  try {
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // PHASE 1: AUTO SCRAPE (15 prospek per run)
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log("\nðŸ“ PHASE 1: AUTO SCRAPING");
    await sendTelegramNotification(`ðŸ“ *Phase 1/3: Auto Scraping...*`);

    await runAutomatedScraping(15);

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // PHASE 2: EMAIL OUTREACH (kirim ke yang punya email)
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log("\nðŸ“ PHASE 2: EMAIL OUTREACH");
    await sendTelegramNotification(`ðŸ“ *Phase 2/3: Email Outreach...*`);

    await runEmailOutreachFn();

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // PHASE 3: GENERATE REPORT & SEND VIA TELEGRAM
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    console.log("\nðŸ“ PHASE 3: GENERATE REPORT");
    await sendTelegramNotification(`ðŸ“ *Phase 3/3: Generating Report...*`);

    const reportResult = await generateReport();

    // Kirim file Excel via Telegram
    if (reportResult.files && reportResult.files.length > 0) {
      const xlsxFile = reportResult.files.find((f) => f.endsWith(".xlsx"));
      if (xlsxFile) {
        await sendTelegramDocument(
          xlsxFile,
          `ðŸ“Š Daily Report ${new Date().toLocaleDateString("id-ID")}`,
        );
      }
    }

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // SUMMARY
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const duration = Math.round((Date.now() - startTime) / 1000 / 60);

    const summary = `
âœ… *MASTER PIPELINE COMPLETE*
â±ï¸ Durasi: ${duration} menit
ðŸ“… ${new Date().toLocaleString("id-ID")}

ðŸ“Š Stats akan terlihat di file Excel yang dikirim.
    `.trim();

    console.log("\nâœ… ===== MASTER PIPELINE COMPLETE =====");
    console.log(summary);

    await sendTelegramNotification(summary);
  } catch (err: any) {
    console.error("âŒ Master pipeline error:", err);
    await sendTelegramNotification(
      `âŒ *Master Pipeline FAILED*\n${err.message}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

// â”€â”€â”€ SCHEDULER (Jalankan via cron atau Windows Task Scheduler) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Schedule yang direkomendasikan:
// - Auto Scrape: Setiap 2 jam (08:00, 10:00, 12:00, 14:00, 16:00, 18:00)
// - Email Outreach: Setiap hari jam 10:00 (setelah scrape pagi)
// - Full Pipeline: Setiap hari jam 09:00 (scrape + email + report)
// - Report Only: Setiap hari jam 20:00 (recap harian)

async function runScheduler() {
  console.log("â° Scheduler started. Press Ctrl+C to stop.");

  // TIDAK jalanin full pipeline langsung pas start (mencegah notif dobel pas boot)
  // Full pipeline hanya jalan via jadwal atau manual CLI

  const SCRAPE_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 jam
  let lastScrapeHour = -1;
  let lastEmailDate = "";
  let lastReportDate = "";

  setInterval(async () => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const dateStr = now.toDateString();

    // Scrape setiap 2 jam (08, 10, 12, 14, 16, 18) - HANYA 1 KALI per slot
    if (
      [8, 10, 12, 14, 16, 18].includes(hour) &&
      minute < 5 &&
      lastScrapeHour !== hour
    ) {
      lastScrapeHour = hour;
      console.log(`\n⏰ Scheduled scrape at ${hour}:${minute}`);
      await runAutomatedScraping(10);
    }

    // Email outreach harian jam 10 - HANYA 1 KALI per hari
    if (hour === 10 && minute < 5 && lastEmailDate !== dateStr) {
      lastEmailDate = dateStr;
      console.log(`\n⏰ Scheduled email outreach at ${hour}:${minute}`);
      await runEmailOutreachFn();
    }

    // Report harian jam 20 - HANYA 1 KALI per hari
    if (hour === 20 && minute < 5 && lastReportDate !== dateStr) {
      lastReportDate = dateStr;
      console.log(`\n⏰ Scheduled report at ${hour}:${minute}`);
      const reportResult = await generateReport();
      if (reportResult.files) {
        const xlsxFile = reportResult.files.find((f) => f.endsWith(".xlsx"));
        if (xlsxFile) await sendTelegramDocument(xlsxFile, `📊 Daily Recap`);
      }
    }
  }, 60 * 1000); // Check setiap menit
}

// ─── CLI ENTRY ───────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || "once";

  if (mode === "scheduler") {
    await runScheduler();
    // Keep process alive
    process.stdin.resume();
  } else {
    if (mode === "scrape") {
      await runAutomatedScraping(15);
    } else if (mode === "email") {
      await runEmailOutreachFn();
    } else if (mode === "report") {
      await generateReport();
    } else {
      // Default: full pipeline once
      await runFullPipeline();
    }
    process.exit(0);
  }
}

const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith("master-pipeline.ts") ||
    process.argv[1].endsWith("master-pipeline.js"));

if (isDirectRun) {
  main().catch(console.error);
}
