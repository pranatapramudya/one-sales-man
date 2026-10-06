import "dotenv/config";
import prisma from "../config/db";

async function main() {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      newProspectsToday,
      contactedToday,
      contactedTotal,
      hotLeadsCount,
      closedCount,
      totalDatabase,
      totalTicketsToday,
      resolvedTicketsToday,
      escalatedTicketsToday,
    ] = await Promise.all([
      prisma.prospect
        .count({
          where: { scrapedAt: { gte: startOfDay } },
        })
        .catch(() => 0),
      prisma.prospect
        .count({
          where: { lastContactedAt: { gte: startOfDay } },
        })
        .catch(() => 0),
      prisma.prospect
        .count({
          where: { status: { in: ["CONTACTED", "HOT_LEAD", "CLOSED"] } },
        })
        .catch(() => 0),
      prisma.prospect
        .count({
          where: { status: "HOT_LEAD" },
        })
        .catch(() => 0),
      prisma.prospect
        .count({
          where: { status: "CLOSED" },
        })
        .catch(() => 0),
      prisma.prospect.count().catch(() => 0),
      prisma.supportTicket
        .count({
          where: { createdAt: { gte: startOfDay } },
        })
        .catch(() => 0),
      prisma.supportTicket
        .count({
          where: {
            status: "RESOLVED_BY_AI",
            createdAt: { gte: startOfDay },
          },
        })
        .catch(() => 0),
      prisma.supportTicket
        .count({
          where: {
            status: "ESCALATED_TO_HUMAN",
            createdAt: { gte: startOfDay },
          },
        })
        .catch(() => 0),
    ]);

    // Hitung berapa prospek yang sudah pernah membalas chat
    const repliedRows = await prisma.outreachMessage
      .findMany({
        where: { messageText: { startsWith: "[User]:" } },
        select: { prospectId: true },
        distinct: ["prospectId"],
      })
      .catch(() => []);
    const repliedCount = repliedRows.length;

    // Hitung Persentase Konversi Nyata (Conversion Funnel)
    const baseContacted = Math.max(contactedTotal, 1);
    const responseRate =
      contactedTotal > 0
        ? parseFloat(((repliedCount / baseContacted) * 100).toFixed(1))
        : 0;
    const leadRate =
      contactedTotal > 0
        ? parseFloat(((hotLeadsCount / baseContacted) * 100).toFixed(1))
        : 0;
    const closingRate =
      contactedTotal > 0
        ? parseFloat(((closedCount / baseContacted) * 100).toFixed(1))
        : 0;
    const pipelineEstimate = hotLeadsCount * 990000;

    const recentHotLeads = await prisma.prospect
      .findMany({
        where: { status: "HOT_LEAD" },
        orderBy: { lastContactedAt: "desc" },
        take: 3,
        select: {
          businessName: true,
          whatsappNumber: true,
          category: true,
        },
      })
      .catch(() => []);

    console.log(
      JSON.stringify({
        success: true,
        sales: {
          newProspectsToday,
          contactedToday,
          contactedTotal,
          repliedCount,
          hotLeadsCount,
          closedCount,
          responseRate,
          leadRate,
          closingRate,
          pipelineEstimate,
          totalDatabase,
          recentHotLeads,
        },
        cs: {
          totalTicketsToday,
          resolvedTicketsToday,
          escalatedTicketsToday,
        },
      }),
    );
  } catch (err: any) {
    console.error(
      JSON.stringify({ success: false, error: err?.message || String(err) }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main();
