import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteImage } from "@/lib/cloudinary";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: rawId } = await ctx.params;
    const id = Number(rawId);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true, code: true } },
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    return NextResponse.json(student);
  } catch (e) {
    console.error("Get student error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: rawId } = await ctx.params;
    const id = Number(rawId);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (body.firstName !== undefined) data.firstName = String(body.firstName).trim();
    if (body.lastName !== undefined) data.lastName = String(body.lastName).trim();
    if (body.email !== undefined) data.email = String(body.email).toLowerCase().trim();
    if (body.phone !== undefined) data.phone = body.phone || null;
    if (body.dateOfBirth !== undefined)
      data.dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null;
    if (body.gender !== undefined) data.gender = body.gender || null;
    if (body.address !== undefined) data.address = body.address || null;
    if (body.departmentId !== undefined) {
      const did = Number(body.departmentId);
      if (!Number.isInteger(did)) {
        return NextResponse.json({ error: "Invalid departmentId" }, { status: 400 });
      }
      data.departmentId = did;
    }
    if (body.status !== undefined) data.status = body.status;

    // Handle image update: if new image provided, delete old one from Cloudinary
    if (body.imageUrl !== undefined) {
      const currentStudent = await prisma.student.findUnique({
        where: { id },
        select: { imagePublicId: true },
      });
      if (currentStudent?.imagePublicId && body.imagePublicId !== currentStudent.imagePublicId) {
        try {
          await deleteImage(currentStudent.imagePublicId);
        } catch {
          // Ignore Cloudinary deletion errors
        }
      }
      data.imageUrl = body.imageUrl || null;
      data.imagePublicId = body.imagePublicId || null;
    }

    const student = await prisma.student.update({
      where: { id },
      data,
      include: {
        department: { select: { id: true, name: true, code: true } },
      },
    });

    return NextResponse.json(student);
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A student with this email already exists" },
        { status: 400 }
      );
    }
    console.error("Update student error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: rawId } = await ctx.params;
    const id = Number(rawId);
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    // Delete image from Cloudinary first
    const student = await prisma.student.findUnique({
      where: { id },
      select: { imagePublicId: true },
    });
    if (student?.imagePublicId) {
      try {
        await deleteImage(student.imagePublicId);
      } catch {
        // Ignore Cloudinary deletion errors
      }
    }

    await prisma.student.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Delete student error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
