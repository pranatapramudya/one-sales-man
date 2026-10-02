import path from 'path';
import dotenv from 'dotenv';

// Load .env from one-sales-man root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import prisma from '../lib/prisma';
import { 
  sendEmail, 
  buildEmailTemplate, 
  getCategoryFeature, 
  sanitizeBusinessName,
  generateUnsubscribeLink 
} from '../email/resend-client';

// â”€â”€â”€ CONFIG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const DAILY_LIMIT = parseInt(process.env.EMAIL_DAILY_LIMIT || '50');
const DELAY_MS = parseInt(process.env.EMAIL_DELAY_MS || '5000'); // 5 detik antar kirim

export async function runEmailOutreachInternal() {
  console.log('ðŸš€ Starting EMAIL OUTREACH job...');
  console.log(`Daily limit: ${DAILY_LIMIT} emails`);
  
  // 1. Ambil prospek yang status PENDING dan PUNYA EMAIL (dari scraping)
  const prospects = await prisma.prospect.findMany({
    where: { 
      status: 'PENDING',
      email: { not: null }, // HARUS punya email dari hasil scraping
    },
    orderBy: { scrapedAt: 'desc' },
    take: DAILY_LIMIT,
  });

  if (prospects.length === 0) {
    console.log('âœ… Tidak ada prospek PENDING dengan email untuk dikirim.');
    return;
  }

  console.log(`ðŸ“‹ Ditemukan ${prospects.length} prospek dengan email untuk outreach.`);
  
  // Stats by email source
  const sourceStats = prospects.reduce((acc, p) => {
    acc[p.emailSource || 'unknown'] = (acc[p.emailSource || 'unknown'] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log(`ðŸ“Š Email sources:`, sourceStats);

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < prospects.length; i++) {
    const prospect = prospects[i];
    try {
      const cleanName = sanitizeBusinessName(prospect.businessName);
      const feature = getCategoryFeature(prospect.category);
      const unsubscribeUrl = generateUnsubscribeLink(prospect.whatsappNumber); // pakai nomor sebagai ID unik
      
      const { subject, html, text } = buildEmailTemplate(
        cleanName,
        prospect.category,
        feature,
        unsubscribeUrl
      );

      // Gunakan email yang sudah di-scrape (bukan Hunter.io)
      const emailTo = prospect.email!;

      // Sanitize tags for Resend (ASCII only, no spaces/special chars)
      const sanitizeTag = (val: string) => val.toLowerCase().replace(/[^a-z0-9_-]/g, '_').substring(0, 64);
      const catTag = sanitizeTag(prospect.category || 'unknown');
      const cityTag = sanitizeTag(prospect.city || 'unknown');
      const srcTag = sanitizeTag(prospect.emailSource || 'unknown');

      const result = await sendEmail({
        to: emailTo,
        subject,
        html,
        text,
        tags: [
          { name: 'category', value: catTag },
          { name: 'city', value: cityTag },
          { name: 'source', value: 'cold_email' },
          { name: 'email_src', value: srcTag },
        ],
      });

      if (result.success) {
        sent++;
        // Update prospect status
        await prisma.prospect.update({
          where: { id: prospect.id },
          data: { 
            status: 'CONTACTED',
            lastContactedAt: new Date(),
            notes: `Email sent: ${result.id} (src: ${prospect.emailSource})`,
          },
        });
        console.log(`âœ… [${sent}/${prospects.length}] Email sent to ${prospect.businessName} (${emailTo}) [src: ${prospect.emailSource}]`);
      } else {
        failed++;
        console.error(`âŒ Failed to send to ${prospect.businessName} (${emailTo}): ${result.error}`);
      }

      // Delay antar kirim (randomized untuk anti-detection)
      if (i < prospects.length - 1) {
        const delay = Math.random() * 3000 + DELAY_MS; // 5-8 detik random
        console.log(`â³ Waiting ${Math.round(delay/1000)}s...`);
        await new Promise(r => setTimeout(r, delay));
      }

    } catch (err: any) {
      failed++;
      console.error(`âŒ Error processing ${prospect.businessName}:`, err.message);
    }
  }

  console.log('\nðŸ“Š EMAIL OUTREACH SUMMARY');
  console.log(`âœ… Sent: ${sent}`);
  console.log(`âŒ Failed: ${failed}`);
  console.log(`ðŸ“‹ Total processed: ${prospects.length}`);
}

// Follow-up scheduler (untuk nanti bisa dijalankan via cron)
async function scheduleFollowUps() {
  console.log('ðŸ”„ Checking for follow-up emails...');
  
  // Cari prospek CONTACTED > 3 hari tanpa balasan -> kirim follow-up 1
  // Cari prospek CONTACTED > 7 hari tanpa balasan -> kirim follow-up 2
  // Cari prospek CONTACTED > 14 hari tanpa balasan -> kirim follow-up 3 (last)
  
  // Placeholder untuk implementasi follow-up
  console.log('Follow-up scheduler not yet implemented. Run manually or add cron.');
}

// Run
export async function runEmailOutreach() {
  await runEmailOutreachInternal();
  await scheduleFollowUps();
  await prisma.$disconnect();
}

const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('cli-email-outreach.ts') ||
  process.argv[1].endsWith('cli-email-outreach.js')
);

if (isDirectRun) {
  runEmailOutreach()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
