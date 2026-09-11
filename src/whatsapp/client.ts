import path from 'path';
import 'dotenv/config';
import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import Groq from 'groq-sdk';
import prisma from '../lib/prisma';

// Initialize Groq Client
const groq = new Groq({
    apiKey: process.env.LLM_API_KEY,
});

const sessionDir = path.resolve(__dirname, '../../.wwebjs_auth');

// Initialize the WhatsApp Client
export const whatsappClient = new Client({
    authStrategy: new LocalAuth({
        dataPath: sessionDir
    }),
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
    webVersionCache: {
        type: 'local',
    },
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-blink-features=AutomationControlled'
        ],
    }
});

whatsappClient.on('qr', (qr) => {
    console.log('QR Code Received. Scan it with your WhatsApp:');
    qrcode.generate(qr, { small: true });
    console.log(`[WA_QR] ${qr}`);
});

whatsappClient.on('ready', () => {
    console.log('WhatsApp Client is ready! AI Negotiator is listening for incoming messages...');
});

whatsappClient.on('disconnected', (reason) => {
    console.log('WhatsApp Client disconnected. Reason:', reason);
});

// AI NEGOTIATOR LOGIC
const HANDOFF_TEXT = "Baik Kak, untuk detail teknis dan eksekusi akan langsung dibantu oleh Mas Pranata (Technical Lead kami). Sebentar ya Kak, saya teruskan.";

whatsappClient.on('message', async (msg) => {
    // Abaikan pesan dari grup atau status broadcast
    if (msg.from.includes('@g.us') || msg.from === 'status@broadcast') return;

    try {
        // Normalisasi nomor pengirim dari "628xxx@c.us" menjadi "+628xxx"
        const senderNumber = '+' + msg.from.replace('@c.us', '');

        // Cari status prospek di database
        const prospect = await prisma.prospect.findUnique({
            where: { whatsappNumber: senderNumber }
        });

        // RULES: AI HANYA membalas jika status prospek adalah CONTACTED
        if (!prospect || prospect.status !== 'CONTACTED') {
            return; // Abaikan pesan (misal status sudah HOT_LEAD atau CLOSED)
        }

        console.log(`\n[AI Negotiator] Memproses pesan dari ${prospect.businessName} (${senderNumber})`);
        console.log(`[User] : ${msg.body}`);

        const systemPrompt = `Anda adalah representatif sales dari PJTECH. Saat merespons klien, gunakan gaya bahasa yang ramah, santai, sopan, namun profesional khas WhatsApp. Lakukan diagnosa masalah mereka terlebih dahulu.

KITA MEMILIKI DUA SOLUSI UTAMA TERGANTUNG KEBUTUHAN KLIEN:

1. SOLUSI SAAS KASIR UMKM SIAP PAKAI (https://pjtechumkm.com):
Cocok untuk operasional F&B (kafe/resto), Retail (toko/kelontong), Jasa (salon/barbershop/bengkel), dan Rental (mobil/kos).
Pilihan Paket Langganan di pjtechumkm.com:
- Free Trial 14 Hari (Rp 0): Coba gratis seluruh fitur kasir POS tanpa risiko dan tanpa biaya apa pun.
- Pro 1 Bulan: Rp 129.000 / bulan (untuk mencoba fitur lengkap kasir pintar & manajemen stok).
- Pro 6 Bulan: Rp 99.000 / bulan (Total: Rp 594.000 / 6 bulan).
- Pro 1 Tahun (Paling Hemat): Rp 82.500 / bulan (Total: Rp 990.000 / tahun - Hemat Rp 558.000!).
Tawarkan link resmi https://pjtechumkm.com jika mereka ingin mencoba Free Trial 14 Hari atau melihat demo sistemnya.

2. SOLUSI CUSTOM APPS & WEB DEVELOPMENT (https://www.pranajayatech.online/):
Jika ${prospect.businessName} memiliki kebutuhan sistem yang unik/kompleks (misal: sistem rekam medis & antrean klinik dokter, sistem barcode membership & absensi gym, integrasi kalender rental kendaraan dengan GPS, atau website profil bisnis eksklusif), sampaikan bahwa PJTECH Agency siap membuatkan sistem atau website kustom sesuai kebutuhan mereka.
Arahkan mereka untuk melihat portofolio di: https://www.pranajayatech.online/

ATURAN HANDOFF SANGAT PENTING:
Jika klien menunjukkan intensi berikut:
- Mau beli / berminat
- Minta rincian harga detail
- Mengajak ketemuan (meeting offline/online)
- Bertanya pertanyaan teknis yang rumit
Maka Anda WAJIB membalas HANYA dengan persis kalimat di bawah ini:
"${HANDOFF_TEXT}"
Jangan pernah tambahkan kalimat lain jika kondisi ini terpenuhi!`;

        // Panggil Groq API dengan Llama3
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: msg.body }
            ],
            model: 'llama3-70b-8192', // Menggunakan model besar agar reasoning Handoff lebih tajam
            temperature: 0.6,
            max_tokens: 500
        });

        const aiResponse = chatCompletion.choices[0]?.message?.content?.trim() || "Maaf Kak, sistem kami sedang ada gangguan sebentar.";

        // Random delay sebelum membalas (Anti-ban: 5s hingga 10s)
        const delay = Math.floor(Math.random() * 5000) + 5000;
        console.log(`[AI Negotiator] Menunggu ${delay / 1000} detik sebelum membalas...`);
        await new Promise(resolve => setTimeout(resolve, delay));

        // Balas pesan
        await msg.reply(aiResponse);
        console.log(`[AI] : ${aiResponse}`);

        // Cek jika AI merespons dengan Handoff Trigger
        if (aiResponse.includes("dibantu oleh Mas Pranata")) {
            console.log(`[🔥 HANDOFF] Trigger terdeteksi! Mengubah status ${prospect.businessName} menjadi HOT_LEAD.`);
            await prisma.prospect.update({
                where: { id: prospect.id },
                data: { status: 'HOT_LEAD' }
            });
        }

        // Catat percakapan ke database untuk log
        await prisma.outreachMessage.create({
            data: {
                prospectId: prospect.id,
                messageText: `[User]: ${msg.body}\n[AI]: ${aiResponse}`
            }
        });

    } catch (error) {
        console.error('[AI Negotiator] Terjadi error:', error);
    }
});


// Helper function to send initial cold messages with a random human-like delay
export async function sendColdMessage(number: string, text: string, mediaPath?: string): Promise<boolean> {
    try {
        let formattedNumber = number;
        if (!formattedNumber.endsWith('@c.us')) {
            formattedNumber = formattedNumber.replace('+', '') + '@c.us';
        }

        // Random delay between 5s and 15s
        const delay = Math.floor(Math.random() * 10000) + 5000;
        console.log(`Waiting ${delay / 1000} seconds before sending cold message to ${formattedNumber}...`);

        await new Promise(resolve => setTimeout(resolve, delay));

        if (mediaPath) {
            const media = MessageMedia.fromFilePath(mediaPath);
            await whatsappClient.sendMessage(formattedNumber, media, { caption: text });
        } else {
            await whatsappClient.sendMessage(formattedNumber, text);
        }

        console.log(`Cold message sent successfully to ${formattedNumber}`);
        return true;
    } catch (error) {
        console.error(`Failed to send message to ${number}:`, error);
        return false;
    }
}
