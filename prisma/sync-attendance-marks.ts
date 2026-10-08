import "dotenv/config";
import { syncMissingAttendanceMarks } from "../src/lib/attendance-marks-sync";
import { prisma } from "../src/lib/prisma";

/**
 * Fill exam results saved with a 0/empty attendance mark.
 *   npm run db:sync-attendance-marks            → preview only (no changes)
 *   npm run db:sync-attendance-marks -- --apply → write the changes
 */
async function main() {
  const apply = process.argv.includes("--apply");
  const { scannedClassCourses, changes } = await syncMissingAttendanceMarks({ dryRun: !apply });

  console.log(`Scanned ${scannedClassCourses} class/course combination(s).`);
  if (changes.length === 0) {
    console.log("No exam results need an attendance mark.");
    return;
  }
  console.table(
    changes.map((c) => ({
      student: c.student,
      course: c.course,
      class: `${c.className} (${c.term})`,
      attend: c.attendanceMarks,
      total: `${c.oldTotal} → ${c.newTotal}`,
      grade: c.gradeKept ? `${c.oldGrade} (manual, kept)` : `${c.oldGrade ?? "—"} → ${c.newGrade}`,
    }))
  );
  console.log(
    apply
      ? `Updated ${changes.length} exam result(s).`
      : `${changes.length} exam result(s) would be updated. Re-run with --apply to save.`
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error("Attendance marks sync failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
