import prisma from "./src/config/db";
async function run() {
  const pending = await prisma.prospect.count({ where: { status: "PENDING" } });
  const pendingEmail = await prisma.prospect.count({
    where: { status: "PENDING", email: { not: null } },
  });
  console.log(`Pending Total: ${pending}, Pending with Email: ${pendingEmail}`);
}
run().finally(() => prisma.$disconnect());
