import { scrapeGoogleMaps } from "../scraper/gmaps";
import prisma from "../config/db";
import { sendTelegramNotification } from "../services/telegram"; // akan dibuat

// â”€â”€â”€ KONFIGURASI VERTIKAL & PRIORITAS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface VerticalConfig {
  keyword: string;
  category: string;
  priority: number; // 1 = highest
  cities: string[]; // kota target per vertikal
}

const VERTICALS: VerticalConfig[] = [
  // PRIORITAS 1: Healthcare & Clinic (Target: sadulur-care / Rekam Medis)
  { keyword: "klinik gigi", category: "HEALTHCARE", priority: 1, cities: [] },
  {
    keyword: "klinik kecantikan",
    category: "HEALTHCARE",
    priority: 1,
    cities: [],
  },
  { keyword: "apotek", category: "HEALTHCARE", priority: 1, cities: [] },
  {
    keyword: "klinik dokter hewan",
    category: "HEALTHCARE",
    priority: 1,
    cities: [],
  },

  // PRIORITAS 2: Hospitality & Premium Rental (Target: kasir-umkm Mode Rental/Booking)
  { keyword: "boutique hotel", category: "PROPERTY", priority: 2, cities: [] },
  { keyword: "villa resort", category: "PROPERTY", priority: 2, cities: [] },
  { keyword: "coworking space", category: "PROPERTY", priority: 2, cities: [] },
  { keyword: "rental kamera", category: "RENTAL", priority: 2, cities: [] },
  { keyword: "sewa alat berat", category: "RENTAL", priority: 2, cities: [] },

  // PRIORITAS 3: Premium Services / Jasa (Target: kasir-umkm Mode Servis/Antrian)
  { keyword: "car detailing", category: "SERVICE", priority: 3, cities: [] },
  { keyword: "spa massage", category: "SERVICE", priority: 3, cities: [] },
  {
    keyword: "barbershop premium",
    category: "SERVICE",
    priority: 3,
    cities: [],
  },
  {
    keyword: "wedding organizer",
    category: "SERVICE",
    priority: 3,
    cities: [],
  },

  // PRIORITAS 4: Fitness & Wellness (Target: purnama-gym)
  { keyword: "fitness center", category: "WELLNESS", priority: 4, cities: [] },
  { keyword: "studio yoga", category: "WELLNESS", priority: 4, cities: [] },

  // PRIORITAS 5: Premium F&B (Target: kasir-umkm Mode F&B - Meja & KDS)
  {
    keyword: "fine dining restaurant",
    category: "FNB",
    priority: 5,
    cities: [],
  },
  { keyword: "coffee shop roastery", category: "FNB", priority: 5, cities: [] },
  { keyword: "steakhouse", category: "FNB", priority: 5, cities: [] },

  // PRIORITAS 6: Modern Retail & Tech (Target: kasir-umkm Mode Retail)
  { keyword: "toko komputer", category: "RETAIL", priority: 6, cities: [] },
  { keyword: "vape store", category: "RETAIL", priority: 6, cities: [] },
  { keyword: "toko kamera", category: "RETAIL", priority: 6, cities: [] },
];

// â”€â”€â”€ EKSPANSI GEOGRAFIS (DARI SUMEDANG KE SELURUH INDONESIA) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CITY_EXPANSION_WAVES = {
  // Wave 1: Sumedang & sekitar (radius ~50km) - MINGGU 1-2
  wave1: [
    "Sumedang",
    "Bandung",
    "Cimahi",
    "Majalengka",
    "Cirebon",
    "Garut",
    "Tasikmalaya",
    "Cianjur",
    "Sukabumi",
    "Purwakarta",
  ],

  // Wave 2: Jawa Barat penuh - MINGGU 3-4
  wave2: [
    "Bekasi",
    "Depok",
    "Bogor",
    "Tangerang",
    "Jakarta",
    "Karawang",
    "Subang",
    "Indramayu",
    "Kuningan",
    "Banjar",
    "Pangandaran",
    "Ciamis",
    "Banjar",
  ],

  // Wave 3: Pulau Jawa - BULAN 2
  wave3: [
    "Semarang",
    "Solo",
    "Yogyakarta",
    "Magelang",
    "Pekalongan",
    "Surabaya",
    "Malang",
    "Sidoarjo",
    "Pasuruan",
    "Probolinggo",
    "Jember",
    "Banyuwangi",
    "Madiun",
    "Kediri",
    "Blitar",
  ],

  // Wave 4: Luar Jawa (metropolitan besar) - BULAN 3+
  wave4: [
    "Medan",
    "Padang",
    "Palembang",
    "Lampung",
    "Bengkulu",
    "Makassar",
    "Manado",
    "Balikpapan",
    "Samarinda",
    "Pontianak",
    "Banjarmasin",
    "Denpasar",
    "Mataram",
    "Kupang",
    "Ambon",
    "Jayapura",
  ],
};

// Flatten semua kota per wave
function getCitiesForWave(wave: number): string[] {
  if (wave === 1) return CITY_EXPANSION_WAVES.wave1;
  if (wave === 2)
    return [...CITY_EXPANSION_WAVES.wave1, ...CITY_EXPANSION_WAVES.wave2];
  if (wave === 3)
    return [
      ...CITY_EXPANSION_WAVES.wave1,
      ...CITY_EXPANSION_WAVES.wave2,
      ...CITY_EXPANSION_WAVES.wave3,
    ];
  return [
    ...CITY_EXPANSION_WAVES.wave1,
    ...CITY_EXPANSION_WAVES.wave2,
    ...CITY_EXPANSION_WAVES.wave3,
    ...CITY_EXPANSION_WAVES.wave4,
  ];
}

// â”€â”€â”€ STATE MANAGEMENT (persist ke DB) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function getScrapingState() {
  let state = await prisma.scrapingState.findFirst();
  if (!state) {
    state = await prisma.scrapingState.create({
      data: {
        currentWave: 1,
        currentVerticalIndex: 0,
        currentCityIndex: 0,
        lastRunAt: new Date(),
        totalScraped: 0,
        totalEmailsFound: 0,
        isRunning: false,
      },
    });
  }
  return state;
}

async function updateScrapingState(
  updates: Partial<{
    currentWave: number;
    currentVerticalIndex: number;
    currentCityIndex: number;
    lastRunAt: Date;
    totalScraped: number;
    totalEmailsFound: number;
    isRunning: boolean;
    lastError: string | null;
  }>,
) {
  await prisma.scrapingState.update({
    where: { id: (await getScrapingState()).id },
    data: updates,
  });
}

// â”€â”€â”€ MAIN ORCHESTRATOR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function runAutomatedScraping(
  limitPerRun: number = 15,
): Promise<{
  success: boolean;
  message: string;
  totalScraped?: number;
  emailsFound?: number;
}> {
  const state = await getScrapingState();

  if (state.isRunning) {
    console.log("â­ï¸ Scraping sudah berjalan, skip...");
    return {
      success: true,
      message: "Scraping sudah berjalan, skip",
      totalScraped: 0,
      emailsFound: 0,
    };
  }

  await updateScrapingState({ isRunning: true, lastError: null });

  try {
    const cities = getCitiesForWave(state.currentWave);
    const verticals = [...VERTICALS].sort((a, b) => a.priority - b.priority);

    // Hitung posisi saat ini
    let verticalIdx = state.currentVerticalIndex;
    let cityIdx = state.currentCityIndex;

    let totalThisRun = 0;
    let emailsThisRun = 0;

    console.log(
      `ðŸ¤– AUTO SCRAPE START | Wave: ${state.currentWave} | Vertical: ${verticals[verticalIdx]?.keyword} | City: ${cities[cityIdx]}`,
    );

    // Loop: coba vertical & city saat ini, kalau habis lanjut ke berikutnya
    while (totalThisRun < limitPerRun && verticalIdx < verticals.length) {
      const vertical = verticals[verticalIdx];

      while (totalThisRun < limitPerRun && cityIdx < cities.length) {
        const city = cities[cityIdx];
        const keyword = `${vertical.keyword} ${city}`;

        console.log(
          `ðŸ” Scraping: "${keyword}" (${totalThisRun + 1}/${limitPerRun})`,
        );

        try {
          // Scrape dengan limit sisa
          const remaining = limitPerRun - totalThisRun;
          await scrapeGoogleMaps(keyword, remaining, true); // headless true untuk auto

          // Cek hasil terbaru
          const recent = await prisma.prospect.findMany({
            where: {
              scrapedAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }, // 5 menit terakhir
              city: city,
            },
          });

          const newCount = recent.length;
          const emailCount = recent.filter((p) => p.email).length;

          totalThisRun += newCount;
          emailsThisRun += emailCount;

          console.log(
            `  âœ… ${newCount} prospek baru, ${emailCount} punya email`,
          );

          // Update state
          await updateScrapingState({
            totalScraped: state.totalScraped + newCount,
            totalEmailsFound: state.totalEmailsFound + emailCount,
          });
        } catch (err: any) {
          console.error(`  âŒ Error scraping ${keyword}:`, err.message);
          await updateScrapingState({
            lastError: `${keyword}: ${err.message}`,
          });
        }

        // Next city
        cityIdx++;
        await updateScrapingState({ currentCityIndex: cityIdx });
      }

      // Reset city index, next vertical
      cityIdx = 0;
      verticalIdx++;
      await updateScrapingState({
        currentVerticalIndex: verticalIdx,
        currentCityIndex: 0,
      });

      // Kalau vertical habis, next wave
      if (verticalIdx >= verticals.length) {
        verticalIdx = 0;
        const nextWave = state.currentWave + 1;
        if (nextWave <= 4) {
          await updateScrapingState({
            currentWave: nextWave,
            currentVerticalIndex: 0,
            currentCityIndex: 0,
          });
          console.log(
            `ðŸŒŠ NAIK WAVE ${nextWave}! Kota baru: ${getCitiesForWave(nextWave).length} kota`,
          );
          await sendTelegramNotification(
            `ðŸŒŠ *Wave ${nextWave} Started!*\n${getCitiesForWave(nextWave).length} kota aktif\nTotal prospek: ${state.totalScraped + totalThisRun}`,
          );
        } else {
          console.log("ðŸŽ‰ SEMUA WAVE SELESAI! Restart dari wave 1...");
          await updateScrapingState({
            currentWave: 1,
            currentVerticalIndex: 0,
            currentCityIndex: 0,
          });
          await sendTelegramNotification(
            `ðŸ”„ *Full Cycle Complete!*\nRestart dari Wave 1 (Sumedang)\nTotal lifetime: ${state.totalScraped + totalThisRun} prospek`,
          );
        }
        break;
      }
    }

    // Summary
    console.log(`\nðŸ“Š RUN SUMMARY:`);
    console.log(`  Prospek baru: ${totalThisRun}`);
    console.log(`  Email ditemukan: ${emailsThisRun}`);
    console.log(
      `  Wave: ${state.currentWave} | Vertical: ${verticalIdx}/${verticals.length} | City: ${cityIdx}/${cities.length}`,
    );

    return {
      success: true,
      message: `Scrape selesai: ${totalThisRun} prospek baru, ${emailsThisRun} email ditemukan`,
      totalScraped: totalThisRun,
      emailsFound: emailsThisRun,
    };
  } catch (err: any) {
    console.error("âŒ Fatal error:", err);
    await sendTelegramNotification(`âŒ *Auto Scrape Error*\n${err.message}`);
    await updateScrapingState({ lastError: err.message });
    return {
      success: false,
      message: `Fatal error: ${err.message}`,
      totalScraped: 0,
      emailsFound: 0,
    };
  } finally {
    await updateScrapingState({ isRunning: false, lastRunAt: new Date() });
  }
}

// â”€â”€â”€ CLI ENTRY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function main() {
  const args = process.argv.slice(2);
  let limit = 15;

  for (const arg of args) {
    if (arg.startsWith("--limit=")) {
      limit = parseInt(arg.replace("--limit=", ""), 10) || 15;
    }
  }

  await runAutomatedScraping(limit);
  process.exit(0);
}

const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith("auto-scrape.ts") ||
    process.argv[1].endsWith("auto-scrape.js"));

if (isDirectRun) {
  main().catch(console.error);
}
