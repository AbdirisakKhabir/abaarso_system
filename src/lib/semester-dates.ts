/**
 * Maps semester name + year to date range for filtering attendance sessions.
 * Fall: Aug 1 - Dec 31
 * Spring: Jan 1 - May 31
 * Summer: May 1 - Aug 31
 */
export function getSemesterDateRange(
  semester: string,
  year: number
): { start: Date; end: Date } {
  const s = String(semester).trim().toLowerCase();
  if (s === "fall") {
    return {
      start: new Date(year, 7, 1), // Aug 1
      end: new Date(year, 11, 31), // Dec 31
    };
  }
  if (s === "spring") {
    return {
      start: new Date(year, 0, 1), // Jan 1
      end: new Date(year, 4, 31), // May 31
    };
  }
  if (s === "summer") {
    return {
      start: new Date(year, 4, 1), // May 1
      end: new Date(year, 7, 31), // Aug 31
    };
  }
  // Default: full year
  return {
    start: new Date(year, 0, 1),
    end: new Date(year, 11, 31),
  };
}
