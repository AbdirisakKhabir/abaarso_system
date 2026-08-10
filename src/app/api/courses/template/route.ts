import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { workbookBufferFromAoa } from "@/lib/excel";

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

    const buf = await workbookBufferFromAoa({
      sheetName: "Courses",
      rows: [headers, sampleRow],
      columnWidths: [28, 10, 12, 35],
    });
    const filename = "Course_Import_Template.xlsx";

    return new NextResponse(Buffer.from(buf), {
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
