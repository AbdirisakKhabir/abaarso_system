import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const employees = await prisma.employee.findMany({
      include: {
        position: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(employees);
  } catch (e) {
    console.error("Employees list error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, email, phone, positionId, department, hireDate } = body;
    const parsedPositionId = Number(positionId);

    if (!name || !email || !Number.isInteger(parsedPositionId)) {
      return NextResponse.json({ error: "Name, email, and position are required" }, { status: 400 });
    }

    const employee = await prisma.employee.create({
      data: {
        name: String(name).trim(),
        email: String(email).trim().toLowerCase(),
        phone: phone ? String(phone).trim() : null,
        positionId: parsedPositionId,
        department: department ? String(department).trim() : null,
        hireDate: hireDate ? new Date(hireDate) : new Date(),
      },
      include: {
        position: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(employee);
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "An employee with this email already exists" }, { status: 400 });
    }
    console.error("Create employee error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
