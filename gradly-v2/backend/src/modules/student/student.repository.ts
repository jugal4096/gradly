import { pool } from "../../config/database";

export interface CreateStudentProfileData {
  userId: string;
  institutionId: string;
  curriculumId: string;
  admissionModeId?: string | null;
  admissionModeName?: string | null;
  studentIdentifier: string;
  admissionYear: number;
  currentSemesterNumber: number | null;
  academicStatus: string;
  graduationYear?: number | null;
  targetCgpa?: number | null;
}

export async function findStudentProfileByUserId(userId: string) {
  const result = await pool.query(`
    SELECT
      sp.id, sp.user_id, sp.institution_id, sp.curriculum_id,
      sp.admission_mode_id, sp.student_identifier, sp.admission_year,
      sp.current_semester_number, sp.academic_status, sp.graduation_year, sp.target_cgpa,
      sp.current_cgpa, sp.current_earned_credits, sp.created_at, sp.updated_at,
      i.name AS institution_name, p.name AS program_name,
      b.name AS branch_name, s.name AS scheme_name,
      am.name AS admission_mode_name
    FROM student_profiles sp
    JOIN institutions i ON i.id = sp.institution_id
    JOIN curricula c ON c.id = sp.curriculum_id
    JOIN programs p ON p.id = c.program_id
    JOIN branches b ON b.id = c.branch_id
    JOIN schemes s ON s.id = c.scheme_id
    LEFT JOIN admission_modes am ON am.id = sp.admission_mode_id
    WHERE sp.user_id = $1
    LIMIT 1;
  `, [userId]);
  return result.rows[0] ?? null;
}

const returningColumns = `
  id, user_id, institution_id, curriculum_id, admission_mode_id,
  student_identifier, admission_year, current_semester_number, academic_status,
  graduation_year, target_cgpa, current_cgpa, current_earned_credits,
  created_at, updated_at
`;

function profileValues(data: CreateStudentProfileData) {
  return [
    data.userId, data.institutionId, data.curriculumId,
    data.admissionModeId ?? null, data.admissionModeName ?? null, data.studentIdentifier.trim(),
    data.admissionYear, data.currentSemesterNumber, data.academicStatus,
    data.graduationYear ?? null, data.targetCgpa ?? null,
  ];
}

export async function createStudentProfile(data: CreateStudentProfileData) {
  const result = await pool.query(`
    INSERT INTO student_profiles (
      user_id, institution_id, curriculum_id, admission_mode_id,
      student_identifier, admission_year, current_semester_number, academic_status,
      graduation_year, target_cgpa
    ) VALUES ($1,$2,$3,COALESCE($4,(SELECT id FROM admission_modes WHERE LOWER(name)=LOWER($5) LIMIT 1)),$6,$7,$8,$9,$10,$11)
    RETURNING ${returningColumns};
  `, profileValues(data));
  return result.rows[0];
}

export async function updateStudentProfile(data: CreateStudentProfileData) {
  const result = await pool.query(`
    UPDATE student_profiles
    SET institution_id = $2,
        curriculum_id = $3,
        admission_mode_id = COALESCE($4,(SELECT id FROM admission_modes WHERE LOWER(name)=LOWER($5) LIMIT 1)),
        student_identifier = $6,
        admission_year = $7,
        current_semester_number = $8,
        academic_status = $9,
        graduation_year = $10,
        target_cgpa = $11,
        updated_at = NOW()
    WHERE user_id = $1
    RETURNING ${returningColumns};
  `, profileValues(data));
  return result.rows[0] ?? null;
}
