import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const lecturers = await prisma.lecturer.findMany({
      orderBy: { name: "asc" },
      include: {
        departments: {
          include: { department: { select: { id: true, name: true, code: true } } },
        },
        courses: {
          include: { course: { select: { id: true, name: true, code: true, department: { select: { id: true, name: true, code: true } } } } },
        },
      },
    });

    return NextResponse.json(
      lecturers.map((l) => ({
        ...l,
        departments: l.departments.map((d) => d.department),
        courses: l.courses.map((c) => c.course),
      }))
    );
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
