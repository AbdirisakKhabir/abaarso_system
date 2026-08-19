import { normalizedSemester, semestersMatch } from "@/lib/enrollment";

export type TermLedgerInput = {
  currentClass?: { semester: string; year: number } | null;
  enrollments?: { semester: string; year: number }[];
  charges?: { semester: string; year: number; amount: number }[];
  payments?: { semester: string; year: number; amount: number }[];
  expectedPerSemester?: number;
  /** Denormalized Student.balance — leftover after charged terms is "unknown semester". */
  accountBalance?: number;
};

export type TermLedgerRow = {
  semester: string;
  year: number;
  charged: number;
  paid: number;
  remaining: number;
  isCurrent: boolean;
  alreadyCharged: boolean;
};

export type StudentOwing = {
  terms: TermLedgerRow[];
  unknownBalance: number;
  owingTotal: number;
  /** Oldest billed term that still has remaining (the semester this balance is from). */
  primary: TermLedgerRow | null;
};

function termKey(semester: string, year: number) {
  return `${normalizedSemester(semester)}\0${year}`;
}

/**
 * Build a per-term billed vs paid ledger so finance staff can see which
 * semester is owed — including terms from before the student was upgraded.
 */
export function buildTermLedger(input: TermLedgerInput): TermLedgerRow[] {
  const map = new Map<
    string,
    { semester: string; year: number; charged: number; paid: number }
  >();

  const add = (semester: string, year: number) => {
    const key = termKey(semester, year);
    const existing = map.get(key);
    if (existing) return existing;
    const row = { semester, year, charged: 0, paid: 0 };
    map.set(key, row);
    return row;
  };

  if (input.currentClass) add(input.currentClass.semester, input.currentClass.year);
  for (const e of input.enrollments ?? []) add(e.semester, e.year);
  for (const c of input.charges ?? []) {
    add(c.semester, c.year).charged += Number(c.amount) || 0;
  }
  for (const p of input.payments ?? []) {
    add(p.semester, p.year).paid += Number(p.amount) || 0;
  }

  const expected = Math.max(0, Number(input.expectedPerSemester) || 0);
  const currentKey = input.currentClass
    ? termKey(input.currentClass.semester, input.currentClass.year)
    : "";

  const rows: TermLedgerRow[] = [...map.values()].map((row) => {
    const isCurrent = termKey(row.semester, row.year) === currentKey;
    // Previous terms only count as owed when they were actually invoiced.
    const billed = row.charged > 0 ? row.charged : isCurrent ? expected : 0;
    const remaining = Math.max(0, billed - row.paid);
    return {
      semester: row.semester,
      year: row.year,
      charged: row.charged,
      paid: row.paid,
      remaining,
      isCurrent,
      alreadyCharged: row.charged > 0,
    };
  });

  rows.sort((a, b) => a.year - b.year || a.semester.localeCompare(b.semester));
  return rows;
}

export function findTerm(
  rows: TermLedgerRow[],
  semester: string,
  year: number
): TermLedgerRow | undefined {
  return rows.find((t) => t.year === year && semestersMatch(t.semester, semester));
}

/** Oldest term that still has remaining tuition. */
export function oldestUnpaidTerm(rows: TermLedgerRow[]): TermLedgerRow | null {
  return rows.find((r) => r.remaining > 1e-6) ?? null;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Outstanding tuition and which semester it belongs to.
 * Charged terms are the source of truth; leftover Student.balance is unknown-semester.
 */
export function computeStudentOwing(input: TermLedgerInput): StudentOwing {
  const terms = buildTermLedger(input);
  const chargedRemaining = terms
    .filter((t) => t.alreadyCharged)
    .reduce((sum, t) => sum + t.remaining, 0);
  const account = Math.max(0, Number(input.accountBalance) || 0);
  const unknownBalance = round2(Math.max(0, account - chargedRemaining));
  const owingTotal = round2(chargedRemaining + unknownBalance);
  const primary =
    oldestUnpaidTerm(terms.filter((t) => t.alreadyCharged)) ??
    (unknownBalance > 1e-6 ? null : oldestUnpaidTerm(terms));

  return {
    terms,
    unknownBalance,
    owingTotal,
    primary,
  };
}

export function formatOwingSource(owing: StudentOwing): string {
  const unpaid = owing.terms.filter((t) => t.remaining > 1e-6);
  if (unpaid.length === 0 && owing.unknownBalance <= 1e-6) return "No outstanding tuition";
  if (unpaid.length === 1 && owing.unknownBalance <= 1e-6) {
    const t = unpaid[0]!;
    return `${t.semester} ${t.year}`;
  }
  const parts = unpaid.map((t) => `${t.semester} ${t.year}`);
  if (owing.unknownBalance > 1e-6) parts.push("unknown semester");
  return parts.join(", ");
}
