import prisma from "./src/config/db";

async function check() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const count = await prisma.prospect.count({
    where: { scrapedAt: { gte: today } },
  });
  console.log("Prospects today:", count);

  const total = await prisma.prospect.count();
  console.log("Total prospects:", total);

  await prisma.$disconnect();
}
check().catch((e) => console.error(e));
