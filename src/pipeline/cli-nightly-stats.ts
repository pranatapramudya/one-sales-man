import 'dotenv/config';
import prisma from '../lib/prisma';

async function main() {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      newProspectsToday,
      contactedToday,
      hotLeadsCount,
      totalDatabase,
      totalTicketsToday,
      resolvedTicketsToday,
      escalatedTicketsToday
    ] = await Promise.all([
      prisma.prospect.count({
        where: { createdAt: { gte: startOfDay } }
      }).catch(() => 0),
      prisma.prospect.count({
        where: { lastContactedAt: { gte: startOfDay } }
      }).catch(() => 0),
      prisma.prospect.count({
        where: { status: 'HOT_LEAD' }
      }).catch(() => 0),
      prisma.prospect.count().catch(() => 0),
      prisma.supportTicket.count({
        where: { createdAt: { gte: startOfDay } }
      }).catch(() => 0),
      prisma.supportTicket.count({
        where: {
          status: 'RESOLVED',
          createdAt: { gte: startOfDay }
        }
      }).catch(() => 0),
      prisma.supportTicket.count({
        where: {
          status: 'ESCALATED_TO_HUMAN',
          createdAt: { gte: startOfDay }
        }
      }).catch(() => 0)
    ]);

    const recentHotLeads = await prisma.prospect.findMany({
      where: { status: 'HOT_LEAD' },
      orderBy: { lastContactedAt: 'desc' },
      take: 3,
      select: {
        businessName: true,
        whatsappNumber: true,
        category: true
      }
    }).catch(() => []);

    console.log(JSON.stringify({
      success: true,
      sales: {
        newProspectsToday,
        contactedToday,
        hotLeadsCount,
        totalDatabase,
        recentHotLeads
      },
      cs: {
        totalTicketsToday,
        resolvedTicketsToday,
        escalatedTicketsToday
      }
    }));
  } catch (err) {
    console.error(JSON.stringify({ success: false, error: err?.message || String(err) }));
  } finally {
    await prisma.$disconnect();
  }
}

main();
