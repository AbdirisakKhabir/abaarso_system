import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePaginationParams } from "@/lib/pagination";

// Generate a unique student ID like STD-2026-0001
async function generateStudentId(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `STD-${year}-`;

  const lastStudent = await prisma.student.findFirst({
    where: { studentId: { startsWith: prefix } },
    orderBy: { studentId: "desc" },
  });

  let nextNum = 1;
  if (lastStudent) {
    const lastNum = parseInt(lastStudent.studentId.split("-").pop() || "0", 10);
    nextNum = lastNum + 1;
  }

  return `${prefix}${String(nextNum).padStart(4, "0")}`;
}

const studentListInclude = {
  department: {
    select: { id: true, name: true, code: true },
  },
  admissionAcademicYear: {
    select: { id: true, name: true, startYear: true, endYear: true },
  },
  class: {
    select: {
      id: true,
      name: true,
      semester: true,
      year: true,
      department: { select: { code: true } },
    },
  },
} as const;

function buildStudentWhere(searchParams: URLSearchParams): Prisma.StudentWhereInput {
  const where: Prisma.StudentWhereInput = {};
  const status = searchParams.get("status");
  if (status && status !== "all") {
    where.status = status;
  }
  const departmentId = searchParams.get("departmentId");
  if (departmentId && departmentId !== "all") {
    const id = Number(departmentId);
    if (Number.isInteger(id) && id > 0) where.departmentId = id;
  }
  const classId = searchParams.get("classId");
  if (classId && classId !== "all") {
    const id = Number(classId);
    if (Number.isInteger(id) && id > 0) where.classId = id;
  }
  const q = searchParams.get("q")?.trim();
  if (q) {
    where.OR = [
      { studentId: { contains: q } },
      { firstName: { contains: q } },
      { lastName: { contains: q } },
      { email: { contains: q } },
      { motherName: { contains: q } },
      { department: { name: { contains: q } } },
    ];
  }
  return where;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const { paginate, page, pageSize, skip } = parsePaginationParams(searchParams);
    const where = buildStudentWhere(searchParams);

    if (paginate) {
      const [items, total] = await Promise.all([
        prisma.student.findMany({
          where,
          skip,
          take: pageSize,
          include: studentListInclude,
          orderBy: { createdAt: "desc" },
        }),
        prisma.student.count({ where }),
      ]);
      return NextResponse.json({ items, total, page, pageSize });
    }

    const students = await prisma.student.findMany({
      where,
      include: studentListInclude,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(students);
  } catch (e) {
    console.error("Students list error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
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
      studentId: providedStudentId,
      firstName,
      lastName,
      motherName,
      parentPhone,
      email,
      phone,
      dateOfBirth,
      gender,
      address,
      departmentId,
      admissionAcademicYearId,
      classId,
      program,
      imageUrl,
      imagePublicId,
      status,
      paymentStatus,
    } = body;

    const parsedDeptId = Number(departmentId);
    let parsedAyId: number | null = null;
    if (
      admissionAcademicYearId !== undefined &&
      admissionAcademicYearId !== null &&
      String(admissionAcademicYearId).trim() !== ""
    ) {
      const n = Number(admissionAcademicYearId);
      if (!Number.isInteger(n) || n <= 0) {
        return NextResponse.json({ error: "Invalid admission academic year" }, { status: 400 });
      }
      parsedAyId = n;
    }
    const parsedClassId = classId ? Number(classId) : null;

    if (!firstName || !lastName || !Number.isInteger(parsedDeptId)) {
      return NextResponse.json(
        { error: "First name, last name, and department are required" },
        { status: 400 }
      );
    }

    if (parsedAyId !== null) {
      const ay = await prisma.academicYear.findUnique({
        where: { id: parsedAyId },
        select: { id: true },
      });
      if (!ay) {
        return NextResponse.json({ error: "Invalid admission academic year" }, { status: 400 });
      }
    }

    // Check duplicate email only when email is provided
    const emailVal = email ? String(email).toLowerCase().trim() : null;
    if (emailVal) {
      const existing = await prisma.student.findUnique({
        where: { email: emailVal },
      });
      if (existing) {
        return NextResponse.json(
          { error: "A student with this email already exists" },
          { status: 400 }
        );
      }
    }

    // Use provided studentId or auto-generate
    let studentId: string;
    const trimmedId = providedStudentId ? String(providedStudentId).trim() : "";
    if (trimmedId) {
      const existing = await prisma.student.findUnique({
        where: { studentId: trimmedId },
      });
      if (existing) {
        return NextResponse.json(
          { error: "A student with this Student ID already exists" },
          { status: 400 }
        );
      }
      studentId = trimmedId;
    } else {
      studentId = await generateStudentId();
    }

    // Initial balance = department tuition fee, adjusted by payment status
    const dept = await prisma.department.findUnique({
      where: { id: parsedDeptId },
      select: { tuitionFee: true },
    });
    const tuitionFee = dept?.tuitionFee ?? 0;
    const ps = ["Full Scholarship", "Half Scholar", "Fully Paid"].includes(paymentStatus) ? paymentStatus : "Fully Paid";
    const initialBalance =
      ps === "Full Scholarship" ? 0
      : ps === "Half Scholar" ? tuitionFee * 0.5
      : tuitionFee;

    const student = await prisma.student.create({
      data: {
        studentId,
        firstName: String(firstName).trim(),
        lastName: String(lastName).trim(),
        motherName: motherName ? String(motherName).trim() : null,
        parentPhone: parentPhone ? String(parentPhone).trim() : null,
        email: emailVal,
        phone: phone || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        gender: gender || null,
        address: address || null,
        departmentId: parsedDeptId,
        admissionAcademicYearId: parsedAyId,
        classId: Number.isInteger(parsedClassId) ? parsedClassId : null,
        program: program || null,
        imageUrl: imageUrl || null,
        imagePublicId: imagePublicId || null,
        status: status || "Admitted",
        paymentStatus: ps,
        balance: initialBalance,
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
        admissionAcademicYear: {
          select: { id: true, name: true, startYear: true, endYear: true },
        },
        class: {
          select: { id: true, name: true, semester: true, year: true, department: { select: { code: true } } },
        },
      },
    });

    return NextResponse.json(student);
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A student with this email already exists" },
        { status: 400 }
      );
    }
    console.error("Create student error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
