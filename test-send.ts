import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '.env') });

async function test() {
  const { sendTemplate } = await import('./src/whatsapp/cloud-api');
  const result = await sendTemplate('085723256427', 'outreach_intro', ['Test User', 'UMKM'], 'id');
  console.log('Result:', JSON.stringify(result, null, 2));
}
test().catch(e => console.error('Error:', e));