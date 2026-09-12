import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/jwt";
import { logActivity } from "@/lib/activity-log";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const rl = rateLimit(
      `login:${getClientIp(req)}:${String(email).toLowerCase().trim()}`,
      LOGIN_MAX_ATTEMPTS,
      LOGIN_WINDOW_MS
    );
    if (rl.limited) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase().trim() },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      roleId: user.roleId,
    });

    const permissions = user.role.permissions.map((rp) => rp.permission.name);

    await logActivity({
      userId: user.id,
      action: "auth.login",
      module: "auth",
      summary: `Signed in as ${user.email} (${user.role.name})`,
      metadata: { role: user.role.name },
      req,
    });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roleId: user.roleId,
        roleName: user.role.name,
        permissions,
      },
    });
  } catch (e) {
    console.error("Login error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
