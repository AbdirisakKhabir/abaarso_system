/**
 * University transcript brand configuration.
 * Customize these values to match your institution.
 */
export const TRANSCRIPT_BRAND = {
  universityName: "Abaarso Tech University",
  officeTitle: "Office of the Registrar",
  documentTitle: "Student's Cumulative Record and Partial Transcript",
  email: "registrar@abaarsotech.edu",
  website: "www.abaarsotech.edu",
  logoUrl: "/logo/logo%20abaarso.png",
  /** Background only on the Academic Year / Semester bar (tables stay white) */
  semesterBandBg: "#9e0539",
  semesterBandText: "#FFFFFF",
  /** Failing marks highlight (typically &lt; 50) */
  failGradeBg: "#FFFF00",
  failGradeText: "#000000",
  /** Shown above the grading legend table */
  gradingSystemTitle: "Grading System",
} as const;

/**
 * Display-only legend for the transcript (layout matches official partial transcript style).
 * Adjust ranges to match your registrar policy; grading logic in the app uses `lib/grades.ts`.
 */
export const GRADING_SYSTEM_LEGEND = [
  { range: "95-100", grade: "A+" },
  { range: "90-94", grade: "A" },
  { range: "85-89", grade: "A-" },
  { range: "80-84", grade: "B+" },
  { range: "75-79", grade: "B" },
  { range: "70-74", grade: "B-" },
  { range: "65-69", grade: "C+" },
  { range: "60-64", grade: "C" },
  { range: "55-59", grade: "D+" },
  { range: "50-54", grade: "D" },
  { range: "Below 50", grade: "F" },
] as const;
