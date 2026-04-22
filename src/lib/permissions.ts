import { prisma } from "@/lib/prisma";

/** Activity log and Settings menu use this permission. */
const ADMIN_ACTIVITY_LOG_PERMISSION = "settings.view";

/** Case-insensitive match for the built-in full-access role from seed. */
export function isAdminRoleName(name: string | null | undefined): boolean {
  if (name == null || typeof name !== "string") return false;
  return name.trim().toLowerCase() === "admin";
}

/** Ensures the Admin role always keeps audit / activity log access. */
export async function mergeActivityLogPermissionForAdminRole(
  roleName: string,
  permissionIds: number[]
): Promise<number[]> {
  if (!isAdminRoleName(roleName)) return permissionIds;
  const row = await prisma.permission.findUnique({
    where: { name: ADMIN_ACTIVITY_LOG_PERMISSION },
    select: { id: true },
  });
  if (!row) return permissionIds;
  const set = new Set(
    permissionIds.filter((id) => Number.isInteger(id) && id > 0)
  );
  set.add(row.id);
  return [...set];
}

/** If the role is Admin, attach activity log permission (e.g. after rename). */
export async function ensureAdminRoleHasActivityLogAccess(
  roleId: number
): Promise<void> {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { name: true },
  });
  if (!role || !isAdminRoleName(role.name)) return;
  const row = await prisma.permission.findUnique({
    where: { name: ADMIN_ACTIVITY_LOG_PERMISSION },
    select: { id: true },
  });
  if (!row) return;
  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: { roleId, permissionId: row.id },
    },
    create: { roleId, permissionId: row.id },
    update: {},
  });
}

/** Resolve whether a user has a named permission (from their role). */
export async function userHasPermission(
  userId: number,
  permissionName: string
): Promise<boolean> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: {
        select: {
          name: true,
          permissions: {
            select: { permission: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!row?.role) return false;
  if (isAdminRoleName(row.role.name)) return true;
  if (!row.role.permissions) return false;
  return row.role.permissions.some(
    (rp) => rp.permission.name === permissionName
  );
}
