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
      "students_full_name",
      "gender",
      "date_of_birth",
      "email",
      "phone",
      "address",
      "enrollment_date",
      "is_disabled",
      "learning_mode",
      "student_status",
      "scholarship",
      "education_level",
      "institution_name",
      "grade",
      "graduation_year",
      "certificate_number",
      "verified",
    ];

    const sampleRow = [
      "Ahmed Hassan Ali",
      "Male",
      "2005-01-15",
      "ahmed@example.com",
      "+252 61 7654321",
      "Hargeisa, Somaliland",
      "2024-09-01",
      "No",
      "Full-time",
      "Admitted",
      "No",
      "Secondary School",
      "Hargeisa Secondary School",
      "A",
      "2023",
      "CERT-2023-0456",
      "Yes",
    ];

    const columnWidths = headers.map((h) => Math.max(h.length + 2, 14));

    const buf = await workbookBufferFromAoa({
      sheetName: "ActiveStudentsTemplate",
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
