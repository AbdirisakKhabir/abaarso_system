import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { getAuthUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
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

    const where: Prisma.UserWhereInput = {};
    if (q) {
      where.OR = [
        { email: { contains: q } },
        { name: { contains: q } },
        { role: { name: { contains: q } } },
      ];
    }

    const select = {
      id: true,
      email: true,
      name: true,
      roleId: true,
      isActive: true,
      createdAt: true,
      role: { select: { name: true } },
    } as const;

    if (paginate) {
      const [items, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: pageSize,
          select,
          orderBy: { createdAt: "desc" },
        }),
        prisma.user.count({ where }),
      ]);
      return NextResponse.json({ items, total, page, pageSize });
    }

    const users = await prisma.user.findMany({
      where,
      select,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(users);
  } catch (e) {
    console.error("Users list error:", e);
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
    const { email, password, name, roleId } = body;
    const parsedRoleId = Number(roleId);

    if (!email || !password || !Number.isInteger(parsedRoleId)) {
      return NextResponse.json(
        { error: "Email, password and roleId are required" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase().trim() },
    });
    if (existing) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: String(email).toLowerCase().trim(),
        password: hashed,
        name: name || null,
        roleId: parsedRoleId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        roleId: true,
        isActive: true,
        createdAt: true,
        role: { select: { name: true } },
      },
    });

    await logActivity({
      userId: auth.userId,
      action: "user.create",
      module: "users",
      summary: `Created user account for ${user.email}`,
      metadata: { newUserId: user.id, role: user.role.name },
      req,
    });

    return NextResponse.json(user);
  } catch (e) {
    console.error("Create user error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
