import path from 'path';
import dotenv from 'dotenv';

// Pastikan selalu meload file .env milik one-sales-man
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import prisma from '../lib/prisma';
import { whatsappClient, sendColdMessage } from '../whatsapp/client';

// ── LAPISAN 1: SMART NAME SANITIZER ──────────────────────────────────────────
export function sanitizeBusinessName(rawName: string): string {
  if (!rawName) return 'Kak';
  let name = rawName;

  // 1. Hapus isi tanda kurung beserta kurungnya: (Buka 24 Jam), (Cabang...), dll
  name = name.replace(/\(.*?\)/g, '');
  name = name.replace(/\[.*?\]/g, '');

  // 2. Hapus kata setelah strip, pipe, atau slash (biasanya tagline/kota)
  name = name.split(/[-|/]/)[0];

  // 3. Hapus PT, CV, UD, PD
  name = name.replace(/\b(PT|CV|UD|PD)\.?\s+/gi, '');

  // 4. Hapus frase umum Google Maps
  name = name.replace(/\b(buka\s+24\s+jam|24\s+jam|cabang\s+\w+|spesialis\s+[\w\s]+)/gi, '');

  // 5. Hapus gelar setelah tanda koma (misal: , Sp.A, , S.Ked)
  name = name.split(',')[0];

  // 6. Rapikan spasi
  name = name.replace(/\s+/g, ' ').trim();

  // 7. Jika nama masih terlalu panjang (> 4 kata), ambil 4 kata pertama agar terdengar natural
  const words = name.split(' ');
  if (words.length > 4) {
    name = words.slice(0, 4).join(' ');
  }

  // 8. Hapus karakter menggantung di akhir (seperti &, -, ,, /)
  name = name.replace(/[\s&,\-|/]+$/, '').trim();

  return name || rawName;
}

// ── LAPISAN 2: FITUR SPESIFIK 4 PILAR BISNIS UMKM ────────────────────────────
export function getCategoryFeature(category: string | null): string {
  const cat = (category || '').toLowerCase();

  // 1. Retail
  if (
    cat.includes('retail') ||
    cat.includes('toko') ||
    cat.includes('mart') ||
    cat.includes('sembako') ||
    cat.includes('grosir') ||
    cat.includes('minimarket') ||
    cat.includes('warung') ||
    cat.includes('butik') ||
    cat.includes('fashion') ||
    cat.includes('distro') ||
    cat.includes('elektronik') ||
    cat.includes('atk') ||
    cat.includes('baju') ||
    cat.includes('pakaian')
  ) {
    return 'catat stok barang dan rekap penjualan harian';
  }

  // 2. F&B
  if (
    cat.includes('kafe') ||
    cat.includes('cafe') ||
    cat.includes('kopi') ||
    cat.includes('resto') ||
    cat.includes('makan') ||
    cat.includes('f&b') ||
    cat.includes('fnb') ||
    cat.includes('kuliner') ||
    cat.includes('bakery') ||
    cat.includes('roti') ||
    cat.includes('kedai') ||
    cat.includes('kitchen')
  ) {
    return 'rekap orderan meja dan cetak struk dapur';
  }

  // 3. Jasa / Servis
  if (
    cat.includes('jasa') ||
    cat.includes('servis') ||
    cat.includes('service') ||
    cat.includes('salon') ||
    cat.includes('barber') ||
    cat.includes('cukur') ||
    cat.includes('bengkel') ||
    cat.includes('spa') ||
    cat.includes('klinik') ||
    cat.includes('dokter') ||
    cat.includes('apotek') ||
    cat.includes('gym') ||
    cat.includes('fitness') ||
    cat.includes('cuci') ||
    cat.includes('laundry') ||
    cat.includes('refleksi')
  ) {
    return 'hitung komisi kapster/teknisi dan rekap omzet';
  }

  // 4. Rental / Travel / Properti (per jam/hari, kendaraan, penginapan pantai, kos, villa)
  if (
    cat.includes('rental') ||
    cat.includes('sewa') ||
    cat.includes('kos') ||
    cat.includes('kost') ||
    cat.includes('mobil') ||
    cat.includes('motor') ||
    cat.includes('travel') ||
    cat.includes('tour') ||
    cat.includes('property') ||
    cat.includes('properti') ||
    cat.includes('penginapan') ||
    cat.includes('homestay') ||
    cat.includes('villa') ||
    cat.includes('hotel') ||
    cat.includes('pantai') ||
    cat.includes('resort') ||
    cat.includes('cottage') ||
    cat.includes('glamping') ||
    cat.includes('lapangan') ||
    cat.includes('futsal') ||
    cat.includes('badminton') ||
    cat.includes('studio') ||
    cat.includes('ruang')
  ) {
    return 'catat jadwal sewa unit/kamar per jam atau per hari, deposit, dan kuitansi otomatis';
  }

  // 5. Fallback Kategori Lainnya
  return 'catat transaksi kasir dan rekap omzet harian';
}

// ── LAPISAN 3: STRUKTUR PESAN OUTREACH SOFT-SELLING (4 PILAR BISNIS UMKM) ─────
export function getNicheHook(category: string | null, cleanName: string): string {
  const cat = (category || '').toLowerCase();

  // 1. Pilar Rental, Travel & Properti
  if (
    cat.includes('rental') || cat.includes('sewa') || cat.includes('mobil') || cat.includes('motor') ||
    cat.includes('travel') || cat.includes('tour') || cat.includes('kos') || cat.includes('kost') ||
    cat.includes('homestay') || cat.includes('villa') || cat.includes('penginapan') || cat.includes('ps')
  ) {
    return `Halo Kak di \${cleanName}, salam kenal dari tim PJTech 🙏

Izin tanya Kak, untuk pencatatan jadwal booking armada/kamar, catat DP, dan cetak kuitansinya saat ini sudah pakai sistem otomatis atau masih rekap di buku/WA ya Kak?

Kebetulan kami ada sistem kasir digital khusus usaha rental & penginapan (bisa dibuka fleksibel lewat HP, tablet, maupun laptop tanpa perlu beli alat mahal). Jadwal sewa rapi dan omzet harian kepantau langsung secara real-time.

Akses uji coba gratisnya bisa dicoba di https://pjtechumkm.com ya Kak. Biar nggak repot setup dari nol, tim kami juga siap bantu inputkan 2-3 data armada/unit awal Kakak secara gratis 😊`;
  }

  // 2. Pilar F&B (Kuliner, Kafe, Resto, Kedai, Minuman)
  if (
    cat.includes('kafe') || cat.includes('cafe') || cat.includes('kopi') || cat.includes('resto') ||
    cat.includes('makan') || cat.includes('f&b') || cat.includes('fnb') || cat.includes('kuliner') ||
    cat.includes('bakery') || cat.includes('roti') || cat.includes('kedai') || cat.includes('mie') ||
    cat.includes('bakso') || cat.includes('boba') || cat.includes('teh')
  ) {
    return `Halo Kak di \${cleanName}, salam kenal dari tim PJTech 🙏

Izin tanya Kak, pas jam ramai, untuk rekap orderan nomor meja kasir dan cetak struk pesanan ke dapur saat ini sudah pakai sistem kasir otomatis atau masih manual ya Kak?

Kebetulan kami mengembangkan sistem kasir UMKM kuliner yang bisa jalan fleksibel di HP pelayan, tablet kasir, maupun laptop tanpa perlu mesin kasir jutaan rupiah. Rekap meja rapi dan omzet harian bisa dipantau langsung dari HP owner.

Akses coba gratisnya bisa langsung dicek di https://pjtechumkm.com ya Kak. Kalau mau dibantu inputkan beberapa menu awal biar tinggal tes pakai, tim kami siap bantu inputkan gratis Kak 😊`;
  }

  // 3. Pilar Jasa & Servis (Barber, Salon, Bengkel, Laundry, Servis Elektronik)
  if (
    cat.includes('jasa') || cat.includes('servis') || cat.includes('service') || cat.includes('salon') ||
    cat.includes('barber') || cat.includes('bengkel') || cat.includes('laundry') || cat.includes('cuci') ||
    cat.includes('klinik') || cat.includes('spa') || cat.includes('refleksi')
  ) {
    return `Halo Kak di \${cleanName}, salam kenal dari tim PJTech 🙏

Izin tanya Kak, untuk pembagian komisi bagi hasil capster/mekanik/karyawan dan cetak nota kasir saat ini sudah otomatis atau masih dihitung manual tiap tutup toko ya Kak?

Kebetulan sistem kasir PJTech bisa dibuka langsung dari HP, tablet, atau laptop kasir dengan fitur hitung komisi karyawan otomatis dan rekap omzet harian tanpa repot kalkulator.

Akses coba gratisnya bisa dicoba di https://pjtechumkm.com ya Kak. Biar nggak repot setup dari nol, tim kami juga siap bantu inputkan tarif layanan awal Kakak secara gratis 😊`;
  }

  // 4. Pilar Retail & Grosir (Toko Kelontong, Kosmetik, Konter HP, Butik, Petshop, Bangunan, ATK, Apotek)
  return `Halo Kak di \${cleanName}, salam kenal dari tim PJTech 🙏

Izin tanya Kak, untuk scan barcode produk, kontrol stok biar gak selisih, dan rekap laba modal harian saat ini sudah pakai sistem kasir otomatis atau masih rekap manual ya Kak?

Kebetulan sistem kasir PJTech dirancang ringan untuk toko retail (bisa jalan di HP, tablet, maupun laptop kasir). Bisa scan barcode langsung dari kamera HP atau scanner USB, dan otomatis kasih peringatan kalau stok mulai habis.

Coba gratisnya bisa diakses di https://pjtechumkm.com ya Kak. Tim kami juga siap bantu inputkan beberapa contoh produk awal secara gratis biar tinggal tes coba 😊`;
}

// ── HELPER DELAY ANTI-BAN (30s - 60s) ────────────────────────────────────────
function randomDelay(minMs: number = 30000, maxMs: number = 60000): Promise<number> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(() => resolve(ms), ms));
}

// ── HELPER SMART CATEGORY FILTER ─────────────────────────────────────────────
export function buildCategoryQuery(category?: string): any {
  if (!category || category.trim() === '') return undefined;
  const cat = category.toLowerCase().trim();

  // F&B Niche
  if (
    cat.includes('f&b') ||
    cat.includes('fnb') ||
    cat.includes('kafe') ||
    cat.includes('cafe') ||
    cat.includes('resto') ||
    cat.includes('kopi') ||
    cat.includes('makan') ||
    cat.includes('kuliner') ||
    cat.includes('bakery')
  ) {
    return {
      OR: [
        { category: { contains: 'kafe', mode: 'insensitive' } },
        { category: { contains: 'cafe', mode: 'insensitive' } },
        { category: { contains: 'resto', mode: 'insensitive' } },
        { category: { contains: 'kopi', mode: 'insensitive' } },
        { category: { contains: 'makan', mode: 'insensitive' } },
        { category: { contains: 'f&b', mode: 'insensitive' } },
        { category: { contains: 'fnb', mode: 'insensitive' } },
        { category: { contains: 'kuliner', mode: 'insensitive' } },
        { category: { contains: 'bakery', mode: 'insensitive' } },
        { category: { contains: 'kedai', mode: 'insensitive' } }
      ]
    };
  }

  // Rental / Properti Niche
  if (
    cat.includes('rental') ||
    cat.includes('sewa') ||
    cat.includes('kos') ||
    cat.includes('kost') ||
    cat.includes('mobil') ||
    cat.includes('motor') ||
    cat.includes('villa') ||
    cat.includes('homestay') ||
    cat.includes('pantai') ||
    cat.includes('properti') ||
    cat.includes('penginapan') ||
    cat.includes('hotel') ||
    cat.includes('resort') ||
    cat.includes('lapangan')
  ) {
    return {
      OR: [
        { category: { contains: 'rental', mode: 'insensitive' } },
        { category: { contains: 'sewa', mode: 'insensitive' } },
        { category: { contains: 'mobil', mode: 'insensitive' } },
        { category: { contains: 'motor', mode: 'insensitive' } },
        { category: { contains: 'kos', mode: 'insensitive' } },
        { category: { contains: 'villa', mode: 'insensitive' } },
        { category: { contains: 'homestay', mode: 'insensitive' } },
        { category: { contains: 'penginapan', mode: 'insensitive' } },
        { category: { contains: 'travel', mode: 'insensitive' } },
        { category: { contains: 'properti', mode: 'insensitive' } },
        { category: { contains: 'resort', mode: 'insensitive' } },
        { category: { contains: 'hotel', mode: 'insensitive' } },
        { category: { contains: 'lapangan', mode: 'insensitive' } }
      ]
    };
  }

  // Retail Niche
  if (
    cat.includes('retail') ||
    cat.includes('toko') ||
    cat.includes('mart') ||
    cat.includes('minimarket') ||
    cat.includes('sembako') ||
    cat.includes('grosir') ||
    cat.includes('warung') ||
    cat.includes('butik') ||
    cat.includes('distro') ||
    cat.includes('fashion')
  ) {
    return {
      OR: [
        { category: { contains: 'retail', mode: 'insensitive' } },
        { category: { contains: 'toko', mode: 'insensitive' } },
        { category: { contains: 'mart', mode: 'insensitive' } },
        { category: { contains: 'minimarket', mode: 'insensitive' } },
        { category: { contains: 'sembako', mode: 'insensitive' } },
        { category: { contains: 'grosir', mode: 'insensitive' } },
        { category: { contains: 'warung', mode: 'insensitive' } },
        { category: { contains: 'butik', mode: 'insensitive' } },
        { category: { contains: 'distro', mode: 'insensitive' } },
        { category: { contains: 'baju', mode: 'insensitive' } },
        { category: { contains: 'elektronik', mode: 'insensitive' } }
      ]
    };
  }

  // Jasa Niche
  if (
    cat.includes('jasa') ||
    cat.includes('servis') ||
    cat.includes('service') ||
    cat.includes('salon') ||
    cat.includes('barber') ||
    cat.includes('cukur') ||
    cat.includes('bengkel') ||
    cat.includes('klinik') ||
    cat.includes('dokter') ||
    cat.includes('apotek') ||
    cat.includes('laundry') ||
    cat.includes('cuci') ||
    cat.includes('gym')
  ) {
    return {
      OR: [
        { category: { contains: 'jasa', mode: 'insensitive' } },
        { category: { contains: 'servis', mode: 'insensitive' } },
        { category: { contains: 'salon', mode: 'insensitive' } },
        { category: { contains: 'barber', mode: 'insensitive' } },
        { category: { contains: 'cukur', mode: 'insensitive' } },
        { category: { contains: 'bengkel', mode: 'insensitive' } },
        { category: { contains: 'klinik', mode: 'insensitive' } },
        { category: { contains: 'dokter', mode: 'insensitive' } },
        { category: { contains: 'apotek', mode: 'insensitive' } },
        { category: { contains: 'spa', mode: 'insensitive' } },
        { category: { contains: 'laundry', mode: 'insensitive' } },
        { category: { contains: 'cuci', mode: 'insensitive' } },
        { category: { contains: 'gym', mode: 'insensitive' } }
      ]
    };
  }

  return { category: { contains: cat, mode: 'insensitive' } };
}

// ── FUNGSI UTAMA BATCH OUTREACH ──────────────────────────────────────────────
async function runBatchOutreach(batchLimit: number = 10, category?: string, city?: string) {
  console.log(`[OUTREACH_START] Memulai batch outreach (Maksimal: ${batchLimit} prospek PENDING | Filter: ${category || 'Semua'} - ${city || 'Semua'})...`);

  const whereClause: any = { status: 'PENDING' };
  const catFilter = buildCategoryQuery(category);
  if (catFilter) {
    if (catFilter.OR) {
      whereClause.OR = catFilter.OR;
    } else if (catFilter.category) {
      whereClause.category = catFilter.category;
    }
  }

  if (city && city.trim() !== '') {
    whereClause.city = { contains: city.trim(), mode: 'insensitive' };
  }

  let pendingProspects = await prisma.prospect.findMany({
    where: whereClause,
    take: batchLimit
  });

  if (pendingProspects.length === 0 && (category || city)) {
    console.log(`[OUTREACH_FALLBACK] Tidak ada prospek PENDING untuk niche "${category || ''}". Mengambil antrean PENDING umum...`);
    pendingProspects = await prisma.prospect.findMany({
      where: { status: 'PENDING' },
      take: batchLimit
    });
  }

  if (pendingProspects.length === 0) {
    console.log('[OUTREACH_EMPTY] Tidak ada prospek dengan status PENDING di database.');
    return { contacted: 0, failed: 0, targetInfo: `${category || 'Semua'} di ${city || 'Semua'}` };
  }

  console.log(`[OUTREACH_FOUND] Ditemukan ${pendingProspects.length} prospek PENDING siap dihubungi.`);

  let successCount = 0;
  let failCount = 0;

  let currentIndex = 0;
  for (const prospect of pendingProspects) {
    currentIndex++;

    // 1. Lapisan 1: Bersihkan nama bisnis dari embel-embel Google Maps
    const cleanName = sanitizeBusinessName(prospect.businessName);

    // 2. Lapisan 2: Buat pesan baku dengan variasi fitur spesifik kategori
    const finalMessage = getNicheHook(prospect.category, cleanName);

    console.log(`[OUTREACH_TEXT ${currentIndex}/${pendingProspects.length}]:\n"${finalMessage}"\n`);
    console.log(`[OUTREACH_SENDING ${currentIndex}/${pendingProspects.length}] Mengirim pesan ke ${cleanName} (${prospect.whatsappNumber})...`);

    const success = await sendColdMessage(prospect.whatsappNumber, finalMessage);

    if (success) {
      successCount++;
      await prisma.prospect.update({
        where: { id: prospect.id },
        data: {
          status: 'CONTACTED',
          lastContactedAt: new Date()
        }
      });

      await prisma.outreachMessage.create({
        data: {
          prospectId: prospect.id,
          messageText: finalMessage
        }
      });
      console.log(`[OUTREACH_SUCCESS] ${cleanName} status diupdate ke CONTACTED.`);

      // Jeda acak 30s - 60s SETELAH setiap pengiriman pesan sukses sebelum lanjut ke prospek berikutnya
      if (currentIndex < pendingProspects.length) {
        console.log(`⏳ [ANTI-BAN DELAY] Menunggu jeda aman sebelum kontak berikutnya...`);
        const waitedMs = await randomDelay(30000, 60000);
        console.log(`✅ [ANTI-BAN DELAY] Selesai jeda ${(waitedMs / 1000).toFixed(1)} detik. Melanjutkan ke prospek berikutnya...\n`);
      }
    } else {
      failCount++;
      console.log(`[OUTREACH_FAILED] Gagal mengirim pesan ke ${cleanName}.`);
    }
  }

  console.log(`[OUTREACH_DONE] Batch selesai! Sukses: ${successCount}, Gagal: ${failCount}`);
  return { contacted: successCount, failed: failCount, targetInfo: `${category || 'Semua'} di ${city || 'Semua'}` };
}

async function main() {
  const args = process.argv.slice(2);
  let batchLimit = 10;
  let category: string | undefined;
  let city: string | undefined;

  for (const arg of args) {
    if (arg.startsWith('--batch=')) {
      batchLimit = parseInt(arg.replace('--batch=', '').trim(), 10) || 10;
    } else if (arg.startsWith('--category=')) {
      category = arg.replace('--category=', '').replace(/^["']|["']$/g, '').trim();
    } else if (arg.startsWith('--city=')) {
      city = arg.replace('--city=', '').replace(/^["']|["']$/g, '').trim();
    }
  }

  console.log('[WA_INIT] Menginisialisasi WhatsApp Client...');

  whatsappClient.on('qr', (qr) => {
    console.log(`[WA_QR] ${qr}`);
  });

  whatsappClient.initialize();

  whatsappClient.on('ready', async () => {
    console.log('[WA_READY] WhatsApp Client siap. Menunggu 5 detik untuk stabilisasi sesi multi-device...');
    await new Promise((r) => setTimeout(r, 5000));
    console.log('[WA_STABLE] Sesi stabil. Menjalankan smart batch outreach...');
    try {
      await runBatchOutreach(batchLimit, category, city);
    } catch (err) {
      console.error('[OUTREACH_ERROR]', err);
    } finally {
      setTimeout(async () => {
        console.log('[WA_FINISH] Menutup koneksi secara aman...');
        await prisma.$disconnect();
        await whatsappClient.destroy().catch(() => {});
        process.exit(0);
      }, 5000);
    }
  });

  whatsappClient.on('auth_failure', (msg) => {
    console.error('[WA_AUTH_FAILURE]', msg);
    process.exit(1);
  });
}

// Hanya jalankan main jika dipanggil langsung sebagai CLI
if (process.argv[1] && process.argv[1].includes('cli-outreach')) {
  main();
}
