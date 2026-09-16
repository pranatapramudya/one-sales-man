import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load .env dari root pjtech-autonomous & one-sales-man
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import Groq from 'groq-sdk';
import prisma from '../lib/prisma';

// Initialize Groq Client
const groqApiKey = process.env.GROQ_API_KEY || process.env.LLM_API_KEY;
const groq = new Groq({
    apiKey: groqApiKey,
});

const sessionDir = path.resolve(__dirname, '../../.wwebjs_auth');

// Global safety crash guard
process.on('uncaughtException', (err) => {
    console.error('❌ [WA CRITICAL UNCAUGHT]:', err?.message || err);
});
process.on('unhandledRejection', (reason) => {
    console.error('❌ [WA CRITICAL UNHANDLED]:', reason);
});

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const useSystemChrome = fs.existsSync(chromePath);

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
        executablePath: useSystemChrome ? chromePath : undefined,
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

let latestQr: string | undefined;
export function getLatestQr() {
    return latestQr;
}

whatsappClient.on('qr', (qr) => {
    latestQr = qr;
    console.log('QR Code Received. Scan it with your WhatsApp:');
    qrcode.generate(qr, { small: true });
    console.log(`[WA_QR] ${qr}`);
});

whatsappClient.on('ready', () => {
    latestQr = undefined;
    console.log('✅ WhatsApp Client is ready! AI Negotiator is listening for incoming messages...');
});

whatsappClient.on('disconnected', (reason) => {
    console.log('⚠️ WhatsApp Client disconnected. Reason:', reason);
});

// Helper kirim notifikasi darurat/hot lead ke Telegram
async function notifyTelegram(text: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_GROUP_ID || process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (!token || !chatId) return;
    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: 'Markdown'
            })
        });
    } catch (e: any) {
        console.warn('[AI Negotiator] Gagal kirim notif ke Telegram:', e?.message);
    }
}

// AI NEGOTIATOR LOGIC
const HANDOFF_TEXT = "Baik Kak, untuk detail teknis dan penawaran khusus akan langsung dibantu oleh Mas Pranata (Technical Lead kami). Sebentar ya Kak, saya teruskan ke beliau.";

whatsappClient.on('message', async (msg) => {
    // Abaikan pesan dari grup, status broadcast, atau pesan dari bot sendiri
    if (msg.from.includes('@g.us') || msg.from === 'status@broadcast' || msg.fromMe) return;

    try {
        // Normalisasi nomor pengirim dari "628xxx@c.us"
        const rawDigits = msg.from.replace('@c.us', '').replace(/\D/g, '');
        const senderNumber = '+' + rawDigits;
        const localFormat = rawDigits.startsWith('62') ? '0' + rawDigits.slice(2) : rawDigits;

        // Cari prospek di database (toleran berbagai format nomor)
        const prospect = await prisma.prospect.findFirst({
            where: {
                OR: [
                    { whatsappNumber: senderNumber },
                    { whatsappNumber: rawDigits },
                    { whatsappNumber: localFormat },
                    { whatsappNumber: { contains: rawDigits.slice(-9) } }
                ]
            }
        });

        const bizName = prospect?.businessName || 'Kak';

        // RULES: Jika status sudah HOT_LEAD atau CLOSED, jangan ditimpa AI agar Mas Pranata bisa handle manual
        if (prospect && (prospect.status === 'HOT_LEAD' || prospect.status === 'CLOSED')) {
            console.log(`[AI Negotiator] Pesan dari ${bizName} (${senderNumber}) diabaikan karena status sudah ${prospect.status} (dihandle langsung Mas Pranata).`);
            return;
        }

        console.log(`\n🤖 [AI Negotiator] Memproses pesan masuk dari ${bizName} (${senderNumber})`);
        console.log(`[User] : ${msg.body}`);

        const systemPrompt = `Anda adalah "Pranata / Tim Sales PJTech", asisten konsultan bisnis digital UMKM dari PJTECH.
Saat merespons klien di WhatsApp, gunakan gaya bahasa yang ramah, sopan, santai, dan solutif (khas chat bisnis WhatsApp Indonesia, bukan robot kaku).

PRODUK UTAMA KITA:
1. "PJTech Kasir UMKM" (https://pjtechumkm.com):
- Solusi kasir POS cloud multi-usaha (F&B kafe/resto, Toko retail/sembako, Jasa barbershop/salon/bengkel, dan Rental kendaraan/kos).
- Fitur: Cek stok HP, scan barcode kamera, cetak struk bluetooth, rekap omzet harian otomatis, hitung komisi karyawan.
- Harga: Coba GRATIS 14 Hari (Rp 0). Paket Pro 1 Tahun cuma Rp 82.500/bulan (Total Rp 990.000/tahun — cuma setara Rp 2.700/hari!).
- Arahkan ke link coba gratis: https://pjtechumkm.com

2. "PJTech Custom Apps & Web" (https://pranajayatech.online/):
- Jika ${bizName} butuh sistem khusus (antrean pasien klinik, absensi membership gym, kalender rental GPS, website custom).
- Portofolio: https://pranajayatech.online/

ATURAN HANDOFF (SANGAT PENTING):
Jika calon klien menunjukkan minat beli, meminta nomor rekening, menanyakan rincian harga mendalam, ingin jadwal meeting, atau tanya teknis spesifik, Anda WAJIB membalas dengan kalimat persis:
"${HANDOFF_TEXT}"
Jangan tambahkan kata lain jika handoff terpicu!`;

        // Panggil LLM: Coba Groq Qwen lebih dulu, jika gagal fallback ke Gemini Flash
        let aiResponse = '';
        if (groqApiKey) {
            try {
                const chatCompletion = await groq.chat.completions.create({
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: msg.body }
                    ],
                    model: 'qwen/qwen3.8-27b',
                    temperature: 0.6,
                    max_tokens: 500
                });
                aiResponse = chatCompletion.choices[0]?.message?.content?.trim() || '';
            } catch (groqErr: any) {
                console.warn('[AI Negotiator] Groq model error, mencoba fallback ke Gemini Flash:', groqErr?.message);
            }
        }

        if (!aiResponse && process.env.GEMINI_API_KEY) {
            try {
                const { GoogleGenerativeAI } = await import('@google/generative-ai');
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
                const geminiRes = await model.generateContent(`${systemPrompt}\n\nPesan Klien: "${msg.body}"\nBalasan Anda:`);
                aiResponse = geminiRes.response.text().trim();
            } catch (geminiErr: any) {
                console.error('[AI Negotiator] Gemini fallback error:', geminiErr?.message);
            }
        }

        if (!aiResponse) {
            aiResponse = `Halo Kak! Terima kasih sudah menghubungi tim PJTech. Untuk kebutuhan operasional kasir atau pembuatan sistem di ${bizName}, ada yang bisa kami bantu kak? Kakak juga bisa langsung coba gratis 14 hari di https://pjtechumkm.com ya kak 😊`;
        }

        // Random delay sebelum membalas (Anti-ban: 5s hingga 10s)
        const delay = Math.floor(Math.random() * 5000) + 5000;
        console.log(`[AI Negotiator] Menunggu ${delay / 1000} detik sebelum membalas ke ${bizName}...`);
        await new Promise(resolve => setTimeout(resolve, delay));

        // Balas pesan via WhatsApp
        await msg.reply(aiResponse);
        console.log(`[AI Balasan] : ${aiResponse}`);

        // Cek jika AI merespons dengan Handoff Trigger
        const isHandoff = aiResponse.includes("dibantu oleh Mas Pranata") || aiResponse.includes("saya teruskan");
        if (isHandoff) {
            console.log(`[🔥 HANDOFF] Trigger terdeteksi! Mengubah status ${bizName} menjadi HOT_LEAD.`);
            if (prospect) {
                await prisma.prospect.update({
                    where: { id: prospect.id },
                    data: { status: 'HOT_LEAD', lastContactedAt: new Date() }
                });
            }

            // Notifikasi Real-time ke Telegram Owner
            await notifyTelegram(
                `🔥 *[HOT LEAD WHATSAPP TERDETEKSI!]*\n\n` +
                `👤 *Bisnis:* ${bizName}\n` +
                `📱 *WhatsApp:* \`${senderNumber}\`\n` +
                `💬 *Pesan Klien:* "${msg.body}"\n` +
                `🤖 *Balasan AI:* "${aiResponse}"\n\n` +
                `⚡ *Segera follow up & closing deal!*\n` +
                `👉 [Buka Chat WhatsApp](https://wa.me/${rawDigits})`
            );
        } else {
            // Notifikasi info chat masuk ke Telegram (hanya log informatif)
            await notifyTelegram(
                `💬 *[WHATSAPP CHAT DARI KLIEN]*\n\n` +
                `👤 *Bisnis:* ${bizName} (\`${senderNumber}\`)\n` +
                `📥 *Pesan:* "${msg.body}"\n` +
                `🤖 *AI Menjawab:* "${aiResponse}"`
            ).catch(() => {});
        }

        // Catat percakapan ke database jika prospek ada
        if (prospect) {
            await prisma.outreachMessage.create({
                data: {
                    prospectId: prospect.id,
                    messageText: `[User]: ${msg.body}\n[AI]: ${aiResponse}`
                }
            }).catch(() => {});
        }

    } catch (error) {
        console.error('[AI Negotiator] Terjadi error saat memproses pesan masuk:', error);
    }
});

// Helper function to send initial cold messages with a random human-like delay
export async function sendColdMessage(number: string, text: string, mediaPath?: string): Promise<boolean> {
    try {
        let formattedNumber = number;
        if (!formattedNumber.endsWith('@c.us')) {
            formattedNumber = formattedNumber.replace('+', '').replace(/\D/g, '') + '@c.us';
        }

        // Random delay between 4s and 8s
        const delay = Math.floor(Math.random() * 4000) + 4000;
        console.log(`Waiting ${delay / 1000} seconds before sending message to ${formattedNumber}...`);
        await new Promise(resolve => setTimeout(resolve, delay));

        if (mediaPath) {
            const media = MessageMedia.fromFilePath(mediaPath);
            await whatsappClient.sendMessage(formattedNumber, media, { caption: text });
        } else {
            await whatsappClient.sendMessage(formattedNumber, text);
        }

        console.log(`✅ Message sent successfully to ${formattedNumber}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send message to ${number}:`, error);
        return false;
    }
}
