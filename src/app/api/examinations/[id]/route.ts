import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateTotal, getGradeInfo } from "@/lib/grades";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const record = await prisma.examRecord.findUnique({
      where: { id: Number(id) },
      include: {
        student: {
          select: {
            id: true,
            studentId: true,
            firstName: true,
            lastName: true,
            email: true,
            imageUrl: true,
            department: { select: { id: true, name: true, code: true } },
          },
        },
        course: {
          select: {
            id: true,
            name: true,
            code: true,
            creditHours: true,
            department: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    if (!record) {
      return NextResponse.json({ error: "Exam record not found" }, { status: 404 });
    }

    return NextResponse.json(record);
  } catch (e) {
    console.error("Get exam record error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { midExam, finalExam, assessment, project, assignment, presentation } = body;

    const existing = await prisma.examRecord.findUnique({ where: { id: Number(id) } });
    if (!existing) {
      return NextResponse.json({ error: "Exam record not found" }, { status: 404 });
    }

    const marks = {
      midExam: midExam !== undefined ? Number(midExam) : (existing.midExam || 0),
      finalExam: finalExam !== undefined ? Number(finalExam) : (existing.finalExam || 0),
      assessment: assessment !== undefined ? Number(assessment) : (existing.assessment || 0),
      project: project !== undefined ? Number(project) : (existing.project || 0),
      assignment: assignment !== undefined ? Number(assignment) : (existing.assignment || 0),
      presentation: presentation !== undefined ? Number(presentation) : (existing.presentation || 0),
    };

    // Validate
    if (marks.midExam < 0 || marks.midExam > 20) return NextResponse.json({ error: "Mid Exam must be 0-20" }, { status: 400 });
    if (marks.finalExam < 0 || marks.finalExam > 40) return NextResponse.json({ error: "Final Exam must be 0-40" }, { status: 400 });
    if (marks.assessment < 0 || marks.assessment > 10) return NextResponse.json({ error: "Assessment must be 0-10" }, { status: 400 });
    if (marks.project < 0 || marks.project > 10) return NextResponse.json({ error: "Project must be 0-10" }, { status: 400 });
    if (marks.assignment < 0 || marks.assignment > 10) return NextResponse.json({ error: "Assignment must be 0-10" }, { status: 400 });
    if (marks.presentation < 0 || marks.presentation > 10) return NextResponse.json({ error: "Presentation must be 0-10" }, { status: 400 });

    const totalMarks = calculateTotal(marks);
    const { grade, gradePoints } = getGradeInfo(totalMarks);

    const updated = await prisma.examRecord.update({
      where: { id: Number(id) },
      data: { ...marks, totalMarks, grade, gradePoints },
      include: {
        student: {
          select: { id: true, studentId: true, firstName: true, lastName: true, imageUrl: true },
        },
        course: {
          select: { id: true, name: true, code: true, creditHours: true },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("Update exam record error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.examRecord.findUnique({ where: { id: Number(id) } });
    if (!existing) {
      return NextResponse.json({ error: "Exam record not found" }, { status: 404 });
    }

    await prisma.examRecord.delete({ where: { id: Number(id) } });
    return NextResponse.json({ message: "Exam record deleted" });
  } catch (e) {
    console.error("Delete exam record error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
