import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidSemester } from "@/lib/semesters";

const DAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const SHIFTS = ["Morning", "Afternoon", "Evening"];

function isValidDay(d: string) {
  return DAYS.includes(d);
}
function isValidShift(s: string) {
  return SHIFTS.includes(s);
}

/** GET schedules by semester and year */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const semester = searchParams.get("semester");
    const year = searchParams.get("year");
    const classId = searchParams.get("classId");
    const yearNum = year ? Number(year) : NaN;

    if (!semester || !Number.isInteger(yearNum)) {
      return NextResponse.json(
        { error: "semester and year query params are required" },
        { status: 400 }
      );
    }

    const where: { semester: string; year: number; classId?: number } = { semester, year: yearNum };
    if (classId) where.classId = Number(classId);

    const schedules = await prisma.classSchedule.findMany({
      where,
      include: {
        class: { select: { id: true, name: true, department: { select: { id: true, name: true, code: true } } } },
        course: { select: { id: true, name: true, code: true } },
        lecturer: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { shift: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json(schedules);
  } catch (e) {
    console.error("Schedules list error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

/** POST create schedule slots (bulk) */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { slots } = body;

    if (!Array.isArray(slots) || slots.length === 0) {
      return NextResponse.json(
        { error: "slots array is required and must not be empty" },
        { status: 400 }
      );
    }

    const semester = String(slots[0]?.semester ?? "").trim();
    const year = Number(slots[0]?.year);
    if (!semester || !Number.isInteger(year)) {
      return NextResponse.json(
        { error: "Each slot must have semester and year" },
        { status: 400 }
      );
    }

    if (!(await isValidSemester(semester))) {
      return NextResponse.json(
        { error: "Invalid semester. Use a semester from the Semesters settings." },
        { status: 400 }
      );
    }

    const errors: string[] = [];
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      const classId = Number(s.classId);
      const courseId = Number(s.courseId);
      const lecturerId = Number(s.lecturerId);
      const dayOfWeek = String(s.dayOfWeek ?? "").trim();
      const shift = String(s.shift ?? "").trim();
      const startTime = String(s.startTime ?? "").trim();
      const endTime = String(s.endTime ?? "").trim();

      if (!Number.isInteger(classId) || !Number.isInteger(courseId) || !Number.isInteger(lecturerId)) {
        errors.push(`Slot ${i + 1}: classId, courseId, and lecturerId are required`);
        continue;
      }
      if (!isValidDay(dayOfWeek)) {
        errors.push(`Slot ${i + 1}: Invalid day. Use: ${DAYS.join(", ")}`);
      }
      if (!isValidShift(shift)) {
        errors.push(`Slot ${i + 1}: Invalid shift. Use: ${SHIFTS.join(", ")}`);
      }
      if (!startTime || !endTime) {
        errors.push(`Slot ${i + 1}: startTime and endTime are required`);
      }

      const cls = await prisma.class.findUnique({
        where: { id: classId },
        include: { department: true },
      });
      if (!cls) {
        errors.push(`Slot ${i + 1}: Class not found`);
        continue;
      }
      const course = await prisma.course.findUnique({ where: { id: courseId } });
      if (!course || course.departmentId !== cls.departmentId) {
        errors.push(`Slot ${i + 1}: Course not found or does not belong to the class's department`);
        continue;
      }
      const lecturerCourse = await prisma.lecturerCourse.findUnique({
        where: { lecturerId_courseId: { lecturerId, courseId } },
      });
      if (!lecturerCourse) {
        errors.push(
          `Slot ${i + 1}: Lecturer is not assigned to course ${course.code}. Assign the lecturer to this course first.`
        );
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    const created = await prisma.$transaction(
      slots.map((s: { classId: number; courseId: number; lecturerId: number; dayOfWeek: string; shift: string; startTime: string; endTime: string; semester: string; year: number; room?: string }) =>
        prisma.classSchedule.create({
          data: {
            classId: Number(s.classId),
            courseId: Number(s.courseId),
            lecturerId: Number(s.lecturerId),
            dayOfWeek: String(s.dayOfWeek).trim(),
            shift: String(s.shift).trim(),
            startTime: String(s.startTime).trim(),
            endTime: String(s.endTime).trim(),
            semester: String(s.semester).trim(),
            year: Number(s.year),
            room: s.room ? String(s.room).trim() : null,
          },
        })
      )
    );

    return NextResponse.json({ created: created.length, schedules: created });
  } catch (e) {
    console.error("Create schedules error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
