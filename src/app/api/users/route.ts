import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        roleId: true,
        isActive: true,
        createdAt: true,
        role: { select: { name: true } },
      },
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

    return NextResponse.json(user);
  } catch (e) {
    console.error("Create user error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
