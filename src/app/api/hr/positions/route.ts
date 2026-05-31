import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const positions = await prisma.position.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(positions);
  } catch (e) {
    console.error("Positions list error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, description } = body;
    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const position = await prisma.position.create({
      data: {
        name: String(name).trim(),
        description: description ? String(description).trim() : null,
      },
    });
    return NextResponse.json(position);
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "A position with this name already exists" }, { status: 400 });
    }
    console.error("Create position error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
