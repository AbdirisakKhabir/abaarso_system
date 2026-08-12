import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAuthUser } from "@/lib/auth";
import { FINANCE_HEADS, financeHeadLabel, isFinanceHead } from "@/lib/finance-head";
import { prisma } from "@/lib/prisma";
import { parseProgram } from "@/lib/program";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const program = parseProgram(searchParams.get("program")) as "Bachelor" | "Masters";
    const search = searchParams.get("search")?.trim();
    const semester = searchParams.get("semester");
    const year = searchParams.get("year");
    const bankId = searchParams.get("bankId");
    const financeHead = searchParams.get("financeHead");
    const departmentId = searchParams.get("departmentId");
    const classId = searchParams.get("classId");
    const dateFrom = searchParams.get("dateFrom")?.trim();
    const dateTo = searchParams.get("dateTo")?.trim();

    const where: Prisma.TuitionPaymentWhereInput = {};
    const studentWhere: Prisma.StudentWhereInput = { program };
    const andFilters: Prisma.TuitionPaymentWhereInput[] = [];

    if (search) {
      studentWhere.OR = [
        { studentId: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { phone: { contains: search } },
      ];
    }
    if (departmentId) {
      const did = Number(departmentId);
      if (Number.isInteger(did) && did > 0) studentWhere.departmentId = did;
    }

    if (classId) {
      const cid = Number(classId);
      if (Number.isInteger(cid) && cid > 0) {
        const cls = await prisma.class.findUnique({
          where: { id: cid },
          select: { departmentId: true, semester: true, year: true },
        });
        if (cls) {
          studentWhere.departmentId = cls.departmentId;
          if (!semester) where.semester = cls.semester;
          if (!year) where.year = cls.year;
        } else {
          studentWhere.classId = cid;
        }
      }
    }

    where.student = studentWhere;

    if (semester) where.semester = semester;
    if (year) {
      const y = Number(year);
      if (Number.isInteger(y)) where.year = y;
    }
    if (bankId) {
      const bid = Number(bankId);
      if (Number.isInteger(bid) && bid > 0) where.bankId = bid;
    }
    if (financeHead && isFinanceHead(financeHead)) {
      where.financeHead = financeHead;
    }

    if (dateFrom || dateTo) {
      const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
      if (dateFrom && !ISO_DATE.test(dateFrom)) {
        return NextResponse.json({ error: "dateFrom must be YYYY-MM-DD" }, { status: 400 });
      }
      if (dateTo && !ISO_DATE.test(dateTo)) {
        return NextResponse.json({ error: "dateTo must be YYYY-MM-DD" }, { status: 400 });
      }
      if (dateFrom && dateTo && dateFrom > dateTo) {
        return NextResponse.json(
          { error: "dateFrom must be on or before dateTo" },
          { status: 400 }
        );
      }

      const range: Prisma.DateTimeFilter = {};
      if (dateFrom) range.gte = new Date(`${dateFrom}T00:00:00.000-14:00`);
      if (dateTo) range.lte = new Date(`${dateTo}T23:59:59.999+14:00`);

      andFilters.push({
        OR: [{ paymentDate: range }, { paidAt: range }],
      });
    }

    if (andFilters.length > 0) {
      where.AND = andFilters;
    }

    const payments = await prisma.tuitionPayment.findMany({
      where,
      include: {
        student: {
          select: {
            studentId: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true, code: true } },
            class: { select: { name: true } },
          },
        },
        bank: { select: { id: true, name: true, code: true } },
        method: { select: { id: true, name: true } },
        recordedBy: { select: { name: true, email: true } },
      },
      orderBy: [{ paymentDate: "desc" }, { paidAt: "desc" }, { id: "desc" }],
      take: 5000,
    });

    const byHeadMap = new Map<string, { total: number; count: number }>();
    for (const h of FINANCE_HEADS) {
      byHeadMap.set(h.value, { total: 0, count: 0 });
    }
    for (const p of payments) {
      const key = isFinanceHead(p.financeHead) ? p.financeHead : "semester_fee";
      const row = byHeadMap.get(key) ?? { total: 0, count: 0 };
      row.total += p.amount ?? 0;
      row.count += 1;
      byHeadMap.set(key, row);
    }

    const byHead = FINANCE_HEADS.map((h) => ({
      financeHead: h.value,
      label: h.label,
      total: byHeadMap.get(h.value)?.total ?? 0,
      count: byHeadMap.get(h.value)?.count ?? 0,
    })).filter((h) => h.count > 0);

    const totalAmount = payments.reduce((sum, p) => sum + (p.amount ?? 0), 0);

    return NextResponse.json({
      program,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      summary: {
        totalAmount,
        totalCount: payments.length,
        byHead,
      },
      payments: payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        financeHead: p.financeHead,
        financeHeadLabel: financeHeadLabel(p.financeHead),
        semester: p.semester,
        year: p.year,
        paymentDate: p.paymentDate,
        paidAt: p.paidAt,
        receiptNumber: p.receiptNumber,
        transactionId: p.transactionId,
        note: p.note,
        student: p.student,
        bank: p.bank,
        method: p.method,
        recordedBy: p.recordedBy,
      })),
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("Finance head report error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
