import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userHasPermission } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canView = await userHasPermission(auth.userId, "expenses.view");
    const canCreate = await userHasPermission(auth.userId, "expenses.create");
    if (!canView && !canCreate) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get("active") !== "false";

    const rows = await prisma.expenseCategory.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { name: "asc" },
    });

    return NextResponse.json(rows);
  } catch (e) {
    console.error("List expense categories error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await userHasPermission(auth.userId, "expenses.approve");
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const description = body.description ? String(body.description).trim() : null;

    if (!name) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }

    const row = await prisma.expenseCategory.create({
      data: { name, description },
    });

    return NextResponse.json(row);
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return NextResponse.json({ error: "Category name already exists" }, { status: 400 });
    }
    console.error("Create expense category error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
