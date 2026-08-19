import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PROGRAM, parseProgram } from "@/lib/program";
import { semestersMatch } from "@/lib/finance-report-scope";
import { filterTermPayments, semesterAmountPaid } from "@/lib/tuition-amount";
import { classRosterStudentWhere } from "@/lib/class-roster";

const EPS = 0.01;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const program = parseProgram(searchParams.get("program")) as "Bachelor" | "Masters";
    const search = searchParams.get("search")?.trim();
    const semester = searchParams.get("semester")?.trim();
    const yearRaw = searchParams.get("year");
    const year = yearRaw ? Number(yearRaw) : null;
    const departmentId = searchParams.get("departmentId");
    const classId = searchParams.get("classId");
    const unknownOnly = searchParams.get("unknownOnly") === "true";

    const studentWhere: Prisma.StudentWhereInput = {
      program: program || DEFAULT_PROGRAM,
      status: { in: ["Admitted", "Graduated"] },
      OR: [{ balance: { gt: 0 } }, { tuitionCharges: { some: {} } }],
    };

    if (search) {
      studentWhere.AND = [
        {
          OR: [
            { studentId: { contains: search } },
            { firstName: { contains: search } },
            { lastName: { contains: search } },
            { phone: { contains: search } },
          ],
        },
      ];
    }
    if (departmentId) {
      const did = Number(departmentId);
      if (Number.isInteger(did) && did > 0) studentWhere.departmentId = did;
    }
    if (classId) {
      const cid = Number(classId);
      if (Number.isInteger(cid) && cid > 0) {
        const rosterWhere = await classRosterStudentWhere(cid);
        studentWhere.id = rosterWhere.id;
      }
    }

    const students = await prisma.student.findMany({
      where: studentWhere,
      select: {
        id: true,
        studentId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        paymentStatus: true,
        balance: true,
        department: { select: { name: true, code: true } },
        class: { select: { name: true, semester: true, year: true } },
        tuitionCharges: {
          select: { semester: true, year: true, amount: true },
        },
        tuitionPayments: {
          where: { financeHead: "semester_fee" },
          select: { semester: true, year: true, amount: true },
        },
      },
      orderBy: [{ studentId: "asc" }],
    });

    type TermRow = {
      semester: string;
      year: number;
      charged: number;
      paid: number;
      remaining: number;
    };

    const rows: {
      id: number;
      studentId: string;
      firstName: string;
      lastName: string;
      email: string | null;
      phone: string | null;
      paymentStatus: string;
      department: { name: string; code: string };
      className: string | null;
      currentClassTerm: string | null;
      balance: number;
      terms: TermRow[];
      unknownBalance: number;
      knownRemaining: number;
      remainingTotal: number;
    }[] = [];

    for (const s of students) {
      const grouped = new Map<string, { semester: string; year: number; charged: number }>();
      for (const c of s.tuitionCharges) {
        const key = `${c.semester}\0${c.year}`;
        const cur = grouped.get(key) ?? { semester: c.semester, year: c.year, charged: 0 };
        cur.charged += c.amount ?? 0;
        grouped.set(key, cur);
      }

      const terms: TermRow[] = [];
      for (const g of grouped.values()) {
        const paid = semesterAmountPaid(
          filterTermPayments(s.tuitionPayments, g.semester, g.year)
        );
        const remaining = round2(Math.max(0, g.charged - paid));
        terms.push({
          semester: g.semester,
          year: g.year,
          charged: round2(g.charged),
          paid: round2(paid),
          remaining,
        });
      }
      terms.sort((a, b) => a.year - b.year || a.semester.localeCompare(b.semester));

      const knownRemaining = round2(terms.reduce((sum, t) => sum + t.remaining, 0));
      const unknownBalance = round2(Math.max(0, (s.balance ?? 0) - knownRemaining));
      const remainingTotal = round2(knownRemaining + unknownBalance);

      if (remainingTotal < EPS) continue;

      const yearFilter = year != null && Number.isInteger(year) ? year : null;
      const termFilterActive = Boolean(semester) || yearFilter != null;

      let filteredTerms = terms.filter((t) => t.remaining >= EPS);
      if (semester) {
        filteredTerms = filteredTerms.filter((t) => semestersMatch(t.semester, semester));
      }
      if (yearFilter != null) {
        filteredTerms = filteredTerms.filter((t) => t.year === yearFilter);
      }

      if (unknownOnly) {
        if (unknownBalance < EPS) continue;
        rows.push({
          id: s.id,
          studentId: s.studentId,
          firstName: s.firstName,
          lastName: s.lastName,
          email: s.email,
          phone: s.phone,
          paymentStatus: s.paymentStatus,
          department: s.department,
          className: s.class?.name ?? null,
          currentClassTerm: s.class ? `${s.class.semester} ${s.class.year}` : null,
          balance: round2(s.balance ?? 0),
          terms: [],
          unknownBalance,
          knownRemaining,
          remainingTotal: unknownBalance,
        });
        continue;
      }

      const includeUnknown = unknownBalance >= EPS && !termFilterActive;
      if (termFilterActive && filteredTerms.length === 0) continue;
      if (!termFilterActive && filteredTerms.length === 0 && !includeUnknown) continue;

      rows.push({
        id: s.id,
        studentId: s.studentId,
        firstName: s.firstName,
        lastName: s.lastName,
        email: s.email,
        phone: s.phone,
        paymentStatus: s.paymentStatus,
        department: s.department,
        className: s.class?.name ?? null,
        currentClassTerm: s.class ? `${s.class.semester} ${s.class.year}` : null,
        balance: round2(s.balance ?? 0),
        terms: filteredTerms,
        unknownBalance: includeUnknown ? unknownBalance : 0,
        knownRemaining,
        remainingTotal: termFilterActive
          ? round2(filteredTerms.reduce((sum, t) => sum + t.remaining, 0))
          : remainingTotal,
      });
    }

    const summary = {
      studentCount: rows.length,
      totalBalance: round2(rows.reduce((sum, r) => sum + r.balance, 0)),
      knownRemaining: round2(rows.reduce((sum, r) => sum + r.terms.reduce((s, t) => s + t.remaining, 0), 0)),
      unknownRemaining: round2(rows.reduce((sum, r) => sum + r.unknownBalance, 0)),
      studentsWithUnknown: rows.filter((r) => r.unknownBalance >= EPS).length,
    };

    return NextResponse.json({
      program,
      semester: semester || null,
      year: year != null && Number.isInteger(year) ? year : null,
      unknownOnly,
      students: rows,
      summary,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Student balances report error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
