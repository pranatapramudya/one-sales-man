import prisma from './src/lib/prisma';
async function run() {
  await prisma.scrapingState.updateMany({ data: { isRunning: false } });
  console.log("Reset isRunning to false");
}
run().finally(() => prisma.$disconnect());
