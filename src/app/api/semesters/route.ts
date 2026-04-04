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
    const activeOnly = searchParams.get("active") === "true";
    const q = searchParams.get("q")?.trim();

    const where: Prisma.SemesterWhereInput = {};
    if (activeOnly) where.isActive = true;
    if (q) {
      where.name = { contains: q };
    }

    const orderBy = [{ sortOrder: "asc" as const }, { name: "asc" as const }];

    if (paginate) {
      const [items, total] = await Promise.all([
        prisma.semester.findMany({
          where,
          skip,
          take: pageSize,
          orderBy,
        }),
        prisma.semester.count({ where }),
      ]);
      return NextResponse.json({ items, total, page, pageSize });
    }

    const semesters = await prisma.semester.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy,
    });

    return NextResponse.json(semesters);
  } catch (e) {
    console.error("Semesters list error:", e);
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
    const { name, sortOrder } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const semester = await prisma.semester.create({
      data: {
        name: String(name).trim(),
        sortOrder: Number.isInteger(Number(sortOrder)) ? Number(sortOrder) : 0,
      },
    });

    return NextResponse.json(semester);
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A semester with this name already exists" },
        { status: 400 }
      );
    }
    console.error("Create semester error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
