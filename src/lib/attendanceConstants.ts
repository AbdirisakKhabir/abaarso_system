/** Status values accepted when creating or updating attendance records (UI + API). */
export const ATTENDANCE_RECORD_STATUSES = [
  "Present",
  "Absent",
  "Excused",
] as const;

export type AttendanceRecordStatus =
  (typeof ATTENDANCE_RECORD_STATUSES)[number];

export function isAllowedAttendanceStatus(status: string): boolean {
  return (ATTENDANCE_RECORD_STATUSES as readonly string[]).includes(status);
}
