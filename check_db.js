
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const totalPending = await prisma.prospect.count({ where: { status: 'PENDING' } });
    const pendingWithEmail = await prisma.prospect.count({ where: { status: 'PENDING', email: { not: null } } });
    const contacted = await prisma.prospect.count({ where: { status: 'CONTACTED' } });
    const totalEmails = await prisma.prospect.count({ where: { email: { not: null } } });
    
    console.log(JSON.stringify({
        totalPending,
        pendingWithEmail,
        contacted,
        totalEmails
    }));
}
check().finally(() => prisma.$disconnect());
