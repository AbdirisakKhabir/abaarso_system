export const PROGRAMS = ["Bachelor", "Masters"] as const;

export type Program = (typeof PROGRAMS)[number];

export const DEFAULT_PROGRAM: Program = "Bachelor";

export function isProgram(value: unknown): value is Program {
  return value === "Bachelor" || value === "Masters";
}

/** Parse query/body program; defaults to Bachelor when missing/invalid unless allowAll. */
export function parseProgram(
  value: string | null | undefined,
  opts?: { allowAll?: boolean; fallback?: Program | null }
): Program | null | "all" {
  if (opts?.allowAll && (value == null || value === "" || value === "all")) {
    return "all";
  }
  if (value == null || value === "") {
    return opts?.fallback === null ? null : (opts?.fallback ?? DEFAULT_PROGRAM);
  }
  const trimmed = value.trim();
  if (isProgram(trimmed)) return trimmed;
  // Accept common aliases
  const lower = trimmed.toLowerCase();
  if (lower === "bachelor" || lower === "bachelors" || lower === "undergraduate") {
    return "Bachelor";
  }
  if (lower === "master" || lower === "masters" || lower === "graduate") {
    return "Masters";
  }
  return opts?.fallback === null ? null : (opts?.fallback ?? DEFAULT_PROGRAM);
}

export function programLabel(program: Program): string {
  return program === "Masters" ? "Masters Degree" : "Bachelor Degree";
}
