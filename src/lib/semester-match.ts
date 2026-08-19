const SEMESTER_WORDS: Record<string, string> = {
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
};

/** Canonical form so "Semester Eight" and "Semester 8" compare equal. */
export function normalizedSemester(s: string): string {
  let out = String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  for (const [word, num] of Object.entries(SEMESTER_WORDS)) {
    out = out.replace(new RegExp(`\\b${word}\\b`, "g"), num);
  }
  return out.replace(/[^a-z0-9]/g, "");
}

/** Loose semester compare so "Semester Eight" and "Semester 8" match. */
export function semestersMatch(a: string, b: string): boolean {
  if (String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase()) return true;
  return normalizedSemester(a) === normalizedSemester(b);
}
