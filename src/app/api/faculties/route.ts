import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const faculties = await prisma.faculty.findMany({
      include: {
        _count: { select: { departments: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(
      faculties.map((f) => ({
        id: f.id,
        name: f.name,
        code: f.code,
        description: f.description,
        program: f.program,
        isActive: f.isActive,
        departmentCount: f._count.departments,
        createdAt: f.createdAt,
      }))
    );
  } catch (e) {
    console.error("Faculties list error:", e);
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
    const { name, code, description, program } = body;

    if (!name || !code) {
      return NextResponse.json(
        { error: "Name and code are required" },
        { status: 400 }
      );
    }

    const faculty = await prisma.faculty.create({
      data: {
        name: String(name).trim(),
        code: String(code).trim().toUpperCase(),
        description: description || null,
        program: program || null,
      },
    });

    return NextResponse.json(faculty);
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A faculty with this name or code already exists" },
        { status: 400 }
      );
    }
    console.error("Create faculty error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
