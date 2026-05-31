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

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        bank: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    let filtered = expenses;
    if (year) {
      const y = Number(year);
      if (!Number.isNaN(y)) {
        filtered = expenses.filter((e) => new Date(e.createdAt).getFullYear() === y);
      }
    }

    return NextResponse.json(filtered);
  } catch (e) {
    console.error("Expenses list error:", e);
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
    const canCreate = permissions.includes("expenses.create") || user.role.name === "Admin";
    if (!canCreate) {
      return NextResponse.json(
        { error: "You do not have permission to request expenses" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { amount, description, category, bankId } = body;

    if (!amount || amount <= 0 || !description?.trim()) {
      return NextResponse.json(
        { error: "Amount (positive) and description are required" },
        { status: 400 }
      );
    }

    const data: {
      amount: number;
      description: string;
      category?: string;
      bankId?: number;
      requestedById: number;
    } = {
      amount: Number(amount),
      description: String(description).trim(),
      requestedById: auth.userId,
    };
    if (category?.trim()) data.category = String(category).trim();
    if (bankId) {
      const bank = await prisma.bank.findUnique({ where: { id: Number(bankId) } });
      if (bank?.isActive) data.bankId = bank.id;
    }

    const expense = await prisma.expense.create({
      data,
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
        bank: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json(expense);
  } catch (e) {
    console.error("Create expense error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
