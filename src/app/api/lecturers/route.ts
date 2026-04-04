import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePaginationParams } from "@/lib/pagination";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const { paginate, page, pageSize, skip } = parsePaginationParams(searchParams);
    const q = searchParams.get("q")?.trim();
    const where: Prisma.LecturerWhereInput = {};
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { email: { contains: q } },
        { phone: { contains: q } },
        { degree: { contains: q } },
      ];
    }

    const lecturerInclude = {
      departments: {
        include: { department: { select: { id: true, name: true, code: true } } },
      },
      courses: {
        include: {
          course: {
            select: {
              id: true,
              name: true,
              code: true,
              department: { select: { id: true, name: true, code: true } },
            },
          },
        },
      },
    } as const;

    type LecturerListRow = Prisma.LecturerGetPayload<{ include: typeof lecturerInclude }>;

    const mapLecturer = (l: LecturerListRow) => ({
      ...l,
      departments: l.departments.map((d) => d.department),
      courses: l.courses.map((c) => c.course),
    });

    if (paginate) {
      const [rows, total] = await Promise.all([
        prisma.lecturer.findMany({
          where,
          skip,
          take: pageSize,
          include: lecturerInclude,
          orderBy: { name: "asc" },
        }),
        prisma.lecturer.count({ where }),
      ]);
      return NextResponse.json({
        items: rows.map(mapLecturer),
        total,
        page,
        pageSize,
      });
    }

    const lecturers = await prisma.lecturer.findMany({
      where,
      include: lecturerInclude,
      orderBy: { name: "asc" },
    });

    return NextResponse.json(lecturers.map(mapLecturer));
  } catch (e) {
    console.error("Lecturers list error:", e);
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
    const { name, email, phone, degree, departmentIds, courseIds, imageUrl, imagePublicId, cvUrl, cvPublicId } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    const deptIds = Array.isArray(departmentIds)
      ? departmentIds.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id) && id > 0)
      : [];
    const crsIds = Array.isArray(courseIds)
      ? courseIds.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id) && id > 0)
      : [];

    const lecturer = await prisma.lecturer.create({
      data: {
        name: String(name).trim(),
        email: String(email).trim().toLowerCase(),
        phone: phone ? String(phone).trim() : null,
        degree: degree ? String(degree).trim() : null,
        imageUrl: imageUrl ? String(imageUrl).trim() : null,
        imagePublicId: imagePublicId ? String(imagePublicId).trim() : null,
        cvUrl: cvUrl ? String(cvUrl).trim() : null,
        cvPublicId: cvPublicId ? String(cvPublicId).trim() : null,
        departments: deptIds.length > 0
          ? { create: deptIds.map((departmentId: number) => ({ departmentId })) }
          : undefined,
        courses: crsIds.length > 0
          ? { create: crsIds.map((courseId: number) => ({ courseId })) }
          : undefined,
      },
      include: {
        departments: { include: { department: { select: { id: true, name: true, code: true } } } },
        courses: { include: { course: { select: { id: true, name: true, code: true, department: { select: { id: true, name: true, code: true } } } } } },
      },
    });

    return NextResponse.json({
      ...lecturer,
      departments: lecturer.departments.map((d) => d.department),
      courses: lecturer.courses.map((c) => c.course),
    });
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A lecturer with this email already exists" },
        { status: 400 }
      );
    }
    console.error("Create lecturer error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
