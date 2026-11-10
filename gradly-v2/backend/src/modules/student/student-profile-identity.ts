export type AcademicIdentitySnapshot = {
  academic_profile_confirmed?: boolean | null;
  institution_id?: string | null;
  curriculum_id?: string | null;
  student_identifier?: string | null;
  admission_year?: number | string | null;
  admission_mode_name?: string | null;
};

export type AcademicIdentityUpdate = {
  institutionId: string;
  curriculumId: string;
  studentIdentifier: string;
  admissionYear: number;
  admissionModeName: string | null;
};

export function hasConfirmedAcademicIdentityChanged(
  existing: AcademicIdentitySnapshot | null | undefined,
  next: AcademicIdentityUpdate,
): boolean {
  if (existing?.academic_profile_confirmed !== true) return false;
  return String(existing.institution_id ?? "") !== next.institutionId ||
    String(existing.curriculum_id ?? "") !== next.curriculumId ||
    String(existing.student_identifier ?? "").trim().toUpperCase() !== next.studentIdentifier.trim().toUpperCase() ||
    Number(existing.admission_year) !== next.admissionYear ||
    String(existing.admission_mode_name ?? "").trim().toLowerCase() !== String(next.admissionModeName ?? "").trim().toLowerCase();
}
