import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { sendEmail, buildEmailTemplate, sanitizeBusinessName, getCategoryFeature, generateUnsubscribeLink } from '../email/resend-client';

async function testEmail() {
  console.log('📧 Sending test email to pranajaya52@gmail.com...');
  
  const cleanName = sanitizeBusinessName('Pranajaya Tech');
  const category = 'F&B';
  const feature = getCategoryFeature(category);
  const unsubscribeUrl = generateUnsubscribeLink('pranajaya52@gmail.com');
  
  const { subject, html, text } = buildEmailTemplate(cleanName, category, feature, unsubscribeUrl);
  
  const result = await sendEmail({
    to: 'pranajaya52@gmail.com',
    subject: `[TEST] ${subject}`,
    html,
    text,
    tags: [
      { name: 'category', value: 'test' },
      { name: 'source', value: 'manual_test' },
    ],
  });
  
  if (result.success) {
    console.log('✅ Test email sent successfully!');
    console.log(`   Email ID: ${result.id}`);
  } else {
    console.error('❌ Failed to send test email:', result.error);
  }
}

testEmail().catch(console.error);