import { config } from "../config/env";
import prisma from "../config/db";
import {
  sendEmail,
  buildEmailTemplate,
  buildFollowUp1Template,
  buildFollowUp2Template,
  getCategoryFeature,
  sanitizeBusinessName,
  generateUnsubscribeLink,
} from "../services/resend";

// â”€â”€â”€ CONFIG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const DAILY_LIMIT = config.outreach.dailyLimit;
const DELAY_MS = config.outreach.delayMs;

export async function runEmailOutreachInternal() {
  console.log("ðŸš€ Starting EMAIL OUTREACH job...");
  console.log(`Daily limit: ${DAILY_LIMIT} emails`);

  // 1. Ambil prospek yang status PENDING dan PUNYA EMAIL (dari scraping)
  const prospects = await prisma.prospect.findMany({
    where: {
      status: "PENDING",
      email: { not: null }, // HARUS punya email dari hasil scraping
    },
    orderBy: { scrapedAt: "desc" },
    take: DAILY_LIMIT,
  });

  if (prospects.length === 0) {
    console.log("âœ… Tidak ada prospek PENDING dengan email untuk dikirim.");
    return;
  }

  console.log(
    `ðŸ“‹ Ditemukan ${prospects.length} prospek dengan email untuk outreach.`,
  );

  // Stats by email source
  const sourceStats = prospects.reduce(
    (acc, p) => {
      acc[p.emailSource || "unknown"] =
        (acc[p.emailSource || "unknown"] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  console.log(`ðŸ“Š Email sources:`, sourceStats);

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < prospects.length; i++) {
    const prospect = prospects[i];
    try {
      const cleanName = sanitizeBusinessName(prospect.businessName);
      const feature = getCategoryFeature(prospect.category);
      const unsubscribeUrl = generateUnsubscribeLink(prospect.whatsappNumber); // pakai nomor sebagai ID unik

      const { subject, html, text, fromName } = buildEmailTemplate(
        cleanName,
        prospect.category,
        feature,
        unsubscribeUrl,
      );

      // Gunakan email yang sudah di-scrape (bukan Hunter.io)
      const emailTo = prospect.email!;

      // Sanitize tags for Resend (ASCII only, no spaces/special chars)
      const sanitizeTag = (val: string) =>
        val
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, "_")
          .substring(0, 64);
      const catTag = sanitizeTag(prospect.category || "unknown");
      const cityTag = sanitizeTag(prospect.city || "unknown");
      const srcTag = sanitizeTag(prospect.emailSource || "unknown");

      const result = await sendEmail({
        to: emailTo,
        subject,
        html,
        text,
        fromName,
        tags: [
          { name: "category", value: catTag },
          { name: "city", value: cityTag },
          { name: "source", value: "cold_email" },
          { name: "email_src", value: srcTag },
        ],
      });

      if (result.success) {
        sent++;
        // Update prospect status
        await prisma.prospect.update({
          where: { id: prospect.id },
          data: {
            status: "CONTACTED",
            lastContactedAt: new Date(),
            notes: `Email sent: ${result.id} (src: ${prospect.emailSource})`,
          },
        });
        console.log(
          `âœ… [${sent}/${prospects.length}] Email sent to ${prospect.businessName} (${emailTo}) [src: ${prospect.emailSource}]`,
        );
      } else {
        failed++;
        console.error(
          `âŒ Failed to send to ${prospect.businessName} (${emailTo}): ${result.error}`,
        );
      }

      // Delay antar kirim (randomized untuk anti-detection)
      if (i < prospects.length - 1) {
        const delay = Math.random() * 3000 + DELAY_MS; // 5-8 detik random
        console.log(`â³ Waiting ${Math.round(delay / 1000)}s...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    } catch (err: any) {
      failed++;
      console.error(
        `âŒ Error processing ${prospect.businessName}:`,
        err.message,
      );
    }
  }

  console.log("\nðŸ“Š EMAIL OUTREACH SUMMARY");
  console.log(`âœ… Sent: ${sent}`);
  console.log(`âŒ Failed: ${failed}`);
  console.log(`ðŸ“‹ Total processed: ${prospects.length}`);
}

// Follow-up scheduler
async function scheduleFollowUps() {
  console.log("🔄 Checking follow-up emails...");

  const now = new Date();
  const day3ago = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const day7ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Day 3: CONTACTED, belum follow-up, sudah 3 hari
  const followUp1List = await prisma.prospect.findMany({
    where: {
      status: "CONTACTED",
      email: { not: null },
      lastContactedAt: { lte: day3ago },
      notes: { not: { contains: "followup1" } },
    },
    take: 20,
  });

  // Day 7: CONTACTED, sudah follow-up 1, sudah 7 hari total
  const followUp2List = await prisma.prospect.findMany({
    where: {
      status: "CONTACTED",
      email: { not: null },
      lastContactedAt: { lte: day7ago },
      notes: { contains: "followup1" },
      NOT: { notes: { contains: "followup2" } },
    },
    take: 20,
  });

  console.log(`📋 Follow-up Day 3: ${followUp1List.length} prospek`);
  console.log(`📋 Follow-up Day 7: ${followUp2List.length} prospek`);

  // Kirim Day 3
  for (const prospect of followUp1List) {
    try {
      const cleanName = sanitizeBusinessName(prospect.businessName);
      const feature = getCategoryFeature(prospect.category);
      const unsubscribeUrl = generateUnsubscribeLink(prospect.whatsappNumber);
      const { subject, html, text, fromName } = buildFollowUp1Template(
        cleanName,
        prospect.category,
        feature,
        unsubscribeUrl,
      );

      const result = await sendEmail({
        to: prospect.email!,
        subject,
        html,
        text,
        fromName,
      });
      if (result.success) {
        await prisma.prospect.update({
          where: { id: prospect.id },
          data: {
            lastContactedAt: new Date(),
            notes: `${prospect.notes || ""} | followup1: ${result.id}`,
          },
        });
        console.log(`✅ Follow-up 1 sent → ${prospect.businessName}`);
      }
      await new Promise((r) => setTimeout(r, 5000 + Math.random() * 3000));
    } catch (err: any) {
      console.error(
        `❌ Follow-up 1 error ${prospect.businessName}:`,
        err.message,
      );
    }
  }

  // Kirim Day 7
  for (const prospect of followUp2List) {
    try {
      const cleanName = sanitizeBusinessName(prospect.businessName);
      const feature = getCategoryFeature(prospect.category);
      const unsubscribeUrl = generateUnsubscribeLink(prospect.whatsappNumber);
      const { subject, html, text, fromName } = buildFollowUp2Template(
        cleanName,
        prospect.category,
        feature,
        unsubscribeUrl,
      );

      const result = await sendEmail({
        to: prospect.email!,
        subject,
        html,
        text,
        fromName,
      });
      if (result.success) {
        await prisma.prospect.update({
          where: { id: prospect.id },
          data: {
            status: "CLOSED",
            lastContactedAt: new Date(),
            notes: `${prospect.notes || ""} | followup2: ${result.id}`,
          },
        });
        console.log(`✅ Follow-up 2 (last) sent → ${prospect.businessName}`);
      }
      await new Promise((r) => setTimeout(r, 5000 + Math.random() * 3000));
    } catch (err: any) {
      console.error(
        `❌ Follow-up 2 error ${prospect.businessName}:`,
        err.message,
      );
    }
  }
}

// Run
export async function runEmailOutreach() {
  await runEmailOutreachInternal();
  await scheduleFollowUps();
  await prisma.$disconnect();
}

const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith("cli-email-outreach.ts") ||
    process.argv[1].endsWith("cli-email-outreach.js"));

if (isDirectRun) {
  runEmailOutreach()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
