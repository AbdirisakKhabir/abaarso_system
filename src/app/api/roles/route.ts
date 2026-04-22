import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePaginationParams } from "@/lib/pagination";
import {
  ensureAdminRoleHasActivityLogAccess,
  mergeActivityLogPermissionForAdminRole,
} from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const { paginate, page, pageSize, skip } = parsePaginationParams(searchParams);

    const include = {
      _count: { select: { users: true } },
      permissions: { include: { permission: true } },
    } as const;

    const mapRole = (r: {
      id: number;
      name: string;
      description: string | null;
      _count: { users: number };
      permissions: { permission: { id: number; name: string; description: string | null; module: string | null } }[];
    }) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      userCount: r._count.users,
      permissions: r.permissions.map((rp) => rp.permission),
    });

    if (paginate) {
      const [rows, total] = await Promise.all([
        prisma.role.findMany({
          skip,
          take: pageSize,
          include,
          orderBy: { name: "asc" },
        }),
        prisma.role.count(),
      ]);
      return NextResponse.json({
        items: rows.map(mapRole),
        total,
        page,
        pageSize,
      });
    }

    const roles = await prisma.role.findMany({
      include,
      orderBy: { name: "asc" },
    });

    return NextResponse.json(roles.map(mapRole));
  } catch (e) {
    console.error("Roles list error:", e);
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
    const { name, description, permissionIds } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Role name is required" },
        { status: 400 }
      );
    }

    const trimmedName = String(name).trim();
    const role = await prisma.role.create({
      data: {
        name: trimmedName,
        description: description || null,
      },
    });

    let parsedPermissionIds: number[] = [];
    if (Array.isArray(permissionIds) && permissionIds.length > 0) {
      parsedPermissionIds = permissionIds.map((pid: unknown) => Number(pid));
      if (parsedPermissionIds.some((pid) => !Number.isInteger(pid))) {
        return NextResponse.json(
          { error: "Invalid permissionIds" },
          { status: 400 }
        );
      }
    }
    parsedPermissionIds = await mergeActivityLogPermissionForAdminRole(
      trimmedName,
      parsedPermissionIds
    );
    if (parsedPermissionIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: parsedPermissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
      });
    }

    await ensureAdminRoleHasActivityLogAccess(role.id);

    const roleWithPerms = await prisma.role.findUnique({
      where: { id: role.id },
      include: {
        permissions: { include: { permission: true } },
      },
    });

    return NextResponse.json({
      ...roleWithPerms,
      permissions: roleWithPerms?.permissions.map((rp) => rp.permission) ?? [],
    });
  } catch (e) {
    console.error("Create role error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
