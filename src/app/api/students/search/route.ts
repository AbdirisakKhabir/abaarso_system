import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);

    if (!q || q.length < 2) {
      return NextResponse.json([]);
    }

    const search = `%${q}%`;
    const students = await prisma.student.findMany({
      where: {
        OR: [
          { studentId: { contains: q } },
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { phone: { contains: q } },
          { email: { contains: q } },
        ],
      },
      take: limit,
      include: {
        department: { select: { id: true, name: true, code: true, tuitionFee: true } },
        class: {
          select: {
            id: true,
            name: true,
            semester: true,
            year: true,
            department: { select: { code: true, name: true } },
          },
        },
        tuitionPayments: {
          orderBy: [{ year: "desc" }, { semester: "asc" }],
          select: { id: true, semester: true, year: true, amount: true, paidAt: true },
        },
      },
      orderBy: { studentId: "asc" },
    });

    return NextResponse.json(students);
  } catch (e) {
    console.error("Student search error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
