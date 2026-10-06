import prisma from "./src/config/db";
async function run() {
  const result = await prisma.prospect.deleteMany({
    where: { status: "PENDING", email: null },
  });
  console.log(`Deleted ${result.count} trash prospects without emails.`);

  // Reset engine state to start from wave 1, vertical 0
  await prisma.scrapingState.updateMany({
    data: {
      currentWave: 1,
      currentVerticalIndex: 0,
      currentCityIndex: 0,
      isRunning: false,
    },
  });
  console.log("Reset ScrapingState to Wave 1, Priority 1.");
}
run().finally(() => prisma.$disconnect());
