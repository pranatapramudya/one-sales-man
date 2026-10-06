import path from "path";
import fs from "fs";
import dotenv from "dotenv";

// Load .env dari root pjtech-autonomous & one-sales-man
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { Client, LocalAuth, MessageMedia } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import Groq from "groq-sdk";
import prisma from "../config/db";

// Initialize Groq Client
const groqApiKey = process.env.GROQ_API_KEY || process.env.LLM_API_KEY;
const groq = new Groq({
  apiKey: groqApiKey,
});

const sessionDir = path.resolve(__dirname, "../../.wwebjs_auth");

// Global safety crash guard
process.on("uncaughtException", (err) => {
  console.error("❌ [WA CRITICAL UNCAUGHT]:", err?.message || err);
});
process.on("unhandledRejection", (reason) => {
  console.error("❌ [WA CRITICAL UNHANDLED]:", reason);
});

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const useSystemChrome = fs.existsSync(chromePath);

// Initialize the WhatsApp Client
export const whatsappClient = new Client({
  authStrategy: new LocalAuth({
    dataPath: sessionDir,
  }),
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
  webVersionCache: {
    type: "local",
  },
  puppeteer: {
    headless: true,
    executablePath: useSystemChrome ? chromePath : undefined,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
      "--disable-blink-features=AutomationControlled",
    ],
  },
});

let latestQr: string | undefined;
export function getLatestQr() {
  return latestQr;
}

whatsappClient.on("qr", (qr) => {
  latestQr = qr;
  console.log("QR Code Received. Scan it with your WhatsApp:");
  qrcode.generate(qr, { small: true });
  console.log(`[WA_QR] ${qr}`);
});

whatsappClient.on("ready", () => {
  latestQr = undefined;
  console.log(
    "✅ WhatsApp Client is ready! AI Negotiator is listening for incoming messages...",
  );
});

whatsappClient.on("disconnected", (reason) => {
  console.log("⚠️ WhatsApp Client disconnected. Reason:", reason);
});

// Helper kirim notifikasi darurat/hot lead ke Telegram
async function notifyTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId =
    process.env.TELEGRAM_GROUP_ID || process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
    });
  } catch (e: any) {
    console.warn("[AI Negotiator] Gagal kirim notif ke Telegram:", e?.message);
  }
}

// ── AI CHAT NONAKTIF (DIMATIKAN) ─────────────────────────────────────────────
// Cold outreach = 1x saja. Tidak ada auto-reply apapun.
// Kalau ada balasan masuk → notif Telegram ke Mas Pranata untuk follow up manual.

whatsappClient.on("message", async (msg) => {
  // Abaikan pesan dari grup, status broadcast, atau pesan dari bot sendiri
  if (
    msg.from.includes("@g.us") ||
    msg.from === "status@broadcast" ||
    msg.fromMe
  )
    return;

  // whatsapp-web.js kadang memancarkan event kosong saat pesan outbound tersinkron
  // pada perangkat lain. Itu bukan balasan prospek dan tidak perlu diteruskan.
  if (!msg.body?.trim()) return;

  try {
    // Normalisasi nomor pengirim dari "628xxx@c.us"
    const rawDigits = msg.from.replace("@c.us", "").replace(/\D/g, "");
    const senderNumber = "+" + rawDigits;
    const localFormat = rawDigits.startsWith("62")
      ? "0" + rawDigits.slice(2)
      : rawDigits;

    // Cari prospek di database
    const prospect = await prisma.prospect.findFirst({
      where: {
        OR: [
          { whatsappNumber: senderNumber },
          { whatsappNumber: rawDigits },
          { whatsappNumber: localFormat },
          { whatsappNumber: { contains: rawDigits.slice(-9) } },
        ],
      },
    });

    const bizName = prospect?.businessName || "Unknown";

    // LOG SAJA — tidak ada balasan apapun ke WA
    console.log(
      `[WA INCOMING] ⛔ AI NONAKTIF. Pesan dari ${bizName} (${senderNumber}): "${msg.body?.slice(0, 80)}"`,
    );

    // Notif Telegram ke Mas Pranata untuk follow up manual
    await notifyTelegram(
      `📩 *[BALASAN WA MASUK — FOLLOW UP MANUAL]*\n\n` +
        `👤 *Bisnis:* ${bizName} (\`${senderNumber}\`)\n` +
        `📥 *Pesan:* "${msg.body}"\n` +
        `🏷️ *Status DB:* ${prospect?.status || "Tidak dikenal"}\n\n` +
        `👉 [Balas di WhatsApp](https://wa.me/${rawDigits})`,
    ).catch(() => {});
  } catch (error) {
    console.error("[WA INCOMING] Error:", error);
  }
});

// Helper function to send initial cold messages with a random human-like delay
export async function sendColdMessage(
  number: string,
  text: string,
  mediaPath?: string,
): Promise<boolean> {
  try {
    let formattedNumber = number;
    if (!formattedNumber.endsWith("@c.us")) {
      formattedNumber =
        formattedNumber.replace("+", "").replace(/\D/g, "") + "@c.us";
    }

    // Random delay between 4s and 8s
    const delay = Math.floor(Math.random() * 4000) + 4000;
    console.log(
      `Waiting ${delay / 1000} seconds before sending message to ${formattedNumber}...`,
    );
    await new Promise((resolve) => setTimeout(resolve, delay));

    if (mediaPath) {
      const media = MessageMedia.fromFilePath(mediaPath);
      await whatsappClient.sendMessage(formattedNumber, media, {
        caption: text,
      });
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
