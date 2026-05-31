/**
 * Consistent semester ordering for transcripts and GPA (chronological within each year).
 * Supports DB-driven names (Semester table sortOrder), "Semester 1"…"Semester N", and Fall/Spring/Summer.
 */

/** Ordinal for sorting within the same calendar year (lower = earlier). */
export function semesterOrdinal(semester: string, semOrderMap?: Record<string, number>): number {
  const s = semester.trim();
  if (semOrderMap && Object.prototype.hasOwnProperty.call(semOrderMap, s)) {
    return semOrderMap[s]!;
  }

  const semNum = /semester\s*(\d+)/i.exec(s);
  if (semNum) return 100 + Number(semNum[1]);

  const onlyDigits = /^(\d+)$/.exec(s);
  if (onlyDigits) return 100 + Number(onlyDigits[1]);

  const legacy: Record<string, number> = {
    spring: 1,
    summer: 2,
    fall: 3,
    winter: 4,
  };
  const low = s.toLowerCase();
  if (legacy[low] != null) return legacy[low];

  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return 5000 + Math.abs(h % 10000);
}

/** Keys like "2024-Semester 1" (year first, then full semester label). */
export function parseYearSemesterKey(key: string): { year: number; semester: string } {
  const i = key.indexOf("-");
  if (i <= 0) return { year: 0, semester: key };
  const y = Number(key.slice(0, i));
  return {
    year: Number.isFinite(y) ? y : 0,
    semester: key.slice(i + 1),
  };
}

export function compareTranscriptSemesterKeys(
  a: string,
  b: string,
  semOrderMap?: Record<string, number>
): number {
  const pa = parseYearSemesterKey(a);
  const pb = parseYearSemesterKey(b);
  if (pa.year !== pb.year) return pa.year - pb.year;
  return semesterOrdinal(pa.semester, semOrderMap) - semesterOrdinal(pb.semester, semOrderMap);
}

export function sortExamRecordsBySemesterChronologically<T extends { semester: string; year: number }>(
  records: T[],
  semOrderMap?: Record<string, number>
): T[] {
  return [...records].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return semesterOrdinal(a.semester, semOrderMap) - semesterOrdinal(b.semester, semOrderMap);
  });
}
