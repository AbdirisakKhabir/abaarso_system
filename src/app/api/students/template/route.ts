import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { workbookBufferFromAoa } from "@/lib/excel";

/** Blank rows prefilled with the department/class so staff only type student details. */
const PREFILLED_ROWS = 100;

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const departmentId = Number(searchParams.get("departmentId"));
    const classId = Number(searchParams.get("classId"));
    if (!Number.isInteger(departmentId) || departmentId <= 0 || !Number.isInteger(classId) || classId <= 0) {
      return NextResponse.json(
        { error: "Select a department and a class to export the template" },
        { status: 400 }
      );
    }
    const cls = await prisma.class.findUnique({
      where: { id: classId },
      select: {
        name: true,
        semester: true,
        year: true,
        program: true,
        departmentId: true,
        department: { select: { code: true } },
      },
    });
    if (!cls) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }
    if (cls.departmentId !== departmentId) {
      return NextResponse.json(
        { error: "The selected class does not belong to the selected department" },
        { status: 400 }
      );
    }
    const deptCode = cls.department.code;

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
      "department_code",
      "program",
      "class",
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
      deptCode,
      cls.program,
      cls.name,
    ];

    const blankRow = headers.map((_, i) =>
      i === headers.length - 3 ? deptCode : i === headers.length - 2 ? cls.program : i === headers.length - 1 ? cls.name : ""
    );

    const columnWidths = headers.map((h) => Math.max(h.length + 2, 14));

    const buf = await workbookBufferFromAoa({
      sheetName: "ActiveStudentsTemplate",
      rows: [headers, sampleRow, ...Array.from({ length: PREFILLED_ROWS }, () => blankRow)],
      columnWidths,
    });
    const safe = (v: string) => v.replace(/[^A-Za-z0-9-]+/g, "_").replace(/^_+|_+$/g, "");
    const filename = `Student_Import_Template_${safe(deptCode)}_${safe(cls.name)}_${safe(cls.semester)}_${cls.year}.xlsx`;

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
