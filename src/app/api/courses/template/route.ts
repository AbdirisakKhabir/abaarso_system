import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import * as XLSX from "xlsx";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const headers = [
      "Course Name",
      "Code",
      "Credit Hours",
      "Description",
    ];

    const sampleRow = [
      "Introduction to Programming",
      "CS101",
      "3",
      "Basic programming concepts",
    ];

    const wsData = [headers, sampleRow];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [{ wch: 28 }, { wch: 10 }, { wch: 12 }, { wch: 35 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Courses");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const filename = "Course_Import_Template.xlsx";

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error("Course template error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
