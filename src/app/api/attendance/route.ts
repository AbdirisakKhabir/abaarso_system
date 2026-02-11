import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    const where: Record<string, unknown> = {};
    if (classId) where.classId = Number(classId);
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (dateFrom) dateFilter.gte = new Date(dateFrom);
      if (dateTo) dateFilter.lte = new Date(dateTo);
      where.date = dateFilter;
    }

    const sessions = await prisma.attendanceSession.findMany({
      where,
      include: {
        class: {
          select: {
            id: true,
            name: true,
            course: { select: { id: true, name: true, code: true } },
          },
        },
        takenBy: { select: { id: true, name: true, email: true } },
        _count: { select: { records: true } },
        records: {
          select: { status: true },
        },
      },
      orderBy: [{ date: "desc" }, { shift: "asc" }],
    });

    return NextResponse.json(
      sessions.map((s) => {
        const present = s.records.filter((r) => r.status === "Present").length;
        const absent = s.records.filter((r) => r.status === "Absent").length;
        const late = s.records.filter((r) => r.status === "Late").length;
        const excused = s.records.filter((r) => r.status === "Excused").length;
        return {
          id: s.id,
          classId: s.classId,
          class: s.class,
          date: s.date,
          shift: s.shift,
          takenBy: s.takenBy,
          takenAt: s.takenAt,
          note: s.note,
          totalRecords: s._count.records,
          present,
          absent,
          late,
          excused,
          createdAt: s.createdAt,
        };
      })
    );
  } catch (e) {
    console.error("Attendance list error:", e);
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
    const { classId, date, shift, note, records } = body;

    const parsedClassId = Number(classId);
    if (!Number.isInteger(parsedClassId) || !date || !shift) {
      return NextResponse.json(
        { error: "classId, date, and shift are required" },
        { status: 400 }
      );
    }

    const validShifts = ["Morning", "Afternoon", "Evening"];
    if (!validShifts.includes(shift)) {
      return NextResponse.json(
        { error: "Shift must be Morning, Afternoon, or Evening" },
        { status: 400 }
      );
    }

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { error: "At least one attendance record is required" },
        { status: 400 }
      );
    }

    // Check for existing session
    const existing = await prisma.attendanceSession.findUnique({
      where: {
        classId_date_shift: {
          classId: parsedClassId,
          date: new Date(date),
          shift,
        },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Attendance for this class on ${date} (${shift} shift) has already been taken` },
        { status: 400 }
      );
    }

    const session = await prisma.attendanceSession.create({
      data: {
        classId: parsedClassId,
        date: new Date(date),
        shift,
        takenById: auth.userId,
        note: note || null,
        records: {
          create: records.map(
            (r: { studentId: number; status: string; note?: string }) => ({
              studentId: Number(r.studentId),
              status: r.status,
              note: r.note || null,
            })
          ),
        },
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            course: { select: { id: true, name: true, code: true } },
          },
        },
        takenBy: { select: { id: true, name: true, email: true } },
        records: {
          include: {
            student: {
              select: {
                id: true,
                studentId: true,
                firstName: true,
                lastName: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(session);
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Attendance for this class/date/shift already exists" },
        { status: 400 }
      );
    }
    console.error("Create attendance error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
