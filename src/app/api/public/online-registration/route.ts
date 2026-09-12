import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseProgram } from "@/lib/program";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const MAX_SUBMISSIONS = 6;
const WINDOW_MS = 60 * 60 * 1000;
const MAX_FIELD_LEN = 200;
const MAX_ADDRESS_LEN = 500;

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

/**
 * Public "apply online" submission from the university website.
 * Body: firstName, lastName, email?, phone?, dateOfBirth?, gender?, address?,
 *       departmentId (required), program ("Bachelor" | "Masters"),
 *       website? (honeypot — real users never fill this; bots often do).
 * Creates a Pending OnlineRegistration for an admin to review and approve/reject.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400, headers: corsHeaders() });
    }

    // Honeypot: real applicants never see/fill this field. Pretend success
    // without touching the database so bots don't learn they were caught.
    if (String(body.website ?? "").trim() !== "") {
      return NextResponse.json(
        { message: "Application submitted. Our admissions office will contact you soon.", id: 0 },
        { status: 201, headers: corsHeaders() }
      );
    }

    const rl = rateLimit(`online-reg:${getClientIp(req)}`, MAX_SUBMISSIONS, WINDOW_MS);
    if (rl.limited) {
      return NextResponse.json(
        { error: "Too many applications submitted. Please try again later." },
        { status: 429, headers: { ...corsHeaders(), "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }

    const firstName = String(body.firstName ?? "").trim().slice(0, MAX_FIELD_LEN);
    const lastName = String(body.lastName ?? "").trim().slice(0, MAX_FIELD_LEN);
    if (!firstName || !lastName) {
      return NextResponse.json(
        { error: "First name and last name are required" },
        { status: 400, headers: corsHeaders() }
      );
    }

    const program = parseProgram(body.program);
    const departmentId = Number(body.departmentId);
    if (!Number.isInteger(departmentId) || departmentId <= 0) {
      return NextResponse.json(
        { error: "Please select a department" },
        { status: 400, headers: corsHeaders() }
      );
    }

    const department = await prisma.department.findFirst({
      where: { id: departmentId, isActive: true, program: program ?? "Bachelor" },
      select: { id: true },
    });
    if (!department) {
      return NextResponse.json(
        { error: "Selected department was not found for this program" },
        { status: 400, headers: corsHeaders() }
      );
    }

    const emailRaw = body.email ? String(body.email).trim().toLowerCase() : "";
    if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400, headers: corsHeaders() }
      );
    }
    const email = emailRaw || null;

    if (email) {
      const [existingStudent, existingPending] = await Promise.all([
        prisma.student.findUnique({ where: { email }, select: { id: true } }),
        prisma.onlineRegistration.findFirst({
          where: { email, status: "Pending" },
          select: { id: true },
        }),
      ]);
      if (existingStudent) {
        return NextResponse.json(
          { error: "A student with this email is already registered. Contact the admissions office." },
          { status: 400, headers: corsHeaders() }
        );
      }
      if (existingPending) {
        return NextResponse.json(
          { error: "An application with this email is already pending review." },
          { status: 400, headers: corsHeaders() }
        );
      }
    }

    const dobRaw = body.dateOfBirth ? new Date(String(body.dateOfBirth)) : null;
    const dateOfBirth = dobRaw && !Number.isNaN(dobRaw.getTime()) ? dobRaw : null;

    const registration = await prisma.onlineRegistration.create({
      data: {
        firstName,
        lastName,
        email,
        phone: body.phone ? String(body.phone).trim().slice(0, MAX_FIELD_LEN) : null,
        dateOfBirth,
        gender: body.gender ? String(body.gender).trim().slice(0, MAX_FIELD_LEN) : null,
        address: body.address ? String(body.address).trim().slice(0, MAX_ADDRESS_LEN) : null,
        departmentId,
        program: program ?? "Bachelor",
        status: "Pending",
      },
      select: { id: true, createdAt: true },
    });

    return NextResponse.json(
      {
        message: "Application submitted. Our admissions office will contact you soon.",
        id: registration.id,
      },
      { status: 201, headers: corsHeaders() }
    );
  } catch (e) {
    console.error("Public online registration error:", e);
    return NextResponse.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500, headers: corsHeaders() }
    );
  }
}
