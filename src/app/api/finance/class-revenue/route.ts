import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  classifyStudentTermPayment,
  filterTermPayments,
  semesterAmountPaid,
  type StudentPaymentStatusFilter,
} from "@/lib/tuition-amount";
import { parseProgram } from "@/lib/program";
import { findEnrollmentStudentIdsByClass } from "@/lib/enrollment";

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
          select: { id: true },
        },
      },
      orderBy: [{ year: "desc" }, { semester: "asc" }, { name: "asc" }],
    });

    const classIds = classes.map((c) => c.id);

    // Roster per class is upgrade-safe: historical enrollment plus current
    // students (fallback for terms recorded before history tracking).
    const historyByClass = await findEnrollmentStudentIdsByClass(classIds);
    const rosterByClass = new Map<number, Set<number>>();
    for (const cls of classes) {
      const set = new Set<number>(historyByClass.get(cls.id) ?? []);
      for (const s of cls.students) set.add(s.id);
      rosterByClass.set(cls.id, set);
    }

    const allStudentIds = [
      ...new Set([...rosterByClass.values()].flatMap((s) => [...s])),
    ];

    const students = allStudentIds.length
      ? await prisma.student.findMany({
          where: { id: { in: allStudentIds } },
          select: {
            id: true,
            paymentStatus: true,
            customSemesterFee: true,
            department: { select: { tuitionFee: true } },
            tuitionPayments: { select: { semester: true, year: true, amount: true } },
          },
        })
      : [];
    const studentById = new Map(students.map((s) => [s.id, s]));

    const countFilter: StudentPaymentStatusFilter = "all";

    const result = classes.map((cls) => {
      let revenue = 0;
      let paidCount = 0;
      let unpaidCount = 0;
      let studentCount = 0;

      const roster = rosterByClass.get(cls.id) ?? new Set<number>();
      for (const sid of roster) {
        const student = studentById.get(sid);
        if (!student) continue;
        const termPayments = filterTermPayments(
          student.tuitionPayments,
          cls.semester,
          cls.year
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
