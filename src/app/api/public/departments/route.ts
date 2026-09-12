import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseProgram } from "@/lib/program";

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "public, max-age=120",
  };
}

/**
 * Public read-only department list for the "apply online" form.
 * Query: program — "Bachelor" (default) or "Masters". Active departments only.
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const program = parseProgram(searchParams.get("program"));

    const departments = await prisma.department.findMany({
      where: { isActive: true, program: program ?? "Bachelor" },
      select: { id: true, name: true, code: true, program: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ items: departments }, { headers: corsHeaders() });
  } catch (e) {
    console.error("Public departments error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500, headers: corsHeaders() }
    );
  }
}
