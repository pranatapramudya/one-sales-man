import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { scrapeGoogleMaps } from '../scraper/gmaps';
import prisma from '../lib/prisma';
import { sendTelegramNotification } from '../lib/telegram'; // akan dibuat

// ─── KONFIGURASI VERTIKAL & PRIORITAS ────────────────────────────────────────
interface VerticalConfig {
  keyword: string;
  category: string;
  priority: number; // 1 = highest
  cities: string[]; // kota target per vertikal
}

const VERTICALS: VerticalConfig[] = [
  // PRIORITAS 1: Rental/Travel/Properti (margin tinggi, butuh email)
  { keyword: 'rental mobil', category: 'RENTAL', priority: 1, cities: [] },
  { keyword: 'sewa motor', category: 'RENTAL', priority: 1, cities: [] },
  { keyword: 'travel agent', category: 'TRAVEL', priority: 1, cities: [] },
  { keyword: 'kost putra', category: 'PROPERTY', priority: 1, cities: [] },
  { keyword: 'kost putri', category: 'PROPERTY', priority: 1, cities: [] },
  { keyword: 'villa sewa', category: 'PROPERTY', priority: 1, cities: [] },
  
  // PRIORITAS 2: F&B (volume tinggi, butuh WA untuk followup)
  { keyword: 'warung makan', category: 'FNB', priority: 2, cities: [] },
  { keyword: 'rumah makan', category: 'FNB', priority: 2, cities: [] },
  { keyword: 'cafe', category: 'FNB', priority: 2, cities: [] },
  { keyword: 'bakso', category: 'FNB', priority: 2, cities: [] },
  { keyword: 'mie ayam', category: 'FNB', priority: 2, cities: [] },
  { keyword: 'nasi goreng', category: 'FNB', priority: 2, cities: [] },
  
  // PRIORITAS 3: Jasa/Servis (recurring revenue)
  { keyword: 'bengkel motor', category: 'SERVICE', priority: 3, cities: [] },
  { keyword: 'bengkel mobil', category: 'SERVICE', priority: 3, cities: [] },
  { keyword: 'laundry kiloan', category: 'SERVICE', priority: 3, cities: [] },
  { keyword: 'salun kecantikan', category: 'SERVICE', priority: 3, cities: [] },
  { keyword: 'service ac', category: 'SERVICE', priority: 3, cities: [] },
  { keyword: 'service kulkas', category: 'SERVICE', priority: 3, cities: [] },
  
  // PRIORITAS 4: Retail (kompetisi ketat, margin tipis)
  { keyword: 'toko kelontong', category: 'RETAIL', priority: 4, cities: [] },
  { keyword: 'minimarket', category: 'RETAIL', priority: 4, cities: [] },
  { keyword: 'toko baju', category: 'RETAIL', priority: 4, cities: [] },
  { keyword: 'toko sepatu', category: 'RETAIL', priority: 4, cities: [] },
];

// ─── EKSPANSI GEOGRAFIS (DARI SUMEDANG KE SELURUH INDONESIA) ─────────────────
const CITY_EXPANSION_WAVES = {
  // Wave 1: Sumedang & sekitar (radius ~50km) - MINGGU 1-2
  wave1: [
    'Sumedang', 'Bandung', 'Cimahi', 'Majalengka', 'Cirebon',
    'Garut', 'Tasikmalaya', 'Cianjur', 'Sukabumi', 'Purwakarta'
  ],
  
  // Wave 2: Jawa Barat penuh - MINGGU 3-4
  wave2: [
    'Bekasi', 'Depok', 'Bogor', 'Tangerang', 'Jakarta',
    'Karawang', 'Subang', 'Indramayu', 'Kuningan', 'Banjar',
    'Pangandaran', 'Ciamis', 'Banjar'
  ],
  
  // Wave 3: Pulau Jawa - BULAN 2
  wave3: [
    'Semarang', 'Solo', 'Yogyakarta', 'Magelang', 'Pekalongan',
    'Surabaya', 'Malang', 'Sidoarjo', 'Pasuruan', 'Probolinggo',
    'Jember', 'Banyuwangi', 'Madiun', 'Kediri', 'Blitar'
  ],
  
  // Wave 4: Luar Jawa (metropolitan besar) - BULAN 3+
  wave4: [
    'Medan', 'Padang', 'Palembang', 'Lampung', 'Bengkulu',
    'Makassar', 'Manado', 'Balikpapan', 'Samarinda', 'Pontianak',
    'Banjarmasin', 'Denpasar', 'Mataram', 'Kupang', 'Ambon', 'Jayapura'
  ]
};

// Flatten semua kota per wave
function getCitiesForWave(wave: number): string[] {
  if (wave === 1) return CITY_EXPANSION_WAVES.wave1;
  if (wave === 2) return [...CITY_EXPANSION_WAVES.wave1, ...CITY_EXPANSION_WAVES.wave2];
  if (wave === 3) return [...CITY_EXPANSION_WAVES.wave1, ...CITY_EXPANSION_WAVES.wave2, ...CITY_EXPANSION_WAVES.wave3];
  return [...CITY_EXPANSION_WAVES.wave1, ...CITY_EXPANSION_WAVES.wave2, ...CITY_EXPANSION_WAVES.wave3, ...CITY_EXPANSION_WAVES.wave4];
}

// ─── STATE MANAGEMENT (persist ke DB) ────────────────────────────────────────
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
        isRunning: false
      }
    });
  }
  return state;
}

async function updateScrapingState(updates: Partial<{
  currentWave: number;
  currentVerticalIndex: number;
  currentCityIndex: number;
  lastRunAt: Date;
  totalScraped: number;
  totalEmailsFound: number;
  isRunning: boolean;
  lastError: string | null;
}>) {
  await prisma.scrapingState.update({
    where: { id: (await getScrapingState()).id },
    data: updates
  });
}

// ─── MAIN ORCHESTRATOR ───────────────────────────────────────────────────────
export async function runAutomatedScraping(limitPerRun: number = 15) {
  const state = await getScrapingState();
  
  if (state.isRunning) {
    console.log('⏭️ Scraping sudah berjalan, skip...');
    return;
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
    
    console.log(`🤖 AUTO SCRAPE START | Wave: ${state.currentWave} | Vertical: ${verticals[verticalIdx]?.keyword} | City: ${cities[cityIdx]}`);
    
    // Kirim notif Telegram mulai
    await sendTelegramNotification(`🤖 *Auto Scrape Started*\nWave: ${state.currentWave}\nTarget: ${verticals[verticalIdx]?.keyword} di ${cities[cityIdx]}\nLimit: ${limitPerRun}`);
    
    // Loop: coba vertical & city saat ini, kalau habis lanjut ke berikutnya
    while (totalThisRun < limitPerRun && verticalIdx < verticals.length) {
      const vertical = verticals[verticalIdx];
      
      while (totalThisRun < limitPerRun && cityIdx < cities.length) {
        const city = cities[cityIdx];
        const keyword = `${vertical.keyword} ${city}`;
        
        console.log(`🔍 Scraping: "${keyword}" (${totalThisRun + 1}/${limitPerRun})`);
        
        try {
          // Scrape dengan limit sisa
          const remaining = limitPerRun - totalThisRun;
          await scrapeGoogleMaps(keyword, remaining, true); // headless true untuk auto
          
          // Cek hasil terbaru
          const recent = await prisma.prospect.findMany({
            where: { 
              scrapedAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }, // 5 menit terakhir
              city: city
            }
          });
          
          const newCount = recent.length;
          const emailCount = recent.filter(p => p.email).length;
          
          totalThisRun += newCount;
          emailsThisRun += emailCount;
          
          console.log(`  ✅ ${newCount} prospek baru, ${emailCount} punya email`);
          
          // Update state
          await updateScrapingState({
            totalScraped: state.totalScraped + newCount,
            totalEmailsFound: state.totalEmailsFound + emailCount
          });
          
        } catch (err: any) {
          console.error(`  ❌ Error scraping ${keyword}:`, err.message);
          await updateScrapingState({ lastError: `${keyword}: ${err.message}` });
        }
        
        // Next city
        cityIdx++;
        await updateScrapingState({ currentCityIndex: cityIdx });
      }
      
      // Reset city index, next vertical
      cityIdx = 0;
      verticalIdx++;
      await updateScrapingState({ currentVerticalIndex: verticalIdx, currentCityIndex: 0 });
      
      // Kalau vertical habis, next wave
      if (verticalIdx >= verticals.length) {
        verticalIdx = 0;
        const nextWave = state.currentWave + 1;
        if (nextWave <= 4) {
          await updateScrapingState({ currentWave: nextWave, currentVerticalIndex: 0, currentCityIndex: 0 });
          console.log(`🌊 NAIK WAVE ${nextWave}! Kota baru: ${getCitiesForWave(nextWave).length} kota`);
          await sendTelegramNotification(`🌊 *Wave ${nextWave} Started!*\n${getCitiesForWave(nextWave).length} kota aktif\nTotal prospek: ${state.totalScraped + totalThisRun}`);
        } else {
          console.log('🎉 SEMUA WAVE SELESAI! Restart dari wave 1...');
          await updateScrapingState({ currentWave: 1, currentVerticalIndex: 0, currentCityIndex: 0 });
          await sendTelegramNotification(`🔄 *Full Cycle Complete!*\nRestart dari Wave 1 (Sumedang)\nTotal lifetime: ${state.totalScraped + totalThisRun} prospek`);
        }
        break;
      }
    }
    
    // Summary
    console.log(`\n📊 RUN SUMMARY:`);
    console.log(`  Prospek baru: ${totalThisRun}`);
    console.log(`  Email ditemukan: ${emailsThisRun}`);
    console.log(`  Wave: ${state.currentWave} | Vertical: ${verticalIdx}/${verticals.length} | City: ${cityIdx}/${cities.length}`);
    
    await sendTelegramNotification(
      `✅ *Auto Scrape Selesai*\n` +
      `Prospek baru: ${totalThisRun}\n` +
      `Email ditemukan: ${emailsThisRun}\n` +
      `Wave: ${state.currentWave} | Progress: ${verticalIdx}/${verticals.length} vertikal\n` +
      `Total lifetime: ${state.totalScraped + totalThisRun}`
    );
    
  } catch (err: any) {
    console.error('❌ Fatal error:', err);
    await sendTelegramNotification(`❌ *Auto Scrape Error*\n${err.message}`);
    await updateScrapingState({ lastError: err.message });
  } finally {
    await updateScrapingState({ isRunning: false, lastRunAt: new Date() });
  }
}

// ─── CLI ENTRY ───────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  let limit = 15;
  
  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.replace('--limit=', ''), 10) || 15;
    }
  }
  
  await runAutomatedScraping(limit);
  process.exit(0);
}

main().catch(console.error);