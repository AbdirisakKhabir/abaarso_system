/** Per-semester tuition before multiplying by semester count (matches student registration rules). */
export function perSemesterTuition(
  departmentTuitionFee: number,
  paymentStatus: string,
  customSemesterFee?: number | null
): number {
  if (customSemesterFee != null && Number.isFinite(customSemesterFee)) {
    return Math.max(0, Number(customSemesterFee));
  }
  const ps = ["Full Scholarship", "Half Scholar", "Fully Paid"].includes(paymentStatus)
    ? paymentStatus
    : "Fully Paid";
  const base = departmentTuitionFee ?? 0;
  if (ps === "Full Scholarship") return 0;
  if (ps === "Half Scholar") return base * 0.5;
  return base;
}

export const PAYMENT_STATUSES = ["Full Scholarship", "Half Scholar", "Fully Paid"] as const;
export const SCHOLARSHIP_STATUSES = ["Full Scholarship", "Half Scholar"] as const;
export type ScholarshipStatus = (typeof SCHOLARSHIP_STATUSES)[number];

export function isScholarshipStudent(paymentStatus: string): boolean {
  return (SCHOLARSHIP_STATUSES as readonly string[]).includes(paymentStatus);
}

export function normalizePaymentStatus(paymentStatus: string | null | undefined): string {
  return PAYMENT_STATUSES.includes(paymentStatus as (typeof PAYMENT_STATUSES)[number])
    ? paymentStatus!
    : "Fully Paid";
}

export type StudentPaymentStatusFilter = "all" | "Fully Paid" | "Half Scholar";

export function matchesStudentPaymentStatusFilter(
  paymentStatus: string | null | undefined,
  filter: StudentPaymentStatusFilter
): boolean {
  const ps = normalizePaymentStatus(paymentStatus);
  if (filter === "all") return ps === "Fully Paid" || ps === "Half Scholar";
  return ps === filter;
}

export function parseStudentPaymentStatusFilter(
  raw: string | null | undefined
): StudentPaymentStatusFilter {
  if (raw === "all" || raw === "Half Scholar") return raw;
  return "Fully Paid";
}

type TuitionStudent = {
  paymentStatus: string | null;
  customSemesterFee?: number | null;
  department: { tuitionFee: number | null };
};

export function computeTermTuition(
  student: TuitionStudent,
  termPayments: { amount: number }[]
) {
  const paymentStatus = normalizePaymentStatus(student.paymentStatus);
  const expectedAmount = perSemesterTuition(
    student.department.tuitionFee ?? 0,
    paymentStatus,
    student.customSemesterFee
  );
  const paidAmount = semesterAmountPaid(termPayments);
  return { paymentStatus, expectedAmount, paidAmount };
}

export function isTermFullyPaid(expectedAmount: number, paidAmount: number): boolean {
  return paidAmount >= expectedAmount - 1e-6;
}

export function isTermUnpaid(expectedAmount: number, paidAmount: number): boolean {
  return expectedAmount > 0 && paidAmount < expectedAmount - 1e-6;
}

export function classifyStudentTermPayment(
  student: TuitionStudent,
  termPayments: { amount: number }[],
  filter: StudentPaymentStatusFilter
): "paid" | "unpaid" | "excluded" {
  if (!matchesStudentPaymentStatusFilter(student.paymentStatus, filter)) {
    return "excluded";
  }
  const { expectedAmount, paidAmount } = computeTermTuition(student, termPayments);
  if (expectedAmount <= 0) return "excluded";
  return isTermFullyPaid(expectedAmount, paidAmount) ? "paid" : "unpaid";
}

export const MAX_PAYMENTS_PER_SEMESTER = 5;

/** Sum of amounts already recorded for one student/term. */
export function semesterAmountPaid(payments: { amount: number }[]): number {
  return payments.reduce((sum, p) => sum + p.amount, 0);
}

/** Whether another deposit can be posted for this term (up to 5 payments, not over expected fee). */
export function validateSemesterPayment(
  existingPayments: { amount: number }[],
  newAmount: number,
  expectedFee: number
): { ok: true } | { ok: false; error: string } {
  if (newAmount <= 0) {
    return { ok: false, error: "Amount must be greater than 0" };
  }
  if (expectedFee <= 0) {
    return { ok: false, error: "No tuition is due for this student" };
  }

  const totalPaid = semesterAmountPaid(existingPayments);

  if (totalPaid >= expectedFee - 1e-6) {
    return {
      ok: false,
      error: "Tuition for this semester is already paid in full",
    };
  }

  if (existingPayments.length >= MAX_PAYMENTS_PER_SEMESTER) {
    return {
      ok: false,
      error: `Maximum of ${MAX_PAYMENTS_PER_SEMESTER} payments allowed per semester`,
    };
  }

  const remaining = expectedFee - totalPaid;
  if (newAmount > remaining + 1e-6) {
    return {
      ok: false,
      error: `Payment exceeds remaining balance of $${remaining.toFixed(2)} for this semester`,
    };
  }

  return { ok: true };
}
