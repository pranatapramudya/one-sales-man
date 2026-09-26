import { Resend } from 'resend';

// Lazy-loaded Resend client to allow dotenv.config() to run first
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY not set in environment');
    }
    _resend = new Resend(apiKey);
  }
  return _resend;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  tags?: { name: string; value: string }[];
}

export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'PJTech <prana@outreach.pjtechumkm.com>',
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      tags: params.tags,
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err: any) {
    console.error('Send email exception:', err);
    return { success: false, error: err.message };
  }
}

export function generateUnsubscribeLink(email: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pjtechumkm.com';
  return `${baseUrl}/unsubscribe?email=${encodeURIComponent(email)}`;
}

export function buildEmailTemplate(
  cleanName: string,
  category: string | null,
  feature: string,
  unsubscribeUrl: string
): EmailTemplate {
  const subject = `POS Kasir ${category || 'UMKM'} ${cleanName} - 990k/tahun`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">PJTech Kasir UMKM</h1>
    <p style="color: #bfdbfe; margin: 10px 0 0;">Sistem Kasir Digital untuk UMKM Indonesia</p>
  </div>
  
  <div style="background: #fafafa; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="font-size: 16px;">Halo <strong>${cleanName}</strong>,</p>
    
    <p>Salam kenal dari tim PJTech 🙏</p>
    
    <p>Izin tanya, untuk <strong>${feature}</strong> saat ini sudah pakai sistem kasir otomatis atau masih manual catat di buku/WA?</p>
    
    <div style="background: white; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
      <p style="margin: 0 0 10px;"><strong>Kebetulan kami punya sistem kasir digital khusus ${category || 'usaha Anda'}:</strong></p>
      <ul style="margin: 0; padding-left: 20px;">
        <li>Bisa dibuka dari HP, tablet, maupun laptop (tanpa beli mesin kasir mahal)</li>
        <li>Rekap omzet & laporan pajak otomatis real-time</li>
        <li>Cocok untuk ${category || 'berbagai jenis usaha'} seperti usaha Anda</li>
      </ul>
    </div>
    
    <p>Harga transparan: <strong>Rp 990.000/tahun</strong> (Rp 82.500/bulan). Tidak ada biaya tersembunyi.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="https://pjtechumkm.com" style="display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
        Coba Gratis 14 Hari →
      </a>
    </div>
    
    <p style="font-size: 14px; color: #6b7280;">
      Tim kami siap bantu input data awal (armada/menu/layanan/produk) gratis biar langsung bisa dipakai.
    </p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    
    <p style="font-size: 12px; color: #9ca3af; text-align: center;">
      Kalau email ini tidak relevan, <a href="${unsubscribeUrl}" style="color: #9ca3af;">klik di sini untuk unsubscribe</a>.<br>
      PJTech • Kasir UMKM Digital • pjtechumkm.com
    </p>
  </div>
</body>
</html>`;

  const text = `
Halo ${cleanName},

Salam kenal dari tim PJTech 🙏

Izin tanya, untuk ${feature} saat ini sudah pakai sistem kasir otomatis atau masih manual catat di buku/WA?

Kebetulan kami punya sistem kasir digital khusus ${category || 'usaha Anda'}:
- Bisa dibuka dari HP, tablet, maupun laptop (tanpa beli mesin kasir mahal)
- Rekap omzet & laporan pajak otomatis real-time
- Cocok untuk ${category || 'berbagai jenis usaha'} seperti usaha Anda

Harga transparan: Rp 990.000/tahun (Rp 82.500/bulan). Tidak ada biaya tersembunyi.

Coba gratis 14 hari: https://pjtechumkm.com

Tim kami siap bantu input data awal (armada/menu/layanan/produk) gratis biar langsung bisa dipakai.

---
Kalau email ini tidak relevan, unsubscribe: ${unsubscribeUrl}
PJTech • Kasir UMKM Digital • pjtechumkm.com
`;

  return { subject, html, text };
}

// Category-based feature mapping (mirror from cli-outreach.ts)
export function getCategoryFeature(category: string | null): string {
  const cat = (category || '').toLowerCase();

  if (
    cat.includes('retail') || cat.includes('toko') || cat.includes('mart') || 
    cat.includes('sembako') || cat.includes('grosir') || cat.includes('minimarket') || 
    cat.includes('warung') || cat.includes('butik') || cat.includes('fashion') || 
    cat.includes('distro') || cat.includes('elektronik') || cat.includes('atk') || 
    cat.includes('baju') || cat.includes('pakaian')
  ) {
    return 'catat stok barang dan rekap penjualan harian';
  }

  if (
    cat.includes('kafe') || cat.includes('cafe') || cat.includes('kopi') || 
    cat.includes('resto') || cat.includes('makan') || cat.includes('f&b') || 
    cat.includes('fnb') || cat.includes('kuliner') || cat.includes('bakery') || 
    cat.includes('roti') || cat.includes('kedai') || cat.includes('kitchen')
  ) {
    return 'rekap orderan meja dan cetak struk dapur';
  }

  if (
    cat.includes('jasa') || cat.includes('servis') || cat.includes('service') || 
    cat.includes('salon') || cat.includes('barber') || cat.includes('cukur') || 
    cat.includes('bengkel') || cat.includes('spa') || cat.includes('klinik') || 
    cat.includes('dokter') || cat.includes('apotek') || cat.includes('gym') || 
    cat.includes('fitness') || cat.includes('cuci') || cat.includes('laundry') || 
    cat.includes('refleksi')
  ) {
    return 'hitung komisi kapster/teknisi dan rekap omzet';
  }

  if (
    cat.includes('rental') || cat.includes('sewa') || cat.includes('kos') || 
    cat.includes('kost') || cat.includes('mobil') || cat.includes('motor') || 
    cat.includes('travel') || cat.includes('tour') || cat.includes('property') || 
    cat.includes('properti') || cat.includes('penginapan') || cat.includes('homestay') || 
    cat.includes('villa') || cat.includes('hotel') || cat.includes('pantai') || 
    cat.includes('resort') || cat.includes('cottage') || cat.includes('glamping') || 
    cat.includes('lapangan') || cat.includes('futsal') || cat.includes('badminton') || 
    cat.includes('studio') || cat.includes('ruang')
  ) {
    return 'catat jadwal sewa unit/kamar per jam atau per hari, deposit, dan kuitansi otomatis';
  }

  return 'catat transaksi kasir dan rekap omzet harian';
}

export function sanitizeBusinessName(rawName: string): string {
  if (!rawName) return 'Kak';
  let name = rawName;
  name = name.replace(/\(.*?\)/g, '');
  name = name.replace(/\[.*?\]/g, '');
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