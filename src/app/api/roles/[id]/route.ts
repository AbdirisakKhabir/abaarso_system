import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ensureAdminRoleHasActivityLogAccess,
  mergeActivityLogPermissionForAdminRole,
} from "@/lib/permissions";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const parsedId = Number(id);
    if (!Number.isInteger(parsedId)) {
      return NextResponse.json({ error: "Invalid role id" }, { status: 400 });
    }
    const role = await prisma.role.findUnique({
      where: { id: parsedId },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }
    return NextResponse.json({
      ...role,
      permissions: role.permissions.map((rp) => rp.permission),
      userCount: role._count.users,
    });
  } catch (e) {
    console.error("Get role error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const parsedId = Number(id);
    if (!Number.isInteger(parsedId)) {
      return NextResponse.json({ error: "Invalid role id" }, { status: 400 });
    }
    const body = await req.json();
    const { name, description, permissionIds } = body;

    const existing = await prisma.role.findUnique({ where: { id: parsedId } });
    if (!existing) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    const data: { name?: string; description?: string | null } = {};
    if (typeof name === "string") data.name = name.trim();
    if (typeof description !== "undefined") data.description = description || null;

    if (Array.isArray(permissionIds)) {
      let parsedPermissionIds = permissionIds.map((pid: unknown) => Number(pid));
      if (parsedPermissionIds.some((pid) => !Number.isInteger(pid))) {
        return NextResponse.json(
          { error: "Invalid permissionIds" },
          { status: 400 }
        );
      }
      const nameForMerge =
        typeof data.name === "string" ? data.name : existing.name;
      parsedPermissionIds = await mergeActivityLogPermissionForAdminRole(
        nameForMerge,
        parsedPermissionIds
      );
      await prisma.rolePermission.deleteMany({ where: { roleId: parsedId } });
      if (parsedPermissionIds.length > 0) {
        await prisma.rolePermission.createMany({
          data: parsedPermissionIds.map((permissionId) => ({
            roleId: parsedId,
            permissionId,
          })),
        });
      }
    }

    const role = await prisma.role.update({
      where: { id: parsedId },
      data,
      include: {
        permissions: { include: { permission: true } },
      },
    });

    await ensureAdminRoleHasActivityLogAccess(role.id);

    return NextResponse.json({
      ...role,
      permissions: role.permissions.map((rp) => rp.permission),
    });
  } catch (e) {
    console.error("Update role error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const parsedId = Number(id);
    if (!Number.isInteger(parsedId)) {
      return NextResponse.json({ error: "Invalid role id" }, { status: 400 });
    }
    await prisma.role.delete({ where: { id: parsedId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Delete role error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
