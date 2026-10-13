import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidSemester } from "@/lib/semesters";
import { perSemesterTuition, validateSemesterPayment } from "@/lib/tuition-amount";
import {
  financeHeadLabel,
  isFinanceHead,
  isTuitionHead,
  parseFinanceHead,
} from "@/lib/finance-head";
import { findClassRosterStudentIds } from "@/lib/class-roster";
import { computeStudentOwing, findTerm } from "@/lib/student-term-ledger";
import { ensureEnrollmentForTerm } from "@/lib/enrollment";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const search = searchParams.get("search")?.trim();
    const semester = searchParams.get("semester");
    const year = searchParams.get("year");
    const bankId = searchParams.get("bankId");
    const paymentMethod = searchParams.get("paymentMethod");
    const financeHead = searchParams.get("financeHead");
    const departmentId = searchParams.get("departmentId");
    const classId = searchParams.get("classId");
    const dateFrom = searchParams.get("dateFrom")?.trim();
    const dateTo = searchParams.get("dateTo")?.trim();
    const datesOnly = searchParams.get("datesOnly") === "true";
    const pageParam = searchParams.get("page");
    const pageSizeParam = searchParams.get("pageSize");
    const paginate = pageParam != null || pageSizeParam != null;
    const page = Math.max(1, Number(pageParam || 1));
    const pageSize = Math.min(100, Math.max(1, Number(pageSizeParam || 10)));

    const where: Prisma.TuitionPaymentWhereInput = {};
    const studentWhere: Prisma.StudentWhereInput = {};
    const andFilters: Prisma.TuitionPaymentWhereInput[] = [];

    if (studentId) {
      studentWhere.studentId = String(studentId);
    }
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

    // Class filter: historical roster + that class's term (survives upgrades).
    if (classId) {
      const cid = Number(classId);
      if (Number.isInteger(cid) && cid > 0) {
        const cls = await prisma.class.findUnique({
          where: { id: cid },
          select: { semester: true, year: true },
        });
        if (cls) {
          const ids = await findClassRosterStudentIds(cid);
          studentWhere.id = { in: ids.length > 0 ? ids : [-1] };
          if (!semester) where.semester = cls.semester;
          if (!year) where.year = cls.year;
        } else {
          studentWhere.classId = cid;
        }
      }
    }

    if (Object.keys(studentWhere).length > 0) {
      where.student = studentWhere;
    }

    if (semester) where.semester = semester;
    if (year) {
      const y = Number(year);
      if (Number.isInteger(y)) where.year = y;
    }
    if (bankId) {
      const bid = Number(bankId);
      if (Number.isInteger(bid) && bid > 0) where.bankId = bid;
    }
    if (
      paymentMethod &&
      ["bank_receipt", "electronic", "cash_on_hand"].includes(paymentMethod)
    ) {
      where.paymentMethod = paymentMethod;
    }
    if (financeHead && isFinanceHead(financeHead)) {
      where.financeHead = financeHead;
    }

    if (dateFrom || dateTo) {
      const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
      if (dateFrom && !ISO_DATE.test(dateFrom)) {
        return NextResponse.json(
          { error: "dateFrom must be YYYY-MM-DD" },
          { status: 400 }
        );
      }
      if (dateTo && !ISO_DATE.test(dateTo)) {
        return NextResponse.json(
          { error: "dateTo must be YYYY-MM-DD" },
          { status: 400 }
        );
      }
      if (dateFrom && dateTo && dateFrom > dateTo) {
        return NextResponse.json(
          { error: "dateFrom must be on or before dateTo" },
          { status: 400 }
        );
      }

      // Wide timezone-safe bounds so calendar-day picks match stored datetimes.
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

    if (datesOnly) {
      const rows = await prisma.tuitionPayment.findMany({
        where,
        select: { paymentDate: true, paidAt: true },
        orderBy: [{ paymentDate: "desc" }],
        take: 5000,
      });
      const set = new Set<string>();
      for (const r of rows) {
        const d = r.paymentDate || r.paidAt;
        if (d) set.add(d.toISOString().slice(0, 10));
      }
      const dates = [...set].sort((a, b) => b.localeCompare(a));
      return NextResponse.json({ dates });
    }

    const include = {
      student: {
        select: {
          id: true,
          studentId: true,
          firstName: true,
          lastName: true,
          department: { select: { id: true, name: true, code: true } },
          class: {
            select: {
              id: true,
              name: true,
              semester: true,
              year: true,
              department: { select: { code: true } },
            },
          },
        },
      },
      bank: { select: { id: true, name: true, code: true } },
      method: { select: { id: true, name: true } },
      recordedBy: { select: { id: true, name: true, email: true } },
    } as const;

    const orderBy = [
      { paymentDate: "desc" as const },
      { paidAt: "desc" as const },
      { id: "desc" as const },
    ];

    if (paginate) {
      const skip = (page - 1) * pageSize;
      const [items, total] = await Promise.all([
        prisma.tuitionPayment.findMany({
          where,
          skip,
          take: pageSize,
          include,
          orderBy,
        }),
        prisma.tuitionPayment.count({ where }),
      ]);
      return NextResponse.json({ items, total, page, pageSize });
    }

    const payments = await prisma.tuitionPayment.findMany({
      where,
      include,
      orderBy,
    });

    return NextResponse.json(payments);
  } catch (e) {
    console.error("Tuition payments list error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      studentId: studentIdStr,
      amount,
      semester,
      year,
      note,
      bankId,
      paymentMethod,
      receiptNumber,
      transactionId,
      paymentDate,
    } = body;

    const paymentMethodId =
      body.paymentMethodId != null && String(body.paymentMethodId).trim() !== ""
        ? Number(body.paymentMethodId)
        : null;

    const financeHead = parseFinanceHead(body.financeHead);
    const tuitionHead = isTuitionHead(financeHead);

    if (!studentIdStr) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 });
    }

    if (tuitionHead && (!semester || year == null || year === "")) {
      return NextResponse.json(
        { error: "Semester and year are required for Semester Fee payments" },
        { status: 400 }
      );
    }

    // Resolve the bank: either directly (bankId) or via a configured payment method.
    let selectedMethodId: number | null = null;
    let effectiveBankId: number | null = bankId != null ? Number(bankId) : null;

    if (paymentMethodId != null) {
      if (!Number.isInteger(paymentMethodId)) {
        return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
      }
      const method = await prisma.paymentMethod.findUnique({
        where: { id: paymentMethodId },
      });
      if (!method || !method.isActive) {
        return NextResponse.json(
          { error: "Invalid or inactive payment method" },
          { status: 400 }
        );
      }
      selectedMethodId = method.id;
      effectiveBankId = method.bankId;
    }

    if (!effectiveBankId || !Number.isInteger(effectiveBankId)) {
      return NextResponse.json(
        { error: "A payment method or bank is required for recording deposits" },
        { status: 400 }
      );
    }

    const bank = await prisma.bank.findUnique({
      where: { id: effectiveBankId },
    });
    if (!bank || !bank.isActive) {
      return NextResponse.json({ error: "Invalid or inactive bank" }, { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { studentId: String(studentIdStr).trim() },
      include: {
        department: { select: { tuitionFee: true, id: true } },
        class: { select: { semester: true, year: true, id: true } },
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    let resolvedSemester = semester != null ? String(semester).trim() : "";
    let resolvedYear =
      year != null && year !== "" && Number.isInteger(Number(year))
        ? Number(year)
        : null;

    if (!resolvedSemester && student.class?.semester) {
      resolvedSemester = student.class.semester;
    }
    if (resolvedYear == null && student.class?.year != null) {
      resolvedYear = student.class.year;
    }

    if (!resolvedSemester || resolvedYear == null) {
      const firstSemester = await prisma.semester.findFirst({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { name: true },
      });
      if (!resolvedSemester) {
        resolvedSemester = firstSemester?.name ?? "General";
      }
      if (resolvedYear == null) {
        resolvedYear = new Date().getFullYear();
      }
    }

    if (tuitionHead && !(await isValidSemester(resolvedSemester))) {
      return NextResponse.json(
        { error: "Invalid semester. Use a semester from the Semesters settings." },
        { status: 400 }
      );
    }

    const expectedPerSemester = perSemesterTuition(
      student.department.tuitionFee ?? 0,
      student.paymentStatus,
      student.customSemesterFee
    );

    // Same term ledger the Finance screen shows: charges and payments matched
    // loosely by semester ("Semester 5" ≈ "Semester Five"), plus any balance not
    // tied to a charged term. Partial installments of any amount are allowed
    // until the student's balance is cleared.
    let termRemaining = 0;
    let unknownBalance = 0;
    let otherUnpaidTerms: string[] = [];
    if (tuitionHead) {
      const [enrollments, charges, payments] = await Promise.all([
        prisma.studentEnrollment.findMany({
          where: { studentId: student.id },
          select: { semester: true, year: true },
        }),
        prisma.tuitionCharge.findMany({
          where: { studentId: student.id },
          select: { semester: true, year: true, amount: true },
        }),
        prisma.tuitionPayment.findMany({
          where: { studentId: student.id, financeHead: "semester_fee" },
          select: { semester: true, year: true, amount: true },
        }),
      ]);
      const owing = computeStudentOwing({
        currentClass: student.class,
        enrollments,
        charges,
        payments,
        expectedPerSemester,
        accountBalance: student.balance ?? 0,
      });
      const term = findTerm(owing.terms, resolvedSemester, resolvedYear);
      termRemaining = term?.remaining ?? 0;
      unknownBalance = owing.unknownBalance;
      otherUnpaidTerms = owing.terms
        .filter((t) => t !== term && t.alreadyCharged && t.remaining > 1e-6)
        .map((t) => `${t.semester} ${t.year} ($${t.remaining.toFixed(2)})`);
    }

    const amt =
      amount != null
        ? Number(amount)
        : tuitionHead
          ? Math.max(termRemaining, unknownBalance)
          : 0;

    if (tuitionHead) {
      const paymentCheck = validateSemesterPayment(amt, {
        termLabel: `${resolvedSemester} ${resolvedYear}`,
        termRemaining,
        unknownBalance,
        otherUnpaidTerms,
      });
      if (!paymentCheck.ok) {
        return NextResponse.json({ error: paymentCheck.error }, { status: 400 });
      }
    } else if (!(amt > 0)) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    const method = String(paymentMethod || "bank_receipt");
    if (method === "bank_receipt" && !String(receiptNumber || "").trim()) {
      return NextResponse.json(
        { error: "Receipt number is required for bank deposit" },
        { status: 400 }
      );
    }
    if (method === "electronic" && !String(transactionId || "").trim()) {
      return NextResponse.json(
        { error: "Transaction ID is required for electronic payment" },
        { status: 400 }
      );
    }

    const paymentMethodVal =
      method === "electronic"
        ? "electronic"
        : method === "cash_on_hand"
          ? "cash_on_hand"
          : "bank_receipt";
    const paymentDateVal = paymentDate ? new Date(paymentDate) : new Date();

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.tuitionPayment.create({
        data: {
          studentId: student.id,
          bankId: bank.id,
          paymentMethodId: selectedMethodId,
          amount: amt,
          semester: resolvedSemester,
          year: resolvedYear,
          financeHead,
          paymentMethod: paymentMethodVal,
          receiptNumber:
            paymentMethodVal === "bank_receipt" && receiptNumber
              ? String(receiptNumber).trim()
              : null,
          transactionId:
            paymentMethodVal === "electronic" && transactionId
              ? String(transactionId).trim()
              : null,
          paymentDate: paymentDateVal,
          recordedById: auth.userId,
          note: (() => {
            const text = note == null ? "" : String(note).trim();
            return text ? text.slice(0, 8000) : null;
          })(),
        },
      });
      // Only Semester Fee reduces the student's tuition balance; other heads are
      // standalone fees that are still banked but don't touch tuition receivables.
      if (tuitionHead) {
        const newBalance = Math.max(0, (student.balance ?? 0) - amt);
        await tx.student.update({
          where: { id: student.id },
          data: { balance: newBalance },
        });
      }
      await tx.bank.update({
        where: { id: bank.id },
        data: { balance: { increment: amt } },
      });
      await tx.transactionHistory.create({
        data: {
          type: "deposit",
          amount: amt,
          bankId: bank.id,
          description: `${financeHeadLabel(financeHead)}: ${student.firstName} ${student.lastName} (${student.studentId}) - ${resolvedSemester} ${resolvedYear}`,
          studentId: student.id,
          tuitionPaymentId: p.id,
          createdById: auth.userId,
        },
      });
      if (tuitionHead) {
        const classIdForTerm =
          student.class &&
          student.class.semester === resolvedSemester &&
          student.class.year === resolvedYear
            ? student.class.id
            : null;
        await ensureEnrollmentForTerm(tx, {
          studentId: student.id,
          semester: resolvedSemester,
          year: resolvedYear,
          departmentId: student.departmentId,
          program: student.program,
          classId: classIdForTerm,
        });
      }
      return tx.tuitionPayment.findUnique({
        where: { id: p.id },
        include: {
          student: {
            select: {
              studentId: true,
              firstName: true,
              lastName: true,
              department: { select: { name: true, code: true } },
            },
          },
        },
      });
    });

    return NextResponse.json(payment);
  } catch (e: unknown) {
    console.error("Create tuition payment error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
