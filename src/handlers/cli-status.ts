import "dotenv/config";
import prisma from "../config/db";

async function main() {
  try {
    const [total, pending, contacted, hotLeads, closed] = await Promise.all([
      prisma.prospect.count(),
      prisma.prospect.count({ where: { status: "PENDING" } }),
      prisma.prospect.count({ where: { status: "CONTACTED" } }),
      prisma.prospect.count({ where: { status: "HOT_LEAD" } }),
      prisma.prospect.count({ where: { status: "CLOSED" } }),
    ]);

    const recentHotLeads = await prisma.prospect.findMany({
      where: { status: "HOT_LEAD" },
      orderBy: { lastContactedAt: "desc" },
      take: 5,
      select: {
        id: true,
        businessName: true,
        category: true,
        city: true,
        whatsappNumber: true,
        lastContactedAt: true,
      },
    });

    const payload = {
      success: true,
      stats: {
        total,
        pending,
        contacted,
        hotLeads,
        closed,
      },
      recentHotLeads,
    };

    console.log(JSON.stringify(payload, null, 2));
  } catch (error: any) {
    console.error(
      JSON.stringify({
        success: false,
        error: error?.message || String(error),
      }),
    );
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
