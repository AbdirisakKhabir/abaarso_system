export type NormalizedGender = "Male" | "Female";

/** Map stored values (Male/Female/M/F) to a standard label. */
export function normalizeGender(gender: string | null | undefined): NormalizedGender | null {
  if (!gender) return null;
  const g = gender.trim().toLowerCase();
  if (g === "male" || g === "m") return "Male";
  if (g === "female" || g === "f") return "Female";
  return null;
}

export function formatGenderLabel(gender: string | null | undefined): string {
  return normalizeGender(gender) ?? (gender?.trim() || "—");
}

const MALE_VALUES = ["Male", "M", "m"];
const FEMALE_VALUES = ["Female", "F", "f"];

/** Prisma filter for gender dropdown (Male / Female). */
export function genderFilterValues(filter: NormalizedGender): string[] {
  return filter === "Male" ? MALE_VALUES : FEMALE_VALUES;
}
