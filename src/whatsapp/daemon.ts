import path from 'path';
import http from 'http';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Global safety crash guard
process.on('uncaughtException', (err) => {
    console.error('❌ [DAEMON UNCAUGHT]:', err?.message || err);
});
process.on('unhandledRejection', (reason) => {
    console.error('❌ [DAEMON UNHANDLED]:', reason);
});

import { whatsappClient, getLatestQr, sendColdMessage } from './client';
import prisma from '../lib/prisma';

const PORT = 3847;

let isReady = false;
let isOutreachRunning = false;

function sanitizeBusinessName(rawName: string): string {
  if (!rawName) return 'Kak';
  let name = rawName;
  name = name.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '');
  name = name.split(/[-|/]/)[0];
  name = name.replace(/\b(PT|CV|UD|PD)\.?\s+/gi, '');
  name = name.replace(/\b(buka\s+24\s+jam|24\s+jam|cabang\s+\w+|spesialis\s+[\w\s]+)/gi, '');
  name = name.split(',')[0];
  name = name.replace(/\s+/g, ' ').trim();
  const words = name.split(' ');
  if (words.length > 4) name = words.slice(0, 4).join(' ');
  name = name.replace(/[\s&,\-|/]+$/, '').trim();
  return name || rawName;
}

function getCategoryFeature(category: string | null): string {
  const cat = (category || '').toLowerCase();
  if (cat.includes('retail') || cat.includes('toko') || cat.includes('mart') || cat.includes('sembako') || cat.includes('minimarket')) {
    return 'catat stok barang dan rekap penjualan harian';
  }
  if (cat.includes('kafe') || cat.includes('cafe') || cat.includes('kopi') || cat.includes('resto') || cat.includes('makan') || cat.includes('fnb') || cat.includes('kuliner')) {
    return 'rekap orderan meja dan cetak struk dapur';
  }
  if (cat.includes('jasa') || cat.includes('servis') || cat.includes('salon') || cat.includes('barber') || cat.includes('bengkel') || cat.includes('klinik') || cat.includes('laundry')) {
    return 'hitung komisi kapster/teknisi dan rekap omzet';
  }
  if (cat.includes('rental') || cat.includes('sewa') || cat.includes('kos') || cat.includes('mobil') || cat.includes('motor') || cat.includes('villa') || cat.includes('homestay')) {
    return 'catat jadwal sewa unit/kamar per jam atau per hari, deposit, dan kuitansi otomatis';
  }
  return 'catat transaksi kasir dan rekap omzet harian';
}

function getNicheHook(category: string | null, cleanName: string): string {
  const cat = (category || '').toLowerCase();

  // 1. Rental, Travel & Properti
  if (cat.includes('rental') || cat.includes('sewa') || cat.includes('mobil') || cat.includes('motor') || cat.includes('travel') || cat.includes('kos') || cat.includes('homestay') || cat.includes('villa')) {
    return `Halo Kak di \${cleanName}, salam kenal dari tim PJTech 🙏

Izin tanya Kak, untuk pencatatan jadwal booking armada/kamar, catat DP, dan cetak kuitansinya saat ini sudah pakai sistem otomatis atau masih rekap di buku/WA ya Kak?

Kebetulan kami ada sistem kasir digital khusus usaha rental & penginapan (bisa dibuka fleksibel lewat HP, tablet, maupun laptop tanpa perlu beli alat mahal). Jadwal sewa rapi dan omzet harian kepantau langsung secara real-time.

Akses uji coba gratisnya bisa dicoba di https://pjtechumkm.com ya Kak. Biar nggak repot setup dari nol, tim kami juga siap bantu inputkan 2-3 data armada/unit awal Kakak secara gratis 😊`;
  }

  // 2. F&B Kuliner
  if (cat.includes('kafe') || cat.includes('cafe') || cat.includes('kopi') || cat.includes('resto') || cat.includes('makan') || cat.includes('fnb') || cat.includes('kuliner') || cat.includes('kedai')) {
    return `Halo Kak di \${cleanName}, salam kenal dari tim PJTech 🙏

Izin tanya Kak, pas jam ramai, untuk rekap orderan nomor meja kasir dan cetak struk pesanan ke dapur saat ini sudah pakai sistem kasir otomatis atau masih manual ya Kak?

Kebetulan kami mengembangkan sistem kasir UMKM kuliner yang bisa jalan fleksibel di HP pelayan, tablet kasir, maupun laptop tanpa perlu mesin kasir jutaan rupiah. Rekap meja rapi dan omzet harian bisa dipantau langsung dari HP owner.

Akses coba gratisnya bisa langsung dicek di https://pjtechumkm.com ya Kak. Kalau mau dibantu inputkan beberapa menu awal biar tinggal tes pakai, tim kami siap bantu inputkan gratis Kak 😊`;
  }

  // 3. Jasa & Servis
  if (cat.includes('jasa') || cat.includes('servis') || cat.includes('salon') || cat.includes('barber') || cat.includes('bengkel') || cat.includes('laundry') || cat.includes('cuci')) {
    return `Halo Kak di \${cleanName}, salam kenal dari tim PJTech 🙏

Izin tanya Kak, untuk pembagian komisi bagi hasil capster/mekanik/karyawan dan cetak nota kasir saat ini sudah otomatis atau masih dihitung manual tiap tutup toko ya Kak?

Kebetulan sistem kasir PJTech bisa dibuka langsung dari HP, tablet, atau laptop kasir dengan fitur hitung komisi karyawan otomatis dan rekap omzet harian tanpa repot kalkulator.

Akses coba gratisnya bisa dicoba di https://pjtechumkm.com ya Kak. Biar nggak repot setup dari nol, tim kami juga siap bantu inputkan tarif layanan awal Kakak secara gratis 😊`;
  }

  // 4. Retail & Grosir
  return `Halo Kak di \${cleanName}, salam kenal dari tim PJTech 🙏

Izin tanya Kak, untuk scan barcode produk, kontrol stok biar gak selisih, dan rekap laba modal harian saat ini sudah pakai sistem kasir otomatis atau masih rekap manual ya Kak?

Kebetulan sistem kasir PJTech dirancang ringan untuk toko retail (bisa jalan di HP, tablet, maupun laptop kasir). Bisa scan barcode langsung dari kamera HP atau scanner USB, dan otomatis kasih peringatan kalau stok mulai habis.

Coba gratisnya bisa diakses di https://pjtechumkm.com ya Kak. Tim kami juga siap bantu inputkan beberapa contoh produk awal secara gratis biar tinggal tes coba 😊`;
}

whatsappClient.on('ready', () => {
    isReady = true;
    console.log(`\n===========================================================`);
    console.log(` 📱 WHATSAPP BUSINESS DAEMON & AI CHAT ACTIVE 24/7`);
    console.log(` • Status         : 🟢 Connected & Listening Incoming Chats`);
    console.log(` • Internal Port  : http://127.0.0.1:${PORT}`);
    console.log(` • AI Engine      : Groq (Qwen 3.8 27B) + Gemini Flash Fallback`);
    console.log(`===========================================================\n`);
});

whatsappClient.on('disconnected', () => {
    isReady = false;
});

// Jalankan HTTP server ringan untuk komunikasi internal
const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'GET' && req.url === '/health') {
        return res.end(JSON.stringify({
            status: 'ok',
            ready: isReady,
            outreachActive: isOutreachRunning,
            latestQr: getLatestQr() || null
        }));
    }

    if (req.method === 'POST' && req.url === '/trigger-outreach') {
        if (!isReady) {
            return res.writeHead(400).end(JSON.stringify({
                success: false,
                message: 'WhatsApp belum login / scan QR code.',
                qrUrl: getLatestQr() ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(getLatestQr()!)}` : undefined
            }));
        }

        if (isOutreachRunning) {
            return res.writeHead(409).end(JSON.stringify({
                success: false,
                message: 'Batch outreach WhatsApp sedang berjalan. Mohon tunggu.'
            }));
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            let params: any = {};
            try { params = JSON.parse(body); } catch {}
            const batchLimit = parseInt(params.batchLimit || '10', 10);
            const category = params.category;
            const city = params.city;

            isOutreachRunning = true;
            res.writeHead(200).end(JSON.stringify({
                success: true,
                message: `Batch outreach dimulai untuk maksimal ${batchLimit} prospek PENDING.`
            }));

            try {
                const whereClause: any = { status: 'PENDING' };
                if (city) whereClause.city = { contains: city.trim(), mode: 'insensitive' };
                
                let prospects = await prisma.prospect.findMany({
                    where: whereClause,
                    take: batchLimit
                });

                if (prospects.length === 0) {
                    prospects = await prisma.prospect.findMany({
                        where: { status: 'PENDING' },
                        take: batchLimit
                    });
                }

                console.log(`[WA_DAEMON] Memulai batch outreach ke ${prospects.length} prospek...`);

                let successCount = 0;
                let failCount = 0;

                for (let i = 0; i < prospects.length; i++) {
                    const p = prospects[i];
                    const cleanName = sanitizeBusinessName(p.businessName);
                    const finalMessage = getNicheHook(p.category, cleanName);

                    console.log(`[OUTREACH ${i+1}/${prospects.length}] Kirim ke ${cleanName} (${p.whatsappNumber})...`);
                    const ok = await sendColdMessage(p.whatsappNumber, finalMessage);

                    if (ok) {
                        successCount++;
                        await prisma.prospect.update({
                            where: { id: p.id },
                            data: { status: 'CONTACTED', lastContactedAt: new Date() }
                        });
                        await prisma.outreachMessage.create({
                            data: { prospectId: p.id, messageText: finalMessage }
                        });
                    } else {
                        failCount++;
                    }

                    // Jeda aman anti-ban antar pesan (30s - 45s)
                    if (i < prospects.length - 1) {
                        const wait = Math.floor(Math.random() * 15000) + 30000;
                        console.log(`⏳ [ANTI-BAN DELAY] Menunggu ${(wait/1000).toFixed(0)} detik...`);
                        await new Promise(r => setTimeout(r, wait));
                    }
                }
                console.log(`✅ [WA_DAEMON] Outreach batch selesai: ${successCount} sukses, ${failCount} gagal.`);
            } catch (err: any) {
                console.error('❌ [WA_DAEMON] Error saat outreach batch:', err?.message);
            } finally {
                isOutreachRunning = false;
            }
        });
        return;
    }

    res.writeHead(404).end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`🚀 [WA_DAEMON] Server bridge aktif di http://127.0.0.1:${PORT}`);
    console.log(`📱 [WA_DAEMON] Menginisialisasi WhatsApp Client...`);
    whatsappClient.initialize();
});
