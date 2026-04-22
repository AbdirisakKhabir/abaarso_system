import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

function extractClientMeta(req?: NextRequest): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  if (!req) return { ipAddress: null, userAgent: null };
  const forwarded = req.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const ua = req.headers.get("user-agent");
  return {
    ipAddress: ip ? ip.slice(0, 64) : null,
    userAgent: ua ? ua.slice(0, 512) : null,
  };
}

/**
 * Append a row to the system activity log. Swallows errors so callers are not blocked.
 */
export async function logActivity(opts: {
  userId?: number | null;
  action: string;
  module?: string;
  summary: string;
  metadata?: Record<string, unknown>;
  req?: NextRequest;
}): Promise<void> {
  try {
    const { ipAddress, userAgent } = extractClientMeta(opts.req);
    let metadataStr: string | null = null;
    if (opts.metadata && Object.keys(opts.metadata).length > 0) {
      try {
        metadataStr = JSON.stringify(opts.metadata).slice(0, 65000);
      } catch {
        metadataStr = null;
      }
    }
    await prisma.activityLog.create({
      data: {
        userId: opts.userId ?? null,
        action: opts.action.slice(0, 191),
        module: opts.module ? opts.module.slice(0, 191) : null,
        summary: opts.summary.slice(0, 20000),
        metadata: metadataStr,
        ipAddress,
        userAgent,
      },
    });
  } catch (e) {
    console.error("logActivity:", e);
  }
}
