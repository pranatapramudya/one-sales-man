// Load .env from one-sales-man root

import prisma from "../config/db";
import { writeFileSync } from "fs";
import * as XLSX from "xlsx";

export async function generateReport() {
  console.log("📊 Generating email outreach report...");

  // 1. Ambil semua prospek yang sudah dikontak via email (CONTACTED)
  const contacted = await prisma.prospect.findMany({
    where: { status: "CONTACTED" },
    orderBy: { lastContactedAt: "desc" },
    include: {
      messages: { orderBy: { sentAt: "desc" }, take: 1 },
    },
  });

  // 2. Ambil prospek yang PENDING + punya email (siap untuk blast berikutnya)
  const emailPending = await prisma.prospect.findMany({
    where: {
      status: "PENDING",
      email: { not: "" },
    },
    orderBy: { scrapedAt: "desc" },
  });

  // 3. Summary stats
  const total = await prisma.prospect.count();
  const byStatus = await prisma.prospect.groupBy({
    by: ["status"],
    _count: { status: true },
  });

  // Stats by email source
  const byEmailSource = await prisma.prospect.groupBy({
    by: ["emailSource"],
    _count: { emailSource: true },
    where: { email: { not: "" } },
  });

  // ─── ANALYTICS: KOTA & KATEGORI YANG SUDAH DI-REACHOUT ──────────────────────
  // Group contacted by city
  const contactedByCity = contacted.reduce(
    (acc, p) => {
      const city = p.city || "Unknown";
      if (!acc[city])
        acc[city] = { total: 0, withEmail: 0, categories: new Set() };
      acc[city].total++;
      if (p.email) acc[city].withEmail++;
      if (p.category) acc[city].categories.add(p.category);
      return acc;
    },
    {} as Record<
      string,
      { total: number; withEmail: number; categories: Set<string> }
    >,
  );

  const cityReachoutRows = Object.entries(contactedByCity)
    .sort(([, a], [, b]) => b.total - a.total)
    .map(([city, data]) => ({
      Kota: city,
      "Total Dikontak": data.total,
      "Punya Email": data.withEmail,
      "Rate Email": `${Math.round((data.withEmail / data.total) * 100)}%`,
      "Kategori Terdapat": Array.from(data.categories).join(", ") || "-",
    }));

  // Group contacted by category
  const contactedByCategory = contacted.reduce(
    (acc, p) => {
      const cat = p.category || "Uncategorized";
      if (!acc[cat]) acc[cat] = { total: 0, withEmail: 0, cities: new Set() };
      acc[cat].total++;
      if (p.email) acc[cat].withEmail++;
      if (p.city) acc[cat].cities.add(p.city);
      return acc;
    },
    {} as Record<
      string,
      { total: number; withEmail: number; cities: Set<string> }
    >,
  );

  const categoryReachoutRows = Object.entries(contactedByCategory)
    .sort(([, a], [, b]) => b.total - a.total)
    .map(([category, data]) => ({
      Kategori: category,
      "Total Dikontak": data.total,
      "Punya Email": data.withEmail,
      "Rate Email": `${Math.round((data.withEmail / data.total) * 100)}%`,
      "Kota Terdapat": Array.from(data.cities).join(", ") || "-",
    }));

  // Group contacted by city + category (matrix)
  const contactedByCityCategory = contacted.reduce(
    (acc, p) => {
      const city = p.city || "Unknown";
      const cat = p.category || "Uncategorized";
      const key = `${city}|${cat}`;
      if (!acc[key]) acc[key] = { city, category: cat, count: 0, withEmail: 0 };
      acc[key].count++;
      if (p.email) acc[key].withEmail++;
      return acc;
    },
    {} as Record<
      string,
      { city: string; category: string; count: number; withEmail: number }
    >,
  );

  const cityCategoryMatrixRows = Object.values(contactedByCityCategory)
    .sort((a, b) => b.count - a.count)
    .map((d) => ({
      Kota: d.city,
      Kategori: d.category,
      "Total Dikontak": d.count,
      "Punya Email": d.withEmail,
      "Rate Email": `${Math.round((d.withEmail / d.count) * 100)}%`,
    }));

  // ─── DETAIL: CONTACTED (EMAIL SENT) ─────────────────────────────────────────
  const contactedRows = contacted.map((p) => ({
    "Nama Bisnis": p.businessName,
    Kategori: p.category || "-",
    Kota: p.city || "-",
    Email: p.email || "-",
    "Sumber Email": p.emailSource || "-",
    Status: p.status,
    Rating: p.rating || "-",
    "Terakhir Dikontak": p.lastContactedAt
      ? new Date(p.lastContactedAt).toLocaleString("id-ID")
      : "-",
    "Tanggal Scrape": new Date(p.scrapedAt).toLocaleString("id-ID"),
    "Last Email ID": p.messages[0]?.id || "-",
    Catatan: p.notes || "-",
  }));

  // ─── DETAIL: EMAIL PENDING (NEXT BLAST) ─────────────────────────────────────
  const emailPendingRows = emailPending.map((p) => ({
    "Nama Bisnis": p.businessName,
    Kategori: p.category || "-",
    Kota: p.city || "-",
    Email: p.email,
    "Sumber Email": p.emailSource || "-",
    Status: p.status,
    Rating: p.rating || "-",
    "Tanggal Scrape": new Date(p.scrapedAt).toLocaleString("id-ID"),
    Catatan: p.notes || "-",
    Aksi: "EMAIL BLAST BERIKUTNYA",
  }));

  // ─── SUMMARY ROWS ───────────────────────────────────────────────────────────
  const summaryRows = [
    { Metrik: "Total Prospek di Database", Nilai: total },
    { Metrik: "Sudah Dikontak Email (CONTACTED)", Nilai: contacted.length },
    {
      Metrik: "Siap Email Blast Berikutnya (PENDING + Email)",
      Nilai: emailPending.length,
    },
    {
      Metrik: "Belum Punya Email (Need Scrape)",
      Nilai: total - contacted.length - emailPending.length,
    },
    ...byStatus.map((s) => ({
      Metrik: `Status: ${s.status}`,
      Nilai: s._count.status,
    })),
    ...byEmailSource.map((s) => ({
      Metrik: `Sumber Email: ${s.emailSource || "unknown"}`,
      Nilai: s._count.emailSource,
    })),
  ];

  // Generate timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const baseName = `email-outreach-report-${timestamp}`;

  // ─── WRITE CSV (flat: all contacted + pending) ──────────────────────────────
  const allDetailRows = [...contactedRows, ...emailPendingRows];
  if (allDetailRows.length > 0) {
    const csvHeaders = Object.keys(allDetailRows[0]);
    const csvContent = [
      csvHeaders.join(","),
      ...allDetailRows.map((row) =>
        csvHeaders
          .map((h) => `"${String((row as any)[h] || "").replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");
    writeFileSync(`${baseName}.csv`, csvContent, "utf-8");
    console.log(`✅ CSV saved: ${baseName}.csv`);
  }

  // ─── WRITE EXCEL (Multi-sheet Analytics) ────────────────────────────────────
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary Overview
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, "1. Summary");

  // Sheet 2: Reachout by Kota (Analytics)
  const wsCity = XLSX.utils.json_to_sheet(cityReachoutRows);
  XLSX.utils.book_append_sheet(wb, wsCity, "2. Reachout by Kota");

  // Sheet 3: Reachout by Kategori (Analytics)
  const wsCat = XLSX.utils.json_to_sheet(categoryReachoutRows);
  XLSX.utils.book_append_sheet(wb, wsCat, "3. Reachout by Kategori");

  // Sheet 4: Matrix Kota x Kategori
  const wsMatrix = XLSX.utils.json_to_sheet(cityCategoryMatrixRows);
  XLSX.utils.book_append_sheet(wb, wsMatrix, "4. Matrix Kota x Kategori");

  // Sheet 5: Detail Contacted (Email Sent)
  const wsContacted = XLSX.utils.json_to_sheet(contactedRows);
  XLSX.utils.book_append_sheet(wb, wsContacted, "5. Contacted Detail");

  // Sheet 6: Email Pending (Next Blast Targets)
  const wsPending = XLSX.utils.json_to_sheet(emailPendingRows);
  XLSX.utils.book_append_sheet(wb, wsPending, "6. Email Pending");

  XLSX.writeFile(wb, `${baseName}.xlsx`);
  console.log(`✅ Excel saved: ${baseName}.xlsx`);

  // ─── CONSOLE SUMMARY ────────────────────────────────────────────────────────
  console.log("\n📈 EMAIL OUTREACH REPORT SUMMARY");
  console.log("==================================");
  summaryRows.forEach((r) => console.log(`${r.Metrik}: ${r.Nilai}`));

  console.log("\n📍 TOP 5 KOTA DI-REACHOUT:");
  cityReachoutRows
    .slice(0, 5)
    .forEach((r) =>
      console.log(
        `  ${r.Kota}: ${r["Total Dikontak"]} dikontak (${r["Rate Email"]} email)`,
      ),
    );

  console.log("\n🏷️ TOP 5 KATEGORI DI-REACHOUT:");
  categoryReachoutRows
    .slice(0, 5)
    .forEach((r) =>
      console.log(
        `  ${r.Kategori}: ${r["Total Dikontak"]} dikontak (${r["Rate Email"]} email)`,
      ),
    );

  console.log(`\n📁 Files: ${baseName}.csv, ${baseName}.xlsx`);

  await prisma.$disconnect();

  return {
    contacted,
    emailPending,
    files: [`${baseName}.csv`, `${baseName}.xlsx`],
    stats: {
      contacted: contacted.length,
      pending: emailPending.length,
      cities: cityReachoutRows.length,
    },
  };
}

// Run
generateReport().catch(console.error);
