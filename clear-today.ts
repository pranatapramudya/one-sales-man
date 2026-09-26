import prisma from './src/lib/prisma';

async function clearTodayScraped() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const deleted = await prisma.prospect.deleteMany({
    where: { scrapedAt: { gte: today } }
  });
  console.log('Deleted:', deleted.count, 'prospects from today');
  
  const deletedLogs = await prisma.outreachMessage.deleteMany({
    where: { sentAt: { gte: today } }
  });
  console.log('Deleted:', deletedLogs.count, 'outreach messages from today');
  
  await prisma.$disconnect();
}
clearTodayScraped().catch(e => console.error(e));