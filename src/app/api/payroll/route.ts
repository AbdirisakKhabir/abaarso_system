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
    const status = searchParams.get("status");
    const year = searchParams.get("year");

    const where: { status?: string } = {};
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      where.status = status;
    }

    const payrolls = await prisma.payroll.findMany({
      where,
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        bank: { select: { id: true, name: true, code: true } },
        employee: { select: { id: true, name: true, email: true, position: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    let filtered = payrolls;
    if (year) {
      const y = Number(year);
      if (!Number.isNaN(y)) {
        filtered = payrolls.filter((p) => new Date(p.createdAt).getFullYear() === y);
      }
    }

    return NextResponse.json(filtered);
  } catch (e) {
    console.error("Payroll list error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const permissions = user.role.permissions.map((rp) => rp.permission.name);
    const canCreate = permissions.includes("payroll.create") || user.role.name === "Admin";
    if (!canCreate) {
      return NextResponse.json(
        { error: "You do not have permission to request payroll" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { amount, description, period, employeeId, bankId } = body;

    if (!amount || amount <= 0 || !description?.trim()) {
      return NextResponse.json(
        { error: "Amount (positive) and description are required" },
        { status: 400 }
      );
    }

    const data: {
      amount: number;
      description: string;
      period?: string;
      employeeId?: number;
      bankId?: number;
      requestedById: number;
    } = {
      amount: Number(amount),
      description: String(description).trim(),
      requestedById: auth.userId,
    };
    if (period?.trim()) data.period = String(period).trim();
    if (employeeId) {
      const emp = await prisma.employee.findUnique({ where: { id: Number(employeeId) } });
      if (emp?.isActive) data.employeeId = emp.id;
    }
    if (bankId) {
      const bank = await prisma.bank.findUnique({ where: { id: Number(bankId) } });
      if (bank?.isActive) data.bankId = bank.id;
    }

    const payroll = await prisma.payroll.create({
      data,
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
        bank: { select: { id: true, name: true, code: true } },
        employee: { select: { id: true, name: true, email: true, position: { select: { name: true } } } },
      },
    });

    return NextResponse.json(payroll);
  } catch (e) {
    console.error("Create payroll error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
