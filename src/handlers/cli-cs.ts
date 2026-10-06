import Groq from "groq-sdk";
import prisma from "../config/db";

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

const KASIR_KNOWLEDGE_BASE = `
PRODUK: Kasir UMKM PJTech (Aplikasi POS / Kasir Online & Offline)
WEBSITE RESMI: https://pjtechumkm.com
AGENCY CUSTOM APPS: https://www.pranajayatech.online/
TARGET: Warung Retail, Kafe / Resto F&B, Salon / Barbershop, Jasa Servis, Laundry, Gym, Rental.

PAKET LANGGANAN PJTECHUMKM.COM:
- Free Trial (Rp 0 / 14 Hari): Bebas coba akses penuh Kasir POS & Manajemen Produk Dasar tanpa biaya.
- Pro 1 Bulan (Rp 129.000 / bulan): Akses Penuh POS, Jasa & Rental, Manajemen Stok & Komisi, Laporan Keuangan Dasar.
- Pro 6 Bulan (Rp 99.000 / bulan atau Rp 594.000 / 6 bulan): Akses Penuh POS + Ekspor Data Laporan (Excel/CSV) + Laporan Laba Bersih.
- Pro 1 Tahun (Paling Hemat - Rp 82.500 / bulan atau Rp 990.000 / tahun): Semua fitur tanpa batasan, Analitik Mendalam tren penjualan, Database Pelanggan, CS Prioritas (Hemat Rp 558.000).

LAYANAN CUSTOM APPS & WEB:
- Untuk bisnis dengan kebutuhan khusus/kompleks (Klinik, Gym, Rental mobil, dsb) atau pembuatan website profil: Dilayani oleh PJTECH Agency (https://www.pranajayatech.online/).

PANDUAN FITUR:
1. Setting Printer Struk: Buka Menu 'Pengaturan' > Pilih 'Printer Bluetooth' > Nyalakan Bluetooth HP/PC > Sambungkan ke Printer Thermal 58mm atau 80mm > Klik 'Test Print'.
2. Tambah Produk & Kategori: Menu 'Inventori' > Klik '+ Tambah Produk' > Masukkan Nama, Harga Beli, Harga Jual, dan Stok > Simpan.
3. Transaksi Penjualan: Menu 'Kasir' > Klik produk / scan barcode > Pilih metode pembayaran (Tunai/QRIS/Transfer) > Klik 'Bayar & Cetak Struk'.
4. Laporan Penjualan: Menu 'Laporan' > Pilih tanggal > Bisa download Rekapitulasi PDF atau Excel.
`;

async function main() {
  const args = process.argv.slice(2);

  try {
    // Mode 1: Klasifikasi & Auto-Reply (--classify)
    if (args.includes("--classify")) {
      const queryArg =
        args.find((a) => a.startsWith("--query="))?.replace("--query=", "") ||
        "";
      const senderArg =
        args.find((a) => a.startsWith("--sender="))?.replace("--sender=", "") ||
        "Unknown";

      if (!queryArg) {
        throw new Error("Query pesan klien tidak boleh kosong");
      }

      // Default fallback jika Groq tidak tersedia
      let category: any = "FEATURE_HOWTO";
      let status: any = "RESOLVED_BY_AI";
      let answer =
        "Halo Kak! Terima kasih sudah menghubungi CS Kasir UMKM PJTech. Ada yang bisa kami bantu seputar aplikasi kasir Anda?";
      let escalatedReason = "";

      if (groq) {
        const completion = await groq.chat.completions.create({
          model: "qwen/qwen3.8-27b",
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `Anda adalah AI Customer Success & Technical Triage untuk aplikasi "Kasir UMKM PJTech".
Tugas Anda adalah:
1. Menganalisis pesan masuk dari klien.
2. Mengklasifikasikan kategori (PRICING_INFO, FEATURE_HOWTO, PRINTER_SETUP, BUG_REPORT, PAYMENT_CONFIRMATION, COMPLEX_CUSTOM).
3. Menentukan status:
   - "RESOLVED_BY_AI": Jika pertanyaan seputar harga, cara pakai fitur, cara setting printer, atau sapaan umum. Jawab ramah dan berikan solusi jelas berdasarkan Knowledge Base.
   - "ESCALATED_TO_HUMAN": Jika klien melaporkan bug teknis (error 500, data hilang, crash, tidak bisa buka sistem), meminta nomor rekening untuk bayar langganan (Closing Deal), komplain marah, atau minta fitur kustom di luar sistem.
   
Knowledge Base:
${KASIR_KNOWLEDGE_BASE}

Output format JSON:
{
  "category": "PRICING_INFO" | "FEATURE_HOWTO" | "PRINTER_SETUP" | "BUG_REPORT" | "PAYMENT_CONFIRMATION" | "COMPLEX_CUSTOM",
  "status": "RESOLVED_BY_AI" | "ESCALATED_TO_HUMAN",
  "answer": "Pesan balasan ramah dalam bahasa Indonesia santun",
  "escalatedReason": "Alasan singkat jika butuh eskalasi ke Mas Pranata, atau kosong jika resolved"
}`,
            },
            {
              role: "user",
              content: queryArg,
            },
          ],
        });

        const resContent = completion.choices[0]?.message?.content || "{}";
        const parsed = JSON.parse(resContent);

        category = parsed.category || "FEATURE_HOWTO";
        status = parsed.status || "RESOLVED_BY_AI";
        answer = parsed.answer || answer;
        escalatedReason = parsed.escalatedReason || "";
      }

      // Cari prospect jika ada berdasarkan sender WA
      const cleanPhone = senderArg.replace(/\D/g, "");
      const prospect = await prisma.prospect.findFirst({
        where: {
          whatsappNumber: { contains: cleanPhone.slice(-9) },
        },
      });

      // Simpan ke database SupportTicket
      const ticket = await prisma.supportTicket.create({
        data: {
          prospectId: prospect?.id || null,
          senderPhone: senderArg,
          category,
          status,
          userQuery: queryArg,
          aiDraftAnswer: answer,
          escalatedReason:
            status === "ESCALATED_TO_HUMAN"
              ? escalatedReason || "Butuh penanganan teknis"
              : null,
        },
      });

      console.log(
        JSON.stringify(
          {
            success: true,
            ticketId: ticket.id,
            senderPhone: senderArg,
            category,
            status,
            requiresEscalation: status === "ESCALATED_TO_HUMAN",
            escalatedReason,
            answer,
            prospectName: prospect?.businessName || null,
          },
          null,
          2,
        ),
      );
      return;
    }

    // Mode 2: Daftar Tiket Butuh Teknisi (--list)
    if (args.includes("--list")) {
      const tickets = await prisma.supportTicket.findMany({
        where: { status: "ESCALATED_TO_HUMAN" },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          prospect: {
            select: { businessName: true, category: true, city: true },
          },
        },
      });

      const totalCount = await prisma.supportTicket.count({
        where: { status: "ESCALATED_TO_HUMAN" },
      });

      console.log(
        JSON.stringify(
          {
            success: true,
            totalEscalated: totalCount,
            tickets,
          },
          null,
          2,
        ),
      );
      return;
    }

    // Mode 3: Selesaikan Tiket (--resolve)
    if (args.includes("--resolve")) {
      const idArg = args
        .find((a) => a.startsWith("--id="))
        ?.replace("--id=", "");
      if (!idArg) throw new Error("ID tiket wajib diisi (--id=...)");

      const updated = await prisma.supportTicket.update({
        where: { id: idArg },
        data: {
          status: "CLOSED",
          resolvedAt: new Date(),
        },
      });

      console.log(
        JSON.stringify(
          {
            success: true,
            message: "Tiket berhasil diselesaikan (CLOSED)",
            ticket: updated,
          },
          null,
          2,
        ),
      );
      return;
    }

    // Default: Status ringkasan CS
    const [totalTickets, resolvedCount, escalatedCount] = await Promise.all([
      prisma.supportTicket.count(),
      prisma.supportTicket.count({ where: { status: "RESOLVED_BY_AI" } }),
      prisma.supportTicket.count({ where: { status: "ESCALATED_TO_HUMAN" } }),
    ]);

    console.log(
      JSON.stringify(
        {
          success: true,
          stats: {
            totalTickets,
            resolvedByAI: resolvedCount,
            escalatedToHuman: escalatedCount,
          },
        },
        null,
        2,
      ),
    );
  } catch (error: any) {
    console.error(
      JSON.stringify({
        success: false,
        error: error?.message || String(error),
      }),
    );
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
