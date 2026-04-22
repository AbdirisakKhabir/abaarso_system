/** Per-semester tuition before multiplying by semester count (matches student registration rules). */
export function perSemesterTuition(
  departmentTuitionFee: number,
  paymentStatus: string
): number {
  const ps = ["Full Scholarship", "Half Scholar", "Fully Paid"].includes(paymentStatus)
    ? paymentStatus
    : "Fully Paid";
  const base = departmentTuitionFee ?? 0;
  if (ps === "Full Scholarship") return 0;
  if (ps === "Half Scholar") return base * 0.5;
  return base;
}
