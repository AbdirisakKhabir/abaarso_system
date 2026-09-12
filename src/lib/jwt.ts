import jwt from "jsonwebtoken";

/**
 * Lazily resolved so a misconfigured deployment fails loudly at first use
 * instead of silently signing tokens with a well-known default secret.
 */
function getSecret(): string {
  const secret = process.env.JWT_SECRET_KEY;
  if (!secret || secret.trim().length < 16) {
    throw new Error(
      "JWT_SECRET_KEY is not set (or too short). Set a strong random value in .env — see .env.example."
    );
  }
  return secret;
}

export type JWTPayload = {
  userId: number;
  email: string;
  roleId: number;
  iat?: number;
  exp?: number;
};

export function signToken(payload: Omit<JWTPayload, "iat" | "exp">): string {
  return jwt.sign(payload, getSecret(), { expiresIn: "7d", algorithm: "HS256" });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, getSecret(), { algorithms: ["HS256"] }) as JWTPayload;
    return decoded;
  } catch {
    return null;
  }
}
