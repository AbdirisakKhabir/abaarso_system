import { NextRequest, NextResponse } from "next/server";
import { verifyToken, type JWTPayload } from "./jwt";
import { userHasPermission } from "./permissions";

export function getTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
}

export async function getAuthUser(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Verify the request is authenticated AND the user's role has `permission`.
 * Use for any route that mutates data or reads something sensitive — do not
 * rely on the client hiding a button as the only access control.
 *
 * Usage:
 *   const check = await requirePermission(req, "users.create");
 *   if ("error" in check) return check.error;
 *   const { auth } = check;
 */
export async function requirePermission(
  req: NextRequest,
  permission: string
): Promise<{ auth: JWTPayload } | { error: NextResponse }> {
  const auth = await getAuthUser(req);
  if (!auth) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const allowed = await userHasPermission(auth.userId, permission);
  if (!allowed) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { auth };
}
