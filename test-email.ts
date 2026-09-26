import { Resend } from 'resend';
import dotenv from 'dotenv';
import path from 'path';

// Load env FIRST - before any other imports
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Now import modules that use process.env
import { buildEmailTemplate, generateUnsubscribeLink, sanitizeBusinessName, getCategoryFeature } from './src/email/resend-client';

const resend = new Resend(process.env.RESEND_API_KEY!);

async function test() {
  // Test data - simulate a prospect from Google Maps
  const prospect = {
    businessName: 'Danendra Rental Mobil Bandung',
    category: 'Rental Mobil',
    city: 'Bandung',
    whatsappNumber: '+6281234567890',
  };

  const cleanName = sanitizeBusinessName(prospect.businessName);
  const feature = getCategoryFeature(prospect.category);
  const unsubscribeUrl = generateUnsubscribeLink(prospect.whatsappNumber);
  
  const { subject, html, text } = buildEmailTemplate(
    cleanName,
    prospect.category,
    feature,
    unsubscribeUrl
  );

  console.log('=== TEST EMAIL ===');
  console.log('From: PJTech <prana@pjtechumkm.com>');
  console.log('To: pranajayatech@gmail.com');
  console.log('Subject:', subject);
  console.log('==================\n');

  const result = await resend.emails.send({
    from: 'PJTech <prana@pjtechumkm.com>',
    to: 'pranajayatech@gmail.com',
    subject,
    html,
    text,
    tags: [
      { name: 'category', value: 'rental-mobil' },
      { name: 'city', value: 'bandung' },
      { name: 'source', value: 'test' },
    ],
  });

  console.log('Result:', result);
  
  if (result.error) {
    console.error('❌ GAGAL:', result.error);
  } else {
    console.log('✅ BERHASIL! Cek inbox pranajayatech@gmail.com');
    console.log('Email ID:', result.data?.id);
  }
}

test().catch(console.error);