/**
 * Build consecutive (semester, year) labels from an ordered semester list.
 * When the list wraps to the first semester, the year increments.
 */
export function buildTermSequence(
  orderedSemesterNames: string[],
  startName: string,
  startYear: number,
  count: number
): { semester: string; year: number }[] {
  const startIdx = orderedSemesterNames.indexOf(startName);
  if (startIdx < 0) {
    throw new Error("INVALID_SEMESTER");
  }
  const n = orderedSemesterNames.length;
  if (n === 0) {
    throw new Error("NO_SEMESTERS");
  }
  const out: { semester: string; year: number }[] = [];
  let idx = startIdx;
  let y = startYear;
  for (let k = 0; k < count; k++) {
    out.push({ semester: orderedSemesterNames[idx], year: y });
    idx++;
    if (idx >= n) {
      idx = 0;
      y++;
    }
  }
  return out;
}
