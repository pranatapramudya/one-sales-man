import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, ".env") });

import { sendEmail, buildEmailTemplate } from "./src/services/resend";

async function run() {
  const emailTo = "pranajaya52@gmail.com";

  const testCases = [
    {
      cat: "HEALTHCARE",
      name: "Klinik Gigi Sehat",
      feature: "rekap data pasien dan antrian dokter",
    },
    {
      cat: "WELLNESS",
      name: "Studio Yoga Bugar",
      feature: "catat masa aktif member dan jadwal kelas",
    },
  ];

  for (const tc of testCases) {
    const { subject, html, text, fromName } = buildEmailTemplate(
      tc.name,
      tc.cat,
      tc.feature,
      `https://pranajayatech.online/unsubscribe`,
    );

    console.log(`Sending: ${subject}`);
    await sendEmail({
      to: emailTo,
      subject,
      html,
      text,
      fromName,
      tags: [{ name: "test", value: tc.cat.toLowerCase() }],
    });
  }
}

run().catch(console.error);
