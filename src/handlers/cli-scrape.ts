import "dotenv/config";
import { scrapeGoogleMaps } from "../scraper/gmaps";
import prisma from "../config/db";

// Usage: npx tsx src/pipeline/cli-scrape.ts --keyword="Klinik di Sumedang" --limit=10 --headless=true
async function main() {
  const args = process.argv.slice(2);
  let keyword = "Klinik di Sumedang";
  let limit = 10;
  let headless = true;

  for (const arg of args) {
    if (arg.startsWith("--keyword=")) {
      keyword = arg.replace("--keyword=", "").trim();
    } else if (arg.startsWith("--limit=")) {
      limit = parseInt(arg.replace("--limit=", "").trim(), 10) || 10;
    } else if (arg.startsWith("--headless=")) {
      headless = arg.replace("--headless=", "").trim() === "true";
    }
  }

  console.log(
    `[CLI_SCRAPE_START] Keyword: "${keyword}" | Limit: ${limit} | Headless: ${headless}`,
  );

  try {
    await scrapeGoogleMaps(keyword, limit, headless);
    console.log(
      `[CLI_SCRAPE_SUCCESS] Selesai melakukan scraping untuk "${keyword}".`,
    );
    process.exit(0);
  } catch (err: any) {
    console.error(`[CLI_SCRAPE_ERROR] ${err?.message || err}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
