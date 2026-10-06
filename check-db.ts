import prisma from "./src/config/db";

async function main() {
  try {
    // Check all prospects with their status breakdown
    const statuses = await prisma.prospect.groupBy({
      by: ["status"],
      _count: { status: true },
    });
    console.log("STATUS breakdown:", JSON.stringify(statuses, null, 2));

    const stages = await prisma.prospect.groupBy({
      by: ["followUpStage"],
      _count: { followUpStage: true },
    });
    console.log("FOLLOWUP STAGE breakdown:", JSON.stringify(stages, null, 2));

    const total = await prisma.prospect.count();
    console.log("Total prospects:", total);

    const withEmail = await prisma.prospect.count({
      where: { email: { not: null } },
    });
    console.log("With email:", withEmail);

    const contacted = await prisma.prospect.count({
      where: { status: "CONTACTED" },
    });
    console.log("Status CONTACTED:", contacted);

    // Show sample prospects
    const sample = await prisma.prospect.findMany({
      select: {
        businessName: true,
        email: true,
        whatsappNumber: true,
        status: true,
        followUpStage: true,
        lastEmailSentAt: true,
        city: true,
        category: true,
        scrapedAt: true,
      },
      take: 10,
      orderBy: { scrapedAt: "desc" },
    });
    console.log("\n--- SAMPLE PROSPECTS ---");
    sample.forEach((p, i) => {
      console.log(i + 1, "|", p.businessName, "|", p.category, "|", p.city);
      console.log(
        "   Status:",
        p.status,
        "| Stage:",
        p.followUpStage,
        "| Email:",
        p.email || "NONE",
      );
      console.log("   LastEmailSentAt:", p.lastEmailSentAt || "NEVER");
      console.log("");
    });
  } catch (e) {
    console.error("Error:", e);
  }
}
main().then(() => process.exit(0));
