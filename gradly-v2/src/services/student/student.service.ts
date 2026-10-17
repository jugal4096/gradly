import type { StudentProfile } from "../../domain/student/studentProfile.types";

import {
  createStudent,
  getStudentById,
  updateStudent,
} from "../../repositories";

export async function getStudentProfile(
  studentId: string
): Promise<StudentProfile | null> {
  return getStudentById(studentId);
}

export async function createStudentProfile(
  student: StudentProfile
): Promise<void> {
  await createStudent(student);
}

export async function updateStudentProfile(
  studentId: string,
  data: Partial<StudentProfile>
): Promise<void> {
  await updateStudent(studentId, data);
}