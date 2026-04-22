import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePaginationParams } from "@/lib/pagination";
import { userHasPermission } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await userHasPermission(auth.userId, "settings.view");
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const { paginate, page, pageSize, skip } = parsePaginationParams(searchParams);
    const q = searchParams.get("q")?.trim();
    const actionFilter = searchParams.get("action")?.trim();
    const dateFrom = searchParams.get("dateFrom")?.trim();
    const dateTo = searchParams.get("dateTo")?.trim();

    const where: Prisma.ActivityLogWhereInput = {};
    if (actionFilter) {
      where.action = { contains: actionFilter };
    }
    if (dateFrom || dateTo) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (dateFrom) createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        createdAt.lte = end;
      }
      where.createdAt = createdAt;
    }
    if (q) {
      where.OR = [
        { summary: { contains: q } },
        { action: { contains: q } },
        { module: { contains: q } },
        { user: { email: { contains: q } } },
        { user: { name: { contains: q } } },
      ];
    }

    const include = {
      user: {
        select: { id: true, email: true, name: true },
      },
    } as const;

    if (paginate) {
      const [items, total] = await Promise.all([
        prisma.activityLog.findMany({
          where,
          skip,
          take: pageSize,
          include,
          orderBy: { createdAt: "desc" },
        }),
        prisma.activityLog.count({ where }),
      ]);
      return NextResponse.json({
        items: items.map((row) => ({
          ...row,
          metadata: row.metadata
            ? (() => {
                try {
                  return JSON.parse(row.metadata) as Record<string, unknown>;
                } catch {
                  return null;
                }
              })()
            : null,
        })),
        total,
        page,
        pageSize,
      });
    }

    const limitRaw = Number(searchParams.get("limit") || 500);
    const take = Math.min(2000, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 500));

    const rows = await prisma.activityLog.findMany({
      where,
      take,
      include,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(
      rows.map((row) => ({
        ...row,
        metadata: row.metadata
          ? (() => {
              try {
                return JSON.parse(row.metadata) as Record<string, unknown>;
              } catch {
                return null;
              }
            })()
          : null,
      }))
    );
  } catch (e) {
    console.error("activity-logs GET:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
