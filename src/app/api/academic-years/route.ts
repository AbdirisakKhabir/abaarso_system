import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET all academic years */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const active = req.nextUrl.searchParams.get("active");
    const where = active === "true" ? { isActive: true } : {};

    const years = await prisma.academicYear.findMany({
      where,
      orderBy: [{ endYear: "desc" }],
    });

    return NextResponse.json(years);
  } catch (e) {
    console.error("Academic years list error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
