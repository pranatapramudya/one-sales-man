import dotenv from "dotenv";
import path from "path";

// Load .env from root
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const config = {
  database: {
    url: process.env.DATABASE_URL?.trim(),
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY?.trim(),
    fromEmail: process.env.RESEND_FROM_EMAIL?.trim() || "",
    appUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://pjtechumkm.com",
  },
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN?.trim(),
    chatId: process.env.TELEGRAM_CHAT_ID?.trim(),
  },
  outreach: {
    dailyLimit: parseInt(process.env.EMAIL_DAILY_LIMIT || "50", 10),
    delayMs: parseInt(process.env.EMAIL_DELAY_MS || "5000", 10),
  },
  ai: {
    groqKey:
      process.env.GROQ_API_KEY?.trim() || process.env.LLM_API_KEY?.trim(),
  },
};

export function validateEnv() {
  if (!config.database.url) {
    console.error("❌ FATAL: DATABASE_URL is missing in .env");
    process.exit(1);
  }
  if (!config.resend.apiKey) {
    console.error("❌ FATAL: RESEND_API_KEY is missing in .env");
    process.exit(1);
  }
  if (!config.telegram.token || !config.telegram.chatId) {
    console.warn(
      "⚠️ WARNING: Telegram credentials missing. Notifications will fail.",
    );
  }
}
