import prisma from "./src/config/db";
async function run() {
  const count = await prisma.prospect.count({
    where: { status: "PENDING", email: { not: null } },
  });
  const prospects = await prisma.prospect.findMany({
    where: { status: "PENDING", email: { not: null } },
    select: { businessName: true, category: true, email: true },
    take: 10,
  });
  console.log(`\n✅ Ditemukan ${count} prospek premium baru yang punya email!`);
  if (prospects.length > 0) {
    console.table(prospects);
  } else {
    console.log(
      "Belum ada data baru. (Mungkin bot auto-scrape belum dapet giliran jalan)",
    );
  }
}
run().finally(() => prisma.$disconnect());
