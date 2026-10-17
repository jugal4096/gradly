import { pool } from "../../config/database";

export interface CreateStudentProfileData {
  userId: string;
  institutionId: string;
  curriculumId: string;
  admissionModeId?: string | null;
  studentIdentifier: string;
  admissionYear: number;
  currentSemesterNumber: number;
  graduationYear?: number | null;
  targetCgpa?: number | null;
}

export async function findStudentProfileByUserId(
  userId: string
) {
  const query = `
    SELECT
      sp.id,
      sp.user_id,
      sp.institution_id,
      sp.curriculum_id,
      sp.admission_mode_id,
      sp.student_identifier,
      sp.admission_year,
      sp.current_semester_number,
      sp.graduation_year,
      sp.target_cgpa,
      sp.current_cgpa,
      sp.current_earned_credits,
      sp.created_at,
      sp.updated_at,

      i.name AS institution_name,
      p.name AS program_name,
      b.name AS branch_name,
      s.name AS scheme_name,
      am.name AS admission_mode_name

    FROM student_profiles sp

    JOIN institutions i
      ON i.id = sp.institution_id

    JOIN curricula c
      ON c.id = sp.curriculum_id

    JOIN programs p
      ON p.id = c.program_id

    JOIN branches b
      ON b.id = c.branch_id

    JOIN schemes s
      ON s.id = c.scheme_id

    LEFT JOIN admission_modes am
      ON am.id = sp.admission_mode_id

    WHERE sp.user_id = $1

    LIMIT 1;
  `;

  const result = await pool.query(query, [userId]);

  return result.rows[0] ?? null;
}

export async function createStudentProfile(
  data: CreateStudentProfileData
) {
  const query = `
    INSERT INTO student_profiles (
      user_id,
      institution_id,
      curriculum_id,
      admission_mode_id,
      student_identifier,
      admission_year,
      current_semester_number,
      graduation_year,
      target_cgpa
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9
    )

    RETURNING
      id,
      user_id,
      institution_id,
      curriculum_id,
      admission_mode_id,
      student_identifier,
      admission_year,
      current_semester_number,
      graduation_year,
      target_cgpa,
      current_cgpa,
      current_earned_credits,
      created_at,
      updated_at;
  `;

  const values = [
    data.userId,
    data.institutionId,
    data.curriculumId,
    data.admissionModeId ?? null,
    data.studentIdentifier,
    data.admissionYear,
    data.currentSemesterNumber,
    data.graduationYear ?? null,
    data.targetCgpa ?? null,
  ];

  const result = await pool.query(query, values);

  return result.rows[0];
}