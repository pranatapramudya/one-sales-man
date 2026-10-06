import dotenv from "dotenv";
import path from "path";
import { config } from "./env";

import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import ws from "ws";

// Wajib untuk environment Node.js
neonConfig.webSocketConstructor = ws;

const connectionString = config.database.url;

if (!connectionString) {
  throw new Error("DATABASE_URL tidak ditemukan! Pastikan .env sudah diload.");
}

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

export default prisma;
