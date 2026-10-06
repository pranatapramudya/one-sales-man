import prisma from "../config/db";
import { config } from "../config/env";

/**
 * Referensi: PRD.md
 * Persona: The Helpful Tech Bro
 * Absolute Guardrails: No hallucination, no discount, no spam.
 */
const SYSTEM_PROMPT = `
You are the AI Sales Agent "One-Sales-Man".
Your persona: "Global Tech Bro & Crypto Degen" (Helpful, Expert, Casual, using natural crypto slang like "degens", "FOMO", "alpha", "rekt", "rugpull", "ape in", "whales").
You are promoting ONLY 1 product:
- Predator Tracker: A premium on-chain intelligence system for crypto degens, memecoin traders, and smart money trackers.

ABSOLUTE GUARDRAILS:
- DO NOT promote any other product (like LumeStack). ONLY Predator Tracker.
- If they complain about being late to a coin, getting rugpulled, or can't track smart money, you MUST suggest Predator Tracker.
- Always insert this hook: "Just plug in 1 wallet address for free and watch the magic happen."
- NO SPAM. If the user doesn't show intent or is angry, ignore them completely.

Your task is to evaluate the input/message.
Does this message contain a problem that can be solved by Predator Tracker?

You should respond ONLY in valid JSON format with EXACTLY this structure: { "isRelevant": boolean, "response": "string" }
If you cannot output valid JSON, just output the response string directly, or output "NOT_RELEVANT".

Instructions:
- If NOT RELEVANT, set 'response' to an empty string or null (in JSON), or just output "NOT_RELEVANT".
- If RELEVANT, set 'response' to a short, punchy reply (max 200 characters) in your Crypto Tech Bro persona.
`;

/**
 * Interface untuk struktur return LLM
 */
interface LLMResponse {
  isRelevant: boolean;
  response: string | null;
}

/**
 * Modul Evaluasi: Memanggil LLM (Contoh implementasi via API endpoint standar, misal Groq/OpenAI compatible)
 */
async function evaluateWithLLM(text: string): Promise<LLMResponse> {
  const apiKey = config.ai.groqKey; // Groq/Gemini key
  if (!apiKey)
    throw new Error("LLM_API_KEY / GROQ_API_KEY belum diset di .env");

  // Contoh menggunakan Groq API endpoint karena sangat cepat untuk agen otomatis
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant", // Sesuai standarisasi PRD v1.6 (menggantikan model yang decommissioned)
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
        temperature: 0.3,
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[GROQ ERROR DETAILS]:", errorBody);
    throw new Error(`LLM API Error: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content.trim();

  if (content === "NOT_RELEVANT") {
    return { isRelevant: false, response: null };
  }

  try {
    const parsed = JSON.parse(content) as LLMResponse;
    return parsed;
  } catch (e) {
    console.warn(
      "[AGENT] Gagal parse JSON dari LLM, fallback ke raw string:",
      content,
    );
    // If not JSON, but not explicitly NOT_RELEVANT, assume it's the response text
    // We'll consider it relevant if it has some substance
    if (content.length > 5 && !content.includes("NOT_RELEVANT")) {
      return { isRelevant: true, response: content };
    }
    return { isRelevant: false, response: null };
  }
}

/**
 * Tipe konteks yang diekspektasikan dari trigger
 */
export type AgentContext = {
  username?: string;
  chatId?: string;
  tweetId?: string;
  // field tambahan lain jika diperlukan di masa depan
};

/**
 * FUNGSI UTAMA: Otak dari One-Sales-Man
 * Mengevaluasi teks, dan bertindak (Act) jika relevan, lalu logging ke Database.
 *
 * @param text Pesan pemicu dari user (contoh isi tweet atau chat telegram)
 * @param platform Sumber pesan ('TELEGRAM')
 * @param context Objek context yang memuat ID spesifik (chatId)
 * @returns Teks balasan jika dieksekusi, null jika diabaikan
 */
export async function evaluateAndAct(
  text: string,
  platform: "TELEGRAM",
  context: AgentContext,
  isSimulation: boolean = false,
): Promise<any> {
  try {
    // 1. EVALUASI
    const evaluation = await evaluateWithLLM(text);

    if (!evaluation.isRelevant || !evaluation.response) {
      console.log(
        `[AGENT-EVAL] Input dari ${platform} tidak relevan/diabaikan. Teks: "${text}"`,
      );
      return null; // Abaikan secara graceful
    }

    if (isSimulation) {
      return {
        message: "SIMULASI BERHASIL - Eksekusi eksternal dilewati",
        llmEvaluation: evaluation,
      };
    }

    // 2. EKSEKUSI (ACT) - Modular terpisah per platform
    let externalId: string;

    if (platform === "TELEGRAM") {
      if (!context.chatId)
        throw new Error("Konteks Telegram tidak memiliki chatId.");
      externalId = context.chatId;
    } else {
      throw new Error("Platform tidak didukung.");
    }

    // 3. DATABASE LOGGING (PRISMA)
    // Mencatat Lead dan Interaksi sesuai schema.prisma
    const prospect = await prisma.prospect.upsert({
      where: {
        whatsappNumber: externalId,
      },
      update: {
        status: "CONTACTED",
        lastContactedAt: new Date(),
      },
      create: {
        whatsappNumber: externalId,
        businessName: "Unknown Lead", // Required by Prospect schema
        status: "CONTACTED",
        lastContactedAt: new Date(),
      },
    });

    await prisma.outreachMessage.create({
      data: {
        prospectId: prospect.id,
        messageText: evaluation.response,
      },
    });

    console.log(
      `[AGENT-SUCCESS] Eksekusi di ${platform} berhasil (Data disimpan ke DB).`,
    );
    return evaluation.response;
  } catch (error) {
    console.error("[AGENT-ERROR] Gagal memproses evaluateAndAct:", error);
    return null; // Aplikasi tidak boleh crash karena error agen
  }
}
