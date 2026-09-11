import 'dotenv/config';
import { whatsappClient } from '../whatsapp/client';
import prisma from '../lib/prisma';

console.log('[PAIR_START] Memulai inisialisasi WhatsApp untuk PAIRING SAJA (Tanpa Kirim Pesan)...');

whatsappClient.initialize();

whatsappClient.on('ready', async () => {
  console.log('[WA_READY] ✅ WhatsApp Client berhasil ditautkan (Pairing Sukses)!');
  console.log('[PAIR_SUCCESS] Menunggu sinkronisasi sesi multi-device WhatsApp stabil (15 detik)...');
  setTimeout(async () => {
    console.log('[PAIR_DONE] Sesi tersimpan permanen. Menutup browser secara aman.');
    await whatsappClient.destroy().catch(() => {});
    await prisma.$disconnect();
    process.exit(0);
  }, 15000);
});

whatsappClient.on('auth_failure', async (msg) => {
  console.error('[WA_AUTH_FAILURE]', msg);
  await prisma.$disconnect();
  process.exit(1);
});
