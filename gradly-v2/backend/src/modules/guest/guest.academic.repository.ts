import { pool } from "../../config/database";

export interface CreateGuestSemesterData {
  guestSessionId: string;
  curriculumId?: string | null;
  semesterId?: string | null;
  attemptNumber?: number;
}

export interface CreateGuestCourseData {
  guestSemesterId: string;
  curriculumSubjectId?: string | null;
  courseCodeSnapshot: string;
  courseNameSnapshot: string;
  credits: number;
  registrationStatus?: string;
  gradeSymbol?: string | null;
  gradePoint?: number | null;
  marks?: number | null;
  maximumMarks?: number | null;
  resultStatus?: string;
  resultSource?: string;
}

export async function findGuestSemester(
  guestSessionId: string,
  semesterId?: string | null
) {
  const query = `
    SELECT
      id,
      guest_session_id,
      curriculum_id,
      semester_id,
      attempt_number,
      status,
      result_publication_status,
      result_source,
      verified,
      credits_registered,
      credits_earned,
      sgpa,
      sgpa_calculated_at,
      result_declared_at,
      created_at,
      updated_at
    FROM guest_semesters
    WHERE guest_session_id = $1
      AND (
        $2::uuid IS NULL
        OR semester_id = $2
      )
    ORDER BY created_at DESC
    LIMIT 1;
  `;

  const result = await pool.query(query, [
    guestSessionId,
    semesterId ?? null,
  ]);

  return result.rows[0] ?? null;
}

export async function createGuestSemester(
  data: CreateGuestSemesterData
) {
  const query = `
    INSERT INTO guest_semesters (
      guest_session_id,
      curriculum_id,
      semester_id,
      attempt_number
    )
    VALUES ($1, $2, $3, $4)
    RETURNING
      id,
      guest_session_id,
      curriculum_id,
      semester_id,
      attempt_number,
      status,
      result_publication_status,
      result_source,
      verified,
      credits_registered,
      credits_earned,
      sgpa,
      sgpa_calculated_at,
      created_at,
      updated_at;
  `;

  const result = await pool.query(query, [
    data.guestSessionId,
    data.curriculumId ?? null,
    data.semesterId ?? null,
    data.attemptNumber ?? 1,
  ]);

  return result.rows[0];
}

export async function createGuestCourse(
  data: CreateGuestCourseData
) {
  const query = `
    INSERT INTO guest_semester_courses (
      guest_semester_id,
      curriculum_subject_id,
      course_code_snapshot,
      course_name_snapshot,
      credits,
      registration_status,
      grade_symbol,
      grade_point,
      marks,
      maximum_marks,
      result_status,
      result_source
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10,
      $11, $12
    )
    RETURNING
      id,
      guest_semester_id,
      curriculum_subject_id,
      course_code_snapshot,
      course_name_snapshot,
      credits,
      registration_status,
      grade_symbol,
      grade_point,
      marks,
      maximum_marks,
      result_status,
      result_source,
      verified,
      attempt_number,
      created_at,
      updated_at;
  `;

  const result = await pool.query(query, [
    data.guestSemesterId,
    data.curriculumSubjectId ?? null,
    data.courseCodeSnapshot,
    data.courseNameSnapshot,
    data.credits,
    data.registrationStatus ?? "REGISTERED",
    data.gradeSymbol ?? null,
    data.gradePoint ?? null,
    data.marks ?? null,
    data.maximumMarks ?? null,
    data.resultStatus ?? "PENDING",
    data.resultSource ?? "MANUAL_ENTRY",
  ]);

  return result.rows[0];
}

export async function getGuestSemesterCourses(
  guestSemesterId: string
) {
  const query = `
    SELECT
      id,
      guest_semester_id,
      curriculum_subject_id,
      course_code_snapshot,
      course_name_snapshot,
      credits,
      registration_status,
      grade_symbol,
      grade_point,
      marks,
      maximum_marks,
      result_status,
      result_source,
      verified,
      attempt_number,
      created_at,
      updated_at
    FROM guest_semester_courses
    WHERE guest_semester_id = $1
    ORDER BY created_at ASC;
  `;

  const result = await pool.query(query, [guestSemesterId]);

  return result.rows;
}