export const STUDENT_STATUSES = [
  "Pending",
  "Admitted",
  "Leave",
  "Rejected",
  "Graduated",
] as const;

export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export function parseStudentStatus(
  value: unknown,
  fallback: StudentStatus = "Admitted"
): StudentStatus {
  const s = String(value ?? "").trim();
  return (STUDENT_STATUSES as readonly string[]).includes(s)
    ? (s as StudentStatus)
    : fallback;
}

export function isStudentStatus(value: unknown): value is StudentStatus {
  return (STUDENT_STATUSES as readonly string[]).includes(String(value ?? "").trim());
}
