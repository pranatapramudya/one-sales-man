import prisma from "../config/db";
import React from "react";
import DashboardClient from "../components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const prospects = await prisma.prospect.findMany({
    orderBy: { scrapedAt: "desc" },
  });

  return <DashboardClient prospects={prospects} />;
}
