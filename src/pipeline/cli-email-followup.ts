import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import prisma from '../lib/prisma';
import { 
  sendEmail, 
  buildFollowUp1Template, 
  buildFollowUp2Template,
  sanitizeBusinessName,
  getCategoryFeature,
  generateUnsubscribeLink 
} from '../email/resend-client';
import { sendTelegramNotification } from '../lib/telegram';

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const FOLLOWUP1_DELAY_DAYS = 3;  // Follow-up 1 after 3 days
const FOLLOWUP2_DELAY_DAYS = 7;  // Follow-up 2 after 7 days

async function runFollowUpOutreach() {
  console.log('🚀 Starting EMAIL FOLLOW-UP job...');
  
  const now = new Date();
  const followUp1Cutoff = new Date(now.getTime() - FOLLOWUP1_DELAY_DAYS * 24 * 60 * 60 * 1000);
  const followUp2Cutoff = new Date(now.getTime() - FOLLOWUP2_DELAY_DAYS * 24 * 60 * 60 * 1000);
  
  let sent = 0;
  let failed = 0;
  
  // ─── FOLLOW-UP 1: Status CONTACTED, followUpStage=0, lastEmailSentAt >= 3 days ago ───
  const followUp1Prospects = await prisma.prospect.findMany({
    where: {
      status: 'CONTACTED',
      followUpStage: 0,
      lastEmailSentAt: { lte: followUp1Cutoff },
      email: { not: null },
    },
    orderBy: { lastEmailSentAt: 'asc' },
    take: 50,
  });
  
  console.log(`📋 Follow-up #1: ${followUp1Prospects.length} prospects`);
  
  for (const prospect of followUp1Prospects) {
    try {
      const cleanName = sanitizeBusinessName(prospect.businessName);
      const feature = getCategoryFeature(prospect.category);
      const unsubscribeUrl = generateUnsubscribeLink(prospect.whatsappNumber);
      
      const { subject, html, text } = buildFollowUp1Template(cleanName, prospect.category, feature, unsubscribeUrl);
      
      // Sanitize tags for Resend (ASCII only, no spaces/special chars)
      const sanitizeTag = (val: string) => val.toLowerCase().replace(/[^a-z0-9_-]/g, '_').substring(0, 64);
      const catTag = sanitizeTag(prospect.category || 'unknown');
      const cityTag = sanitizeTag(prospect.city || 'unknown');

      const result = await sendEmail({
        to: prospect.email!,
        subject,
        html,
        text,
        tags: [
          { name: 'category', value: catTag },
          { name: 'city', value: cityTag },
          { name: 'source', value: 'followup_1' },
        ],
      });
      
      if (result.success) {
        sent++;
        await prisma.prospect.update({
          where: { id: prospect.id },
          data: {
            followUpStage: 1,
            lastEmailSentAt: new Date(),
            notes: `${prospect.notes || ''}\nFollow-up #1 sent: ${result.id}`.trim(),
          },
        });
        console.log(`✅ [FU1 ${sent}] ${prospect.businessName} (${prospect.email})`);
      } else {
        failed++;
        console.error(`❌ FU1 Failed: ${prospect.businessName} - ${result.error}`);
      }
    } catch (err: any) {
      failed++;
      console.error(`❌ FU1 Error: ${prospect.businessName} - ${err.message}`);
    }
  }
  
  // ─── FOLLOW-UP 2: Status CONTACTED, followUpStage=1, lastEmailSentAt >= 7 days ago ───
  const followUp2Prospects = await prisma.prospect.findMany({
    where: {
      status: 'CONTACTED',
      followUpStage: 1,
      lastEmailSentAt: { lte: followUp2Cutoff },
      email: { not: null },
    },
    orderBy: { lastEmailSentAt: 'asc' },
    take: 50,
  });
  
  console.log(`📋 Follow-up #2: ${followUp2Prospects.length} prospects`);
  
  for (const prospect of followUp2Prospects) {
    try {
      const cleanName = sanitizeBusinessName(prospect.businessName);
      const feature = getCategoryFeature(prospect.category);
      const unsubscribeUrl = generateUnsubscribeLink(prospect.whatsappNumber);
      
      const { subject, html, text } = buildFollowUp2Template(cleanName, prospect.category, feature, unsubscribeUrl);
      
      // Sanitize tags for Resend (ASCII only, no spaces/special chars)
      const sanitizeTag = (val: string) => val.toLowerCase().replace(/[^a-z0-9_-]/g, '_').substring(0, 64);
      const catTag = sanitizeTag(prospect.category || 'unknown');
      const cityTag = sanitizeTag(prospect.city || 'unknown');

      const result = await sendEmail({
        to: prospect.email!,
        subject,
        html,
        text,
        tags: [
          { name: 'category', value: catTag },
          { name: 'city', value: cityTag },
          { name: 'source', value: 'followup_2' },
        ],
      });
      
      if (result.success) {
        sent++;
        await prisma.prospect.update({
          where: { id: prospect.id },
          data: {
            followUpStage: 2,
            lastEmailSentAt: new Date(),
            notes: `${prospect.notes || ''}\nFollow-up #2 sent: ${result.id}`.trim(),
          },
        });
        console.log(`✅ [FU2 ${sent}] ${prospect.businessName} (${prospect.email})`);
      } else {
        failed++;
        console.error(`❌ FU2 Failed: ${prospect.businessName} - ${result.error}`);
      }
    } catch (err: any) {
      failed++;
      console.error(`❌ FU2 Error: ${prospect.businessName} - ${err.message}`);
    }
  }
  
  // ─── MARK DONE: followUpStage=2, lastEmailSentAt >= 14 days ago → followUpStage=3 ───
  const doneCutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const doneCount = await prisma.prospect.updateMany({
    where: {
      followUpStage: 2,
      lastEmailSentAt: { lte: doneCutoff },
    },
    data: { followUpStage: 3 },
  });
  
  if (doneCount.count > 0) {
    console.log(`📦 Marked ${doneCount.count} prospects as follow-up complete (stage 3)`);
  }
  
  console.log(`\n📊 FOLLOW-UP SUMMARY:`);
    console.log(`  Sent: ${sent}`);
    console.log(`  Failed: ${failed}`);
    console.log(`  Marked done: ${doneCount.count}`);

    // Send Telegram notification
    await sendTelegramNotification(
      `🔄 *Email Follow-up Selesai*\n` +
      `📧 FU#1 (3 hari): ${followUp1Prospects.length} target\n` +
      `📧 FU#2 (7 hari): ${followUp2Prospects.length} target\n` +
      `✅ Terkirim: ${sent}\n` +
      `❌ Gagal: ${failed}\n` +
      `📦 Selesai (stage 3): ${doneCount.count}`
    );

    return { success: failed === 0, sent, failed, done: doneCount.count };
}

runFollowUpOutreach().catch(console.error);