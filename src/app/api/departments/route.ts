import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const departments = await prisma.department.findMany({
      include: {
        faculty: { select: { id: true, name: true, code: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(departments);
  } catch (e) {
    console.error("Departments list error:", e);
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
    const { name, code, description, facultyId } = body;
    const parsedFacultyId = Number(facultyId);

    if (!name || !code || !Number.isInteger(parsedFacultyId)) {
      return NextResponse.json(
        { error: "Name, code and facultyId are required" },
        { status: 400 }
      );
    }

    const department = await prisma.department.create({
      data: {
        name: String(name).trim(),
        code: String(code).trim().toUpperCase(),
        description: description || null,
        facultyId: parsedFacultyId,
      },
      include: {
        faculty: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json(department);
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A department with this name or code already exists" },
        { status: 400 }
      );
    }
    console.error("Create department error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
