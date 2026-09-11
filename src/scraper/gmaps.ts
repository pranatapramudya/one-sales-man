import { chromium } from 'playwright';
import prisma from '../lib/prisma';

// Helper to clean phone numbers (e.g. 08... -> +628...)
function formatPhoneNumber(phone: string): string | null {
    if (!phone) return null;
    let cleaned = phone.replace(/\D/g, ''); // Remove non-digits
    
    // Indonesian format adjustment
    if (cleaned.startsWith('0')) {
        cleaned = '62' + cleaned.substring(1);
    } else if (cleaned.startsWith('8')) {
        cleaned = '62' + cleaned;
    }
    
    if (cleaned.length < 10) return null; // Invalid length
    return '+' + cleaned;
}

export async function scrapeGoogleMaps(keyword: string, limit: number = 10, headless: boolean = false) {
    const keywordParts = keyword.trim().split(' ');
    const extractedCity = keywordParts.length > 1 ? keywordParts[keywordParts.length - 1] : null;
    console.log(`Starting Google Maps Scraper for keyword: "${keyword}" (Assumed City: ${extractedCity})`);
    
    // 1. NAVIGASI: Buka browser dengan headless: false agar terlihat
    const browser = await chromium.launch({ headless: headless });
    const context = await browser.newContext({
        locale: 'id-ID', // Membantu mendapatkan UI Bahasa Indonesia secara konsisten
    });
    const page = await context.newPage();
    
    try {
        console.log('Navigating to Google Maps...');
        // Menggunakan waitUntil domcontentloaded agar tidak timeout jika map tile lambat load
        await page.goto('https://www.google.com/maps', { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        // 2. PENCARIAN OTOMATIS
        console.log('Waiting for search box...');
        const searchBoxSelector = 'input[name="q"], #searchboxinput';
        await page.waitForSelector(searchBoxSelector, { timeout: 30000 });
        await page.fill(searchBoxSelector, keyword);
        await page.press(searchBoxSelector, 'Enter');
        
        // 3. TUNGGU HASIL
        console.log('Waiting for results to load...');
        // Menunggu sampai elemen hasil pencarian muncul (minimal satu)
        await page.waitForSelector('a[href*="/maps/place/"]', { timeout: 30000 });
        await page.waitForTimeout(3000); // Tunggu sebentar agar panel hasil stabil
        
        console.log('Results loaded, starting extraction...');
        let count = 0;
        
        // 4. EKSTRAKSI & LOOPING
        let cards = page.locator('a[href*="/maps/place/"]');
        let elementsCount = await cards.count();
        
        for (let i = 0; i < limit; i++) {
            // Ambil ulang locator karena DOM bisa berubah saat scroll
            cards = page.locator('a[href*="/maps/place/"]');
            elementsCount = await cards.count();
            
            if (i >= elementsCount) {
                // Scroll untuk meload lebih banyak data jika hasil pencarian lebih banyak
                const feed = page.locator('div[role="feed"]');
                if (await feed.count() > 0) {
                    await feed.first().hover();
                    await page.mouse.wheel(0, 1500);
                    await page.waitForTimeout(2000);
                    
                    cards = page.locator('a[href*="/maps/place/"]');
                    elementsCount = await cards.count();
                    
                    if (i >= elementsCount) {
                        console.log('No more results to load.');
                        break;
                    }
                } else {
                    break;
                }
            }
            
            try {
                console.log(`Processing item ${i + 1}...`);
                // Klik hasil pencarian (kartu)
                await cards.nth(i).click();
                
                // Tunggu detail panel di sebelah kiri terbuka (ditandai dengan h1 Nama Bisnis)
                await page.waitForSelector('h1', { timeout: 10000 });
                await page.waitForTimeout(1500); // Jeda sejenak untuk memastikan seluruh detail load
                
                // Ekstrak "Nama Bisnis" (dari aria-label di element 'a' untuk memastikan akurasi)
                const name = await cards.nth(i).getAttribute('aria-label');
                
                // Ekstrak "Kategori Bisnis" (teks di bawah rating)
                const categoryBtn = page.locator('button.DkEaL, button[jsaction*="category"]');
                const category = await categoryBtn.count() > 0 ? await categoryBtn.first().innerText() : 'Uncategorized';
                
                // Ekstrak "Nomor Telepon"
                // Pencarian via data-item-id sangat tangguh karena tidak bergantung bahasa
                const phoneBtn = page.locator('button[data-item-id^="phone:tel:"]');
                let rawPhone = null;
                if (await phoneBtn.count() > 0) {
                    const dataItemId = await phoneBtn.first().getAttribute('data-item-id');
                    if (dataItemId) {
                        rawPhone = dataItemId.replace('phone:tel:', '');
                    }
                } else {
                    // Fallback dengan aria-label
                    const fallbackBtn = page.locator('button[aria-label*="Telepon"], button[aria-label*="Phone"], button[aria-label*="telepon"]');
                    if (await fallbackBtn.count() > 0) {
                        rawPhone = await fallbackBtn.first().innerText();
                    }
                }

                // 5. SANITASI DATA
                if (!name || !rawPhone) {
                    console.log(`Skipping item ${i + 1}: No phone number found.`);
                    continue;
                }

                const formattedPhone = formatPhoneNumber(rawPhone);
                if (!formattedPhone) {
                    console.log(`Skipping item ${i + 1}: Phone number invalid (${rawPhone}).`);
                    continue;
                }

                console.log(`Extracted: ${name} | ${category} | ${formattedPhone}`);
                
                // 6. SIMPAN KE DATABASE
                const existing = await prisma.prospect.findFirst({ where: { whatsappNumber: formattedPhone } });
                
                if (existing) {
                    console.log(`[Skip] Nomor sudah ada di database: ${formattedPhone}`);
                    continue;
                }
                
                await prisma.prospect.create({
                    data: {
                        businessName: name,
                        category: category,
                        city: extractedCity,
                        whatsappNumber: formattedPhone,
                        rating: null,
                        status: 'PENDING'
                    }
                });
                
                count++;
                
            } catch (err: any) {
                console.error(`Error extracting item ${i + 1}:`, err.message);
            }
        }

        console.log(`Scraping completed. Added ${count} new prospects to database.`);

    } catch (error) {
        console.error('Error during scraping:', error);
    } finally {
        // 7. CLEANUP
        await browser.close();
        await prisma.$disconnect();
    }
}
