import { config } from "../config/env";

const BOT_TOKEN = config.telegram.token;
const CHAT_ID = config.telegram.chatId;

if (!BOT_TOKEN || !CHAT_ID) {
  console.warn(
    "⚠️ Telegram not configured: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing",
  );
}

export async function sendTelegramNotification(
  message: string,
): Promise<boolean> {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.log("[Telegram] Not configured, skipping:", message.slice(0, 100));
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      console.error("[Telegram] Failed:", data.description);
      return false;
    }

    return true;
  } catch (err: any) {
    console.error("[Telegram] Error:", err.message);
    return false;
  }
}

export async function sendTelegramDocument(
  filePath: string,
  caption: string = "",
): Promise<boolean> {
  if (!BOT_TOKEN || !CHAT_ID) return false;

  try {
    const fs = await import("fs");
    const formData = new FormData();
    formData.append("chat_id", CHAT_ID);
    formData.append(
      "document",
      new Blob([fs.readFileSync(filePath)]),
      filePath.split("/").pop(),
    );
    if (caption) formData.append("caption", caption);

    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`;
    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    return response.ok;
  } catch (err: any) {
    console.error("[Telegram Document] Error:", err.message);
    return false;
  }
}
