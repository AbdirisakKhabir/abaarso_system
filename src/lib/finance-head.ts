/**
 * Finance heads categorize what a recorded payment is for. "Semester Fee" keeps
 * the tuition rules (validated against the expected semester fee and reduces the
 * student's tuition balance). All other heads are standalone fees: they are
 * banked and reported, but do not touch the student's tuition balance.
 */
export const FINANCE_HEADS = [
  { value: "semester_fee", label: "Semester Fee" },
  { value: "re_exam_fee", label: "Re-Exam Fee" },
  { value: "graduation_fee", label: "Graduation Fee" },
  { value: "registration_fee", label: "Registration Fee" },
  { value: "card_activation_fee", label: "Card Activation Fee" },
  { value: "others", label: "Others" },
] as const;

export type FinanceHead = (typeof FINANCE_HEADS)[number]["value"];

export const DEFAULT_FINANCE_HEAD: FinanceHead = "semester_fee";

const FINANCE_HEAD_VALUES = FINANCE_HEADS.map((h) => h.value) as readonly string[];

const FINANCE_HEAD_LABELS: Record<string, string> = Object.fromEntries(
  FINANCE_HEADS.map((h) => [h.value, h.label])
);

export function isFinanceHead(value: string | null | undefined): value is FinanceHead {
  return value != null && FINANCE_HEAD_VALUES.includes(value);
}

/** Normalize an incoming value to a valid finance head (falls back to default). */
export function parseFinanceHead(
  raw: string | null | undefined,
  fallback: FinanceHead = DEFAULT_FINANCE_HEAD
): FinanceHead {
  return isFinanceHead(raw) ? raw : fallback;
}

export function financeHeadLabel(value: string | null | undefined): string {
  if (value && FINANCE_HEAD_LABELS[value]) return FINANCE_HEAD_LABELS[value];
  return "Semester Fee";
}

/** Semester Fee is the only head that follows tuition rules and affects balance. */
export function isTuitionHead(value: string | null | undefined): boolean {
  return parseFinanceHead(value) === "semester_fee";
}

/** True when an active payment line includes semester tuition. */
export function paymentIncludesSemesterFee(
  lines: { financeHead: string; amount: number }[]
): boolean {
  return lines.some((l) => l.financeHead === "semester_fee" && l.amount > 0);
}

/** Empty amount map for all finance heads (form draft / multi-head entry). */
export function emptyHeadAmounts(): Record<FinanceHead, string> {
  return Object.fromEntries(FINANCE_HEADS.map((h) => [h.value, ""])) as Record<
    FinanceHead,
    string
  >;
}
