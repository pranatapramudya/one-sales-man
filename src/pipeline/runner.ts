import 'dotenv/config';

import prisma from '../lib/prisma';
import { whatsappClient, sendColdMessage } from '../whatsapp/client';
import { scrapeGoogleMaps } from '../scraper/gmaps';

async function runOutreachPipeline() {
    console.log('--- Starting B2B Outreach Pipeline ---');

    // Step 1: Query pending prospects
    const pendingProspects = await prisma.prospect.findMany({
        where: { status: 'PENDING' },
        take: 5 // Limit to 5 per batch for safety
    });

    if (pendingProspects.length === 0) {
        console.log('No pending prospects found. Maybe it is time to run the scraper?');
        return;
    }

    console.log(`Found ${pendingProspects.length} prospects to contact...`);

    // Step 2: Iterate and send messages
    for (const prospect of pendingProspects) {
        // Construct the cold outreach message
        const messageTemplate = `Halo admin ${prospect.businessName}, salam kenal! Saya Pranata dari tim PJTECH.

Maaf mengganggu waktunya kak. Kebetulan kita lagi ada program riset untuk digitalisasi UMKM/Bisnis lokal. Boleh izin tanya sedikit mengenai operasional pencatatan di ${prospect.businessName} kak?`;

        // Send the message using our random-delay sender
        const success = await sendColdMessage(prospect.whatsappNumber, messageTemplate);

        if (success) {
            // Update status in DB
            await prisma.prospect.update({
                where: { id: prospect.id },
                data: {
                    status: 'CONTACTED',
                    lastContactedAt: new Date()
                }
            });

            // Log the message
            await prisma.outreachMessage.create({
                data: {
                    prospectId: prospect.id,
                    messageText: messageTemplate
                }
            });
            console.log(`[Success] Prospect ${prospect.businessName} updated to CONTACTED.`);
        } else {
            console.log(`[Failed] Could not send message to ${prospect.businessName}. Skipping update.`);
        }
    }

    console.log('--- Outreach Pipeline Batch Completed ---');
}

// Example Main function to orchestrate both or run individually
// Example Main function to orchestrate both or run individually
async function main() {
    // 1. TARIK DATA DULU (Nyalakan scraper dan arahkan ke Sumedang)
    // Silakan ganti 'Klinik', 'Bengkel', atau 'Toko Baju' sesuai target hari ini.
    // Angka 5 di belakang adalah batas jumlah data yang mau ditarik per sesi biar aman.
    await scrapeGoogleMaps('Klinik di Sumedang', 200);

    // 2. JALANKAN BOT WA
    // Initialize WA Client
    whatsappClient.initialize();

    // Wait until WA client is ready before running the pipeline
    whatsappClient.on('ready', async () => {
        console.log('Client is ready! Starting outreach pipeline in 10 seconds...');
        setTimeout(async () => {
            await runOutreachPipeline();
            // Disconnect if needed or let it run
        }, 10000);
    });
}

// Execute
main().catch(console.error);