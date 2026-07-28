import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePaginationParams } from "@/lib/pagination";
import { isValidSemester } from "@/lib/semesters";
import { DEFAULT_PROGRAM, parseProgram } from "@/lib/program";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const { paginate, page, pageSize, skip } = parsePaginationParams(searchParams);
    const q = searchParams.get("q")?.trim();
    const departmentId = searchParams.get("departmentId");
    const semester = searchParams.get("semester");
    const activeOnly = searchParams.get("active") === "true";
    const programFilter = parseProgram(searchParams.get("program"), { allowAll: true });
    const where: Prisma.ClassWhereInput = {};
    if (activeOnly) {
      where.isActive = true;
    }
    if (programFilter && programFilter !== "all") {
      where.program = programFilter;
    }
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { semester: { contains: q } },
        { room: { contains: q } },
        { department: { name: { contains: q } } },
      ];
    }
    if (departmentId && departmentId !== "all") {
      const id = Number(departmentId);
      if (Number.isInteger(id) && id > 0) where.departmentId = id;
    }
    if (semester && semester !== "all") {
      where.semester = semester;
    }

    const include = {
      department: { select: { id: true, name: true, code: true, program: true } },
    } as const;

    const orderBy = [{ year: "desc" as const }, { semester: "asc" as const }, { name: "asc" as const }];

    if (paginate) {
      const [items, total] = await Promise.all([
        prisma.class.findMany({
          where,
          skip,
          take: pageSize,
          include,
          orderBy,
        }),
        prisma.class.count({ where }),
      ]);
      return NextResponse.json({ items, total, page, pageSize });
    }

    const classes = await prisma.class.findMany({
      where,
      include,
      orderBy,
    });

    return NextResponse.json(classes);
  } catch (e) {
    console.error("Classes list error:", e);
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
    const { name, departmentId, semester, year, room, schedule, capacity, program } = body;
    const parsedDepartmentId = Number(departmentId);
    const parsedYear = Number(year);

    if (!name || !Number.isInteger(parsedDepartmentId) || !semester || !Number.isInteger(parsedYear)) {
      return NextResponse.json(
        { error: "Name, departmentId, semester, and year are required" },
        { status: 400 }
      );
    }

    let resolvedProgram = parseProgram(program) ?? DEFAULT_PROGRAM;
    if (program == null || program === "") {
      const dept = await prisma.department.findUnique({
        where: { id: parsedDepartmentId },
        select: { program: true },
      });
      if (dept?.program) resolvedProgram = parseProgram(dept.program) ?? DEFAULT_PROGRAM;
    }

    if (!(await isValidSemester(semester, resolvedProgram))) {
      return NextResponse.json(
        { error: "Invalid semester. Use a semester from the Semesters settings for this program." },
        { status: 400 }
      );
    }

    const cls = await prisma.class.create({
      data: {
        name: String(name).trim(),
        departmentId: parsedDepartmentId,
        semester: String(semester).trim(),
        year: parsedYear,
        room: room || null,
        schedule: schedule || null,
        capacity: Number(capacity) > 0 ? Number(capacity) : 40,
        program: resolvedProgram,
      },
      include: {
        department: { select: { id: true, name: true, code: true, program: true } },
      },
    });

    return NextResponse.json(cls);
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A class with this name in the same semester/year already exists for this program" },
        { status: 400 }
      );
    }
    console.error("Create class error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
