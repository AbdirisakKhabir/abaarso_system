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
