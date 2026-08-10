import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { workbookBufferFromAoa } from "@/lib/excel";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const departments = await prisma.department.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    });

    const headers = [
      "Student ID",
      "Full Name",
      "Mother Name",
      "Parent Phone",
      "Email",
      "Phone",
      "Date of Birth",
      "Gender",
      "Address",
      "Department Code",
      "Admission Academic Year",
      "Class",
      "Program",
      "Status",
      "Payment Status",
    ];

    const sampleRow = [
      "",
      "Ahmed Hassan",
      "Fatima Hassan",
      "+252 61 1234567",
      "ahmed@example.com",
      "+252 61 7654321",
      "2005-01-15",
      "Male",
      "Hargeisa, Somaliland",
      departments[0]?.code ?? "CS",
      "2024-2025",
      "Level 1-A",
      "Bachelor",
      "Admitted",
      "Fully Paid",
    ];

    const columnWidths = headers.map((_, i) => {
      if (i === 9) return 18;
      if (i === 10) return 22;
      if (i === 11) return 20;
      return 14;
    });

    const buf = await workbookBufferFromAoa({
      sheetName: "Students",
      rows: [headers, sampleRow],
      columnWidths,
    });
    const filename = "Student_Import_Template.xlsx";

    return new NextResponse(Buffer.from(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error("Student template error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
