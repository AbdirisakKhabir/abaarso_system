import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findClassRosterStudentIds } from "@/lib/class-roster";
import { semestersMatch } from "@/lib/semester-match";
import { dischargeTuition } from "@/lib/tuition-charge";
import { logActivity } from "@/lib/activity-log";

/**
 * GET /api/students/bulk-tuition-discharge?classId=&semester=&year=
 * or ?studentIds=1,2,3&semester=&year=
 * Students who have a charge for that term and/or a manual (balance-only) amount.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const classId = Number(searchParams.get("classId"));
    const semester = String(searchParams.get("semester") ?? "").trim();
    const year = Number(searchParams.get("year"));
    const rawIds = String(searchParams.get("studentIds") ?? "")
      .split(",")
      .map((x) => Number(x.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);

    if (!semester || !Number.isInteger(year)) {
      return NextResponse.json({ error: "semester and year are required" }, { status: 400 });
    }

    let rosterIds: number[] = [];
    if (Number.isInteger(classId) && classId > 0) {
      rosterIds = await findClassRosterStudentIds(classId);
    } else if (rawIds.length > 0) {
      rosterIds = [...new Set(rawIds)];
    } else {
      return NextResponse.json({ error: "classId or studentIds is required" }, { status: 400 });
    }
    if (rosterIds.length === 0) {
      return NextResponse.json({ students: [] });
    }

    const [students, charges] = await Promise.all([
      prisma.student.findMany({
        where: { id: { in: rosterIds } },
        select: {
          id: true,
          studentId: true,
          firstName: true,
          lastName: true,
          balance: true,
        },
        orderBy: [{ studentId: "asc" }],
      }),
      prisma.tuitionCharge.findMany({
        where: { studentId: { in: rosterIds }, year },
        select: { id: true, studentId: true, semester: true, amount: true },
      }),
    ]);

    const chargesByStudent = new Map<number, { ids: number[]; amount: number }>();
    for (const c of charges) {
      if (!semestersMatch(c.semester, semester)) continue;
      const cur = chargesByStudent.get(c.studentId) ?? { ids: [], amount: 0 };
      cur.ids.push(c.id);
      cur.amount += Number(c.amount) || 0;
      chargesByStudent.set(c.studentId, cur);
    }

    const rows = students
      .map((s) => {
        const ch = chargesByStudent.get(s.id);
        const chargeAmount = ch?.amount ?? 0;
        const balance = Number(s.balance) || 0;
        const manual = chargeAmount <= 1e-6 && balance > 1e-6;
        if (chargeAmount <= 1e-6 && !manual) return null;
        return {
          id: s.id,
          studentId: s.studentId,
          firstName: s.firstName,
          lastName: s.lastName,
          balance,
          chargeAmount,
          chargeIds: ch?.ids ?? [],
          source: chargeAmount > 1e-6 && manual ? "both" : chargeAmount > 1e-6 ? "charge" : "manual",
          suggestedReverse: chargeAmount > 1e-6 ? chargeAmount : balance,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r != null);

    return NextResponse.json({ students: rows });
  } catch (e) {
    console.error("bulk-tuition-discharge GET error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

/**
 * POST body:
 *   studentIds?: number[]
 *   chargeIds?: number[]
 *   semester?: string
 *   year?: number
 *   minimizeBalance: boolean
 *   removeCharges: boolean
 *   amounts?: Record<string, number>  // per-student reverse amount
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const minimizeBalance = Boolean(body.minimizeBalance);
    const removeCharges = Boolean(body.removeCharges);
    if (!minimizeBalance && !removeCharges) {
      return NextResponse.json(
        { error: "Select Minimize the balance and/or Remove the charged students." },
        { status: 400 }
      );
    }

    const studentIds = Array.isArray(body.studentIds)
      ? body.studentIds.map((x: unknown) => Number(x)).filter((n: number) => Number.isInteger(n) && n > 0)
      : [];
    const chargeIds = Array.isArray(body.chargeIds)
      ? body.chargeIds.map((x: unknown) => Number(x)).filter((n: number) => Number.isInteger(n) && n > 0)
      : [];
    const semester = String(body.semester ?? "").trim();
    const year = Number(body.year);
    const rawAmounts = body.amounts;
    const amounts: Record<number, number> = {};
    if (rawAmounts != null && typeof rawAmounts === "object" && !Array.isArray(rawAmounts)) {
      for (const [k, v] of Object.entries(rawAmounts)) {
        const id = Number(k);
        const amt = Number(v);
        if (Number.isInteger(id) && id > 0 && Number.isFinite(amt) && amt >= 0) {
          amounts[id] = amt;
        }
      }
    }

    if (studentIds.length === 0 && chargeIds.length === 0) {
      return NextResponse.json({ error: "Select at least one student or charge." }, { status: 400 });
    }

    const chargeRows =
      chargeIds.length > 0
        ? await prisma.tuitionCharge.findMany({
            where: { id: { in: chargeIds } },
            select: { id: true, studentId: true, amount: true },
          })
        : semester && Number.isInteger(year)
          ? (
              await prisma.tuitionCharge.findMany({
                where: { studentId: { in: studentIds }, year },
                select: { id: true, studentId: true, amount: true, semester: true },
              })
            ).filter((c) => semestersMatch(c.semester, semester))
          : [];

    const byStudent = new Map<
      number,
      { reverseAmount: number; chargeIds: number[] }
    >();

    for (const id of studentIds) {
      if (!byStudent.has(id)) byStudent.set(id, { reverseAmount: 0, chargeIds: [] });
    }
    for (const c of chargeRows) {
      const cur = byStudent.get(c.studentId) ?? { reverseAmount: 0, chargeIds: [] };
      cur.chargeIds.push(c.id);
      cur.reverseAmount += Number(c.amount) || 0;
      byStudent.set(c.studentId, cur);
    }
    for (const [id, amt] of Object.entries(amounts)) {
      const sid = Number(id);
      const cur = byStudent.get(sid) ?? { reverseAmount: 0, chargeIds: [] };
      cur.reverseAmount = amt;
      byStudent.set(sid, cur);
    }

    const items = [...byStudent.entries()].map(([studentId, v]) => ({
      studentId,
      reverseAmount: v.reverseAmount,
      chargeIds: v.chargeIds,
    }));

    if (items.length === 0) {
      return NextResponse.json({ error: "Nothing to discharge." }, { status: 400 });
    }

    const results = await prisma.$transaction((tx) =>
      dischargeTuition(tx, { items, minimizeBalance, removeCharges })
    );

    await logActivity({
      userId: auth.userId,
      action: "tuition.discharge",
      module: "finance",
      summary: `Discharged ${results.length} student(s)`,
      metadata: {
        minimizeBalance,
        removeCharges,
        reversed: results.reduce((s, r) => s + r.reversed, 0),
        chargesRemoved: results.reduce((s, r) => s + r.chargesRemoved, 0),
      },
      req,
    });

    return NextResponse.json({
      discharged: results.length,
      reversedTotal: results.reduce((s, r) => s + r.reversed, 0),
      chargesRemoved: results.reduce((s, r) => s + r.chargesRemoved, 0),
      results,
    });
  } catch (e) {
    console.error("bulk-tuition-discharge POST error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
