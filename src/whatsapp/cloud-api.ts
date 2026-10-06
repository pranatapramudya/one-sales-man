import axios from "axios";
import prisma from "../config/db";

const API_VERSION = process.env.WA_API_VERSION || "v20.0";
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;
const PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WA_CLOUD_API_TOKEN;

if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
  console.warn(
    "[WA Cloud API] ⚠️ WA_PHONE_NUMBER_ID or WA_CLOUD_API_TOKEN not set in .env",
  );
}

const headers = {
  Authorization: `Bearer ${ACCESS_TOKEN}`,
  "Content-Type": "application/json",
};

/**
 * Send a template message (required for first contact / outside 24h window)
 */
export async function sendTemplate(
  to: string,
  templateName: string,
  params: string[] = [],
  languageCode: string = "id",
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    return { success: false, error: "Missing credentials" };
  }

  try {
    const formattedTo = formatPhoneNumber(to);

    const components =
      params.length > 0
        ? [
            {
              type: "body",
              parameters: params.map((p) => ({ type: "text", text: p })),
            },
          ]
        : [];

    const response = await axios.post(
      `${BASE_URL}/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: formattedTo,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      },
      { headers, timeout: 10000 },
    );

    const messageId = response.data.messages?.[0]?.id;
    console.log(
      `✅ [WA Cloud] Template "${templateName}" sent to ${formattedTo} (ID: ${messageId})`,
    );
    return { success: true, messageId };
  } catch (error: any) {
    const errMsg = error.response?.data?.error?.message || error.message;
    console.error(`❌ [WA Cloud] Template send failed to ${to}:`, errMsg);
    return { success: false, error: errMsg };
  }
}

/**
 * Send a free-form text message (within 24h customer care window)
 */
export async function sendText(
  to: string,
  text: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    return { success: false, error: "Missing credentials" };
  }

  try {
    const formattedTo = formatPhoneNumber(to);

    const response = await axios.post(
      `${BASE_URL}/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: formattedTo,
        type: "text",
        text: { body: text },
      },
      { headers, timeout: 10000 },
    );

    const messageId = response.data.messages?.[0]?.id;
    console.log(`✅ [WA Cloud] Text sent to ${formattedTo} (ID: ${messageId})`);
    return { success: true, messageId };
  } catch (error: any) {
    const errMsg = error.response?.data?.error?.message || error.message;
    console.error(`❌ [WA Cloud] Text send failed to ${to}:`, errMsg);
    return { success: false, error: errMsg };
  }
}

/**
 * Send media message (image, document, video)
 */
export async function sendMedia(
  to: string,
  mediaType: "image" | "document" | "video",
  mediaUrl: string,
  caption?: string,
  filename?: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    return { success: false, error: "Missing credentials" };
  }

  try {
    const formattedTo = formatPhoneNumber(to);

    const mediaPayload: any = {
      messaging_product: "whatsapp",
      to: formattedTo,
      type: mediaType,
      [mediaType]: { link: mediaUrl },
    };

    if (caption) mediaPayload[mediaType].caption = caption;
    if (filename && mediaType === "document")
      mediaPayload[mediaType].filename = filename;

    const response = await axios.post(
      `${BASE_URL}/${PHONE_NUMBER_ID}/messages`,
      mediaPayload,
      { headers, timeout: 15000 },
    );

    const messageId = response.data.messages?.[0]?.id;
    console.log(
      `✅ [WA Cloud] ${mediaType} sent to ${formattedTo} (ID: ${messageId})`,
    );
    return { success: true, messageId };
  } catch (error: any) {
    const errMsg = error.response?.data?.error?.message || error.message;
    console.error(`❌ [WA Cloud] Media send failed to ${to}:`, errMsg);
    return { success: false, error: errMsg };
  }
}

/**
 * Mark message as read (send read receipt)
 */
export async function markAsRead(messageId: string): Promise<boolean> {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) return false;

  try {
    await axios.post(
      `${BASE_URL}/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      },
      { headers, timeout: 5000 },
    );
    return true;
  } catch (error: any) {
    console.warn("[WA Cloud] Mark as read failed:", error.message);
    return false;
  }
}

/**
 * Get message status (delivery receipt)
 */
export async function getMessageStatus(messageId: string): Promise<any> {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) return null;

  try {
    const response = await axios.get(`${BASE_URL}/${messageId}`, {
      headers,
      timeout: 5000,
      params: { fields: "status,timestamp" },
    });
    return response.data;
  } catch (error: any) {
    console.warn("[WA Cloud] Get status failed:", error.message);
    return null;
  }
}

/**
 * Format phone number to WhatsApp Cloud API format (E.164 without +)
 * Input: "085723256427" or "+6285723256427" or "6285723256427"
 * Output: "6285723256427"
 */
export function formatPhoneNumber(input: string): string {
  let cleaned = input.replace(/\D/g, ""); // Remove non-digits

  // Handle Indonesian numbers
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.slice(1); // 0857... -> 62857...
  } else if (cleaned.startsWith("8")) {
    cleaned = "62" + cleaned; // 857... -> 62857...
  } else if (!cleaned.startsWith("62")) {
    cleaned = "62" + cleaned; // fallback
  }

  return cleaned;
}

/**
 * Parse incoming webhook payload
 */
export function parseWebhookPayload(body: any): {
  messages: Array<{
    id: string;
    from: string;
    timestamp: string;
    type: string;
    text?: { body: string };
    interactive?: any;
    button?: any;
  }>;
  statuses: Array<{
    id: string;
    status: "sent" | "delivered" | "read" | "failed";
    timestamp: string;
    recipient_id: string;
  }>;
  contacts: Array<{ profile: { name: string }; wa_id: string }>;
} {
  const messages: any[] = [];
  const statuses: any[] = [];
  const contacts: any[] = [];

  try {
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value) return { messages, statuses, contacts };

    // Parse contacts
    if (value.contacts) {
      contacts.push(...value.contacts);
    }

    // Parse messages
    if (value.messages) {
      for (const msg of value.messages) {
        messages.push({
          id: msg.id,
          from: msg.from,
          timestamp: msg.timestamp,
          type: msg.type,
          text: msg.text,
          interactive: msg.interactive,
          button: msg.button,
        });
      }
    }

    // Parse statuses (delivery receipts)
    if (value.statuses) {
      for (const status of value.statuses) {
        statuses.push({
          id: status.id,
          status: status.status,
          timestamp: status.timestamp,
          recipient_id: status.recipient_id,
        });
      }
    }
  } catch (error) {
    console.error("[WA Cloud] Parse webhook error:", error);
  }

  return { messages, statuses, contacts };
}

/**
 * Verify webhook signature (for security)
 * Meta sends X-Hub-Signature-256 header
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  appSecret: string,
): boolean {
  const crypto = require("crypto");
  const expectedSignature = crypto
    .createHmac("sha256", appSecret)
    .update(payload)
    .digest("hex");

  return `sha256=${expectedSignature}` === signature;
}

export { BASE_URL, PHONE_NUMBER_ID };
