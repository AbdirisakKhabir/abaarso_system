/**
 * Attendance calculation utilities.
 * Attendance (Present + Excused) counts as 10% of the exam grade.
 * Formula: attendanceMarks = (present + excused) / totalSessions * 10
 */

export interface StudentAttendanceSummary {
  studentId: number;
  studentIdStr: string;
  firstName: string;
  lastName: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  totalSessions: number;
  /** Percentage of days Present or Excused (0-100) */
  attendancePercent: number;
  /** Marks out of 10 for exam integration */
  attendanceMarks: number;
}

/**
 * Compute attendance marks (0-10) from present+excused count and total sessions.
 * Used as the 10% attendance component in exam grades.
 */
export function computeAttendanceMarks(
  presentPlusExcused: number,
  totalSessions: number
): number {
  if (totalSessions <= 0) return 0;
  const pct = presentPlusExcused / totalSessions;
  return Math.round(Math.min(10, pct * 10) * 100) / 100;
}

/**
 * Compute attendance percentage (0-100) from present+excused and total sessions.
 */
export function computeAttendancePercent(
  presentPlusExcused: number,
  totalSessions: number
): number {
  if (totalSessions <= 0) return 0;
  return Math.round((presentPlusExcused / totalSessions) * 10000) / 100;
}
