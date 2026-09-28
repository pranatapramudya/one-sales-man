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
    // Hanya nomor HP seluler Indonesia (08... / 628...) yang mendukung WhatsApp
    if (!cleaned.startsWith('628')) return null;
    return '+' + cleaned;
}

// Helper to extract email from text using regex
function extractEmailFromText(text: string): string | null {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const matches = text.match(emailRegex);
    if (!matches) return null;
    // Filter out common false positives (image filenames, etc.)
    const filtered = matches.filter(e => 
        !e.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|css|js)$/i) &&
        !e.includes('example.com') &&
        !e.includes('google.com') &&
        !e.includes('gstatic.com')
    );
    return filtered[0] || null;
}

// Helper to extract emails from href attributes (mailto: links)
function extractEmailFromMailto(href: string): string | null {
    if (!href) return null;
    const match = href.match(/mailto:([^?&]+)/);
    return match ? match[1] : null;
}

// Helper to add random delay (human-like behavior)
async function humanDelay(minMs: number = 1000, maxMs: number = 3000): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    await new Promise(resolve => setTimeout(resolve, delay));
}

// Extract email from business website
async function extractEmailFromWebsite(page: any, websiteUrl: string): Promise<{ email: string | null; source: string }> {
    if (!websiteUrl) return { email: null, source: 'none' };
    
    try {
        console.log(`  Visiting website: ${websiteUrl}`);
        await page.goto(websiteUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await humanDelay(1500, 3000);
        
        // Get page content
        const pageText = await page.evaluate(() => document.body.innerText);
        const email = extractEmailFromText(pageText);
        if (email) {
            console.log(`  Found email on website: ${email}`);
            return { email, source: 'website' };
        }
        
        // Check mailto links
        const mailtoLinks = await page.evaluate(() => 
            Array.from(document.querySelectorAll('a[href^="mailto:"]')).map(a => a.getAttribute('href'))
        );
        for (const href of mailtoLinks) {
            const email = extractEmailFromMailto(href || '');
            if (email) {
                console.log(`  Found email via mailto: ${email}`);
                return { email, source: 'website' };
            }
        }
        
        // Check common contact pages
        const contactLinks = await page.evaluate(() => 
            Array.from(document.querySelectorAll('a[href*="contact"], a[href*="hubungi"], a[href*="about"]'))
                .map(a => a.getAttribute('href'))
                .filter(h => h && !h.startsWith('#') && !h.startsWith('javascript:'))
        );
        
        for (const link of contactLinks.slice(0, 3)) { // Limit to 3 contact pages
            try {
                const fullUrl = new URL(link, websiteUrl).href;
                await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
                await humanDelay(1000, 2000);
                const contactText = await page.evaluate(() => document.body.innerText);
                const contactEmail = extractEmailFromText(contactText);
                if (contactEmail) {
                    console.log(`  Found email on contact page: ${contactEmail}`);
                    return { email: contactEmail, source: 'website' };
                }
            } catch (e) {
                // Continue to next link
            }
        }
        
    } catch (err: any) {
        console.log(`  Website visit failed: ${err.message}`);
    }
    
    return { email: null, source: 'none' };
}

// Extract email from Google Maps detail panel
async function extractEmailFromMapsPanel(page: any): Promise<{ email: string | null; source: string }> {
    try {
        // Get all text from the detail panel
        const panelText = await page.evaluate(() => {
            const panel = document.querySelector('[role="main"]') || document.body;
            return (panel as HTMLElement)?.innerText || '';
        });
        
        const email = extractEmailFromText(panelText);
        if (email) {
            console.log(`  Found email in Maps panel: ${email}`);
            return { email, source: 'maps' };
        }
        
        // Check for mailto links in panel
        const mailtoLinks = await page.evaluate(() => 
            Array.from(document.querySelectorAll('a[href^="mailto:"]')).map(a => a.getAttribute('href'))
        );
        for (const href of mailtoLinks) {
            const email = extractEmailFromMailto(href || '');
            if (email) {
                console.log(`  Found email via mailto in Maps: ${email}`);
                return { email, source: 'maps' };
            }
        }
        
    } catch (err: any) {
        console.log(`  Maps panel email extraction failed: ${err.message}`);
    }
    
    return { email: null, source: 'none' };
}

// Extract email from social media (Instagram/Facebook) linked from Maps
async function extractEmailFromSocialMedia(page: any, businessName: string): Promise<{ email: string | null; source: string }> {
    try {
        // Find social media links in Maps panel
        const socialLinks = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a[href*="instagram.com"], a[href*="facebook.com"], a[href*="wa.me"], a[href*="api.whatsapp.com"]'));
            return links.map(a => ({ href: a.getAttribute('href'), text: (a as HTMLElement).innerText })).filter(l => l.href);
        });
        
        for (const link of socialLinks.slice(0, 2)) { // Limit to 2 social links
            try {
                if (link.href.includes('instagram.com')) {
                    console.log(`  Checking Instagram: ${link.href}`);
                    await page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
                    await humanDelay(2000, 4000);
                    
                    const bioText = await page.evaluate(() => {
                        // Instagram bio selectors
                        const bio = document.querySelector('header section') || 
                                   document.querySelector('[data-testid="user-bio"]') ||
                                   document.body;
                        return (bio as HTMLElement)?.innerText || '';
                    });
                    
                    const email = extractEmailFromText(bioText);
                    if (email) {
                        console.log(`  Found email in Instagram bio: ${email}`);
                        return { email, source: 'instagram' };
                    }
                }
                
                if (link.href.includes('facebook.com')) {
                    console.log(`  Checking Facebook: ${link.href}`);
                    await page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
                    await humanDelay(2000, 4000);
                    
                    const fbText = await page.evaluate(() => document.body.innerText);
                    const email = extractEmailFromText(fbText);
                    if (email) {
                        console.log(`  Found email on Facebook: ${email}`);
                        return { email, source: 'facebook' };
                    }
                }
            } catch (e) {
                // Continue
            }
        }
    } catch (err: any) {
        console.log(`  Social media extraction failed: ${err.message}`);
    }
    
    return { email: null, source: 'none' };
}

// Main scraping function with email extraction
export async function scrapeGoogleMaps(keyword: string, limit: number = 10, headless: boolean = false) {
    const keywordParts = keyword.trim().split(' ');
    const rawCity = keywordParts.length > 1 ? keywordParts[keywordParts.length - 1] : null;
    const extractedCity = rawCity ? rawCity.charAt(0).toUpperCase() + rawCity.slice(1).toLowerCase() : 'Sumedang';
    console.log(`Starting Google Maps Scraper for keyword: "${keyword}" (Assumed City: ${extractedCity})`);
    
    const browser = await chromium.launch({ headless: headless });
    const context = await browser.newContext({
        locale: 'id-ID',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();
    
    // Block unnecessary resources to speed up and reduce detection
    await page.route('**/*.{png,jpg,jpeg,gif,svg,webp,woff,woff2,css,font}', route => route.abort());
    
    try {
        console.log(`Navigating to Google Maps search for: "${keyword}"...`);
        await page.goto('https://www.google.com/maps/search/' + encodeURIComponent(keyword), { 
            waitUntil: 'domcontentloaded', 
            timeout: 60000 
        });
        
        // 3. TUNGGU HASIL
        console.log('Waiting for results to load...');
        await page.waitForSelector('div[role="feed"], a.hfpxzc, a.hfpxzc, a[href*="/maps/place/"]', { timeout: 30000 });
        await page.waitForTimeout(2500);
        
        console.log('Results loaded, starting extraction...');
        let count = 0;
        
        // 4. EKSTRAKSI & LOOPING
        let cards = page.locator('a.hfpxzc, a[href*="/maps/place/"]');
        let elementsCount = await cards.count();
        let cardIndex = 0;
        const maxCardsToCheck = Math.max(limit * 4, 60);
        
        while (count < limit && cardIndex < maxCardsToCheck) {
            const i = cardIndex++;
            
            // Ambil ulang locator karena DOM bisa berubah saat scroll
            cards = page.locator('a.hfpxzc, a[href*="/maps/place/"]');
            elementsCount = await cards.count();
            
            while (i >= elementsCount) {
                // Scroll untuk meload lebih banyak data jika hasil pencarian lebih banyak
                const feed = page.locator('div[role="feed"]');
                if (await feed.count() > 0) {
                    await feed.first().hover();
                    await page.mouse.wheel(0, 2000);
                    await page.waitForTimeout(2000);
                    
                    cards = page.locator('a.hfpxzc, a[href*="/maps/place/"]');
                    const newElementsCount = await cards.count();
                    
                    if (newElementsCount <= elementsCount) {
                        // Coba scroll lebih jauh sebelum menganggap feed habis
                        await page.mouse.wheel(0, 3500);
                        await page.waitForTimeout(2500);
                        cards = page.locator('a.hfpxzc, a[href*="/maps/place/"]');
                        if (await cards.count() <= elementsCount) {
                            console.log('No more results to load.');
                            break;
                        }
                    }
                    elementsCount = await cards.count();
                } else {
                    break;
                }
            }
            
            if (i >= elementsCount) {
                console.log(`Feed berakhir. Total kartu diperiksa: ${elementsCount}`);
                break;
            }
            
            try {
                console.log(`Processing item ${i + 1} (Terkumpul: ${count}/${limit} prospek valid)...`);
                // Klik hasil pencarian (kartu)
                await cards.nth(i).click();
                
                // Tunggu detail panel di sebelah kiri terbuka (ditandai dengan h1 Nama Bisnis)
                await page.waitForSelector('h1', { timeout: 10000 });
                await humanDelay(1500, 3000); // Random delay to look human
                
                // Ekstrak "Nama Bisnis" (dari aria-label di element 'a' untuk memastikan akurasi)
                const name = await cards.nth(i).getAttribute('aria-label');
                
                // Ekstrak "Kategori Bisnis" (teks di bawah rating)
                const categoryBtn = page.locator('button.DkEaL, button[jsaction*="category"]');
                const category = await categoryBtn.count() > 0 ? await categoryBtn.first().innerText() : 'Uncategorized';
                
                // Ekstrak "Nomor Telepon"
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
                
                // Ekstrak "Website" link
                let websiteUrl: string | null = null;
                const websiteBtn = page.locator('a[data-item-id^="authority:"], a[href*="http"]:not([href*="google.com"]):not([href*="maps"]):not([href*="instagram"]):not([href*="facebook"]):not([href*="tiktok"]):not([href*="twitter"]):not([href*="youtube"]):not([href*="linkedin"])');
                if (await websiteBtn.count() > 0) {
                    websiteUrl = await websiteBtn.first().getAttribute('href');
                }
                
                // 5. EKSTRAK EMAIL (Multi-source)
                console.log(`  Extracting emails for: ${name}`);
                
                // Source 1: Google Maps panel
                let { email: foundEmail, source: emailSource } = await extractEmailFromMapsPanel(page);
                
                // Source 2: Website (if no email found yet)
                if (!foundEmail && websiteUrl) {
                    const result = await extractEmailFromWebsite(page, websiteUrl);
                    foundEmail = result.email;
                    emailSource = result.source;
                }
                
                // Source 3: Social Media (if still no email)
                if (!foundEmail) {
                    const result = await extractEmailFromSocialMedia(page, name || '');
                    foundEmail = result.email;
                    emailSource = result.source;
                }
                
                // 6. SANITASI DATA
                if (!name || !rawPhone) {
                    console.log(`Skipping item ${i + 1}: No phone number found.`);
                    await humanDelay(500, 1500);
                    continue;
                }
                
                const formattedPhone = formatPhoneNumber(rawPhone);
                if (!formattedPhone) {
                    console.log(`Skipping item ${i + 1}: Phone number invalid (${rawPhone}).`);
                    await humanDelay(500, 1500);
                    continue;
                }
                
                console.log(`Extracted: ${name} | ${category} | ${formattedPhone} | Email: ${foundEmail || 'NOT FOUND'} (${emailSource})`);
                
                // 7. SIMPAN KE DATABASE
                const existing = await prisma.prospect.findFirst({ where: { whatsappNumber: formattedPhone } });
                
                if (existing) {
                    console.log(`[Skip] Nomor sudah ada di database: ${formattedPhone}`);
                    // Update email if we found one and existing doesn't have it
                    if (foundEmail && !existing.email) {
                        await prisma.prospect.update({
                            where: { id: existing.id },
                            data: { email: foundEmail, emailSource }
                        });
                        console.log(`[Updated] Email added to existing prospect: ${foundEmail}`);
                    }
                    await humanDelay(500, 1500);
                    continue;
                }
                
                await prisma.prospect.create({
                    data: {
                        businessName: name,
                        category: category,
                        city: extractedCity,
                        whatsappNumber: formattedPhone,
                        email: foundEmail,
                        emailSource: emailSource || null,
                        rating: null,
                        status: 'PENDING'
                    }
                });
                
                count++;
                
                // Human-like delay between items (critical for anti-detection)
                await humanDelay(3000, 6000);
                
            } catch (err: any) {
                console.error(`Error extracting item ${i + 1}:`, err.message);
                await humanDelay(2000, 4000); // Longer delay after error
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

// Export helper functions for testing
export { extractEmailFromText, extractEmailFromMailto, formatPhoneNumber, humanDelay };