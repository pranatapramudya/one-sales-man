
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    await prisma.scrapingState.updateMany({ data: { isRunning: false } });
    console.log("Reset isRunning to false");
}
check().finally(() => prisma.$disconnect());
