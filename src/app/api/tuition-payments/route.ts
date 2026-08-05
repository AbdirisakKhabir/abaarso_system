import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidSemester } from "@/lib/semesters";
import { perSemesterTuition, validateSemesterPayment } from "@/lib/tuition-amount";

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

    // Class filter: use the class's department + semester/year so payments still
    // appear after students were upgraded out of that class.
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

    if (!studentIdStr || !semester || !year) {
      return NextResponse.json(
        { error: "Student ID, semester, and year are required" },
        { status: 400 }
      );
    }

    if (!bankId) {
      return NextResponse.json(
        { error: "Bank is required for recording deposits" },
        { status: 400 }
      );
    }

    const bank = await prisma.bank.findUnique({
      where: { id: Number(bankId) },
    });
    if (!bank || !bank.isActive) {
      return NextResponse.json({ error: "Invalid or inactive bank" }, { status: 400 });
    }

    if (!(await isValidSemester(semester))) {
      return NextResponse.json(
        { error: "Invalid semester. Use a semester from the Semesters settings." },
        { status: 400 }
      );
    }

    const student = await prisma.student.findUnique({
      where: { studentId: String(studentIdStr).trim() },
      include: { department: { select: { tuitionFee: true } } },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const expectedFee = perSemesterTuition(
      student.department.tuitionFee ?? 0,
      student.paymentStatus,
      student.customSemesterFee
    );

    const amt =
      amount != null
        ? Number(amount)
        : expectedFee;

    const existingPayments = await prisma.tuitionPayment.findMany({
      where: {
        studentId: student.id,
        semester: String(semester),
        year: Number(year),
      },
      select: { amount: true },
    });

    const paymentCheck = validateSemesterPayment(existingPayments, amt, expectedFee);
    if (!paymentCheck.ok) {
      return NextResponse.json({ error: paymentCheck.error }, { status: 400 });
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
          amount: amt,
          semester: String(semester),
          year: Number(year),
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
          note: note || null,
        },
      });
      const newBalance = Math.max(0, (student.balance ?? 0) - amt);
      await tx.student.update({
        where: { id: student.id },
        data: { balance: newBalance },
      });
      await tx.bank.update({
        where: { id: bank.id },
        data: { balance: { increment: amt } },
      });
      await tx.transactionHistory.create({
        data: {
          type: "deposit",
          amount: amt,
          bankId: bank.id,
          description: `Tuition: ${student.firstName} ${student.lastName} (${student.studentId}) - ${String(semester)} ${year}`,
          studentId: student.id,
          tuitionPaymentId: p.id,
          createdById: auth.userId,
        },
      });
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
