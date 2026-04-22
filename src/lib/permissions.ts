import { prisma } from "@/lib/prisma";

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
          permissions: {
            select: { permission: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!row?.role?.permissions) return false;
  return row.role.permissions.some(
    (rp) => rp.permission.name === permissionName
  );
}
