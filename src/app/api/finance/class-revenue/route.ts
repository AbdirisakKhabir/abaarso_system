import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  classifyStudentTermPayment,
  computeTermTuition,
  semesterAmountPaid,
  type StudentPaymentStatusFilter,
} from "@/lib/tuition-amount";
import { parseProgram } from "@/lib/program";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const program = parseProgram(searchParams.get("program")) as "Bachelor" | "Masters";
    const year = searchParams.get("year") || String(new Date().getFullYear());
    const departmentId = searchParams.get("departmentId");
    const semester = searchParams.get("semester");

    const parsedYear = Number(year);
    if (!Number.isInteger(parsedYear)) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }

    const where: {
      year: number;
      program: "Bachelor" | "Masters";
      semester?: string;
      departmentId?: number;
    } = {
      year: parsedYear,
      program,
    };
    if (semester) where.semester = semester;
    if (departmentId) where.departmentId = Number(departmentId);

    const classes = await prisma.class.findMany({
      where,
      include: {
        department: { select: { id: true, name: true, code: true } },
        students: {
          where: { status: "Admitted" },
          include: {
            department: { select: { tuitionFee: true } },
            tuitionPayments: {
              select: { semester: true, year: true, amount: true },
            },
          },
        },
      },
      orderBy: [{ year: "desc" }, { semester: "asc" }, { name: "asc" }],
    });

    const countFilter: StudentPaymentStatusFilter = "all";

    const result = classes.map((cls) => {
      let revenue = 0;
      let paidCount = 0;
      let unpaidCount = 0;
      let studentCount = 0;

      for (const student of cls.students) {
        const termPayments = student.tuitionPayments.filter(
          (p) => p.semester === cls.semester && p.year === cls.year
        );
        const classification = classifyStudentTermPayment(
          student,
          termPayments,
          countFilter
        );
        if (classification === "excluded") continue;

        studentCount++;
        revenue += semesterAmountPaid(termPayments);
        if (classification === "paid") paidCount++;
        else unpaidCount++;
      }

      return {
        id: cls.id,
        name: cls.name,
        semester: cls.semester,
        year: cls.year,
        department: cls.department,
        studentCount,
        paidCount,
        unpaidCount,
        revenue,
      };
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("Class revenue error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
