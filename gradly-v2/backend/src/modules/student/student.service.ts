import {
  createStudentProfile,
  findStudentProfileByUserId,
  updateStudentProfile,
  type CreateStudentProfileData,
} from "./student.repository";

export async function getStudentProfile(userId: string) {
  return findStudentProfileByUserId(userId);
}

export async function createProfile(data: CreateStudentProfileData) {
  const existingProfile = await findStudentProfileByUserId(data.userId);
  if (existingProfile) throw new Error("Student profile already exists.");
  return createStudentProfile(data);
}

export async function updateProfile(data: CreateStudentProfileData) {
  const existingProfile = await findStudentProfileByUserId(data.userId);
  if (!existingProfile) throw new Error("Student profile not found.");
  return updateStudentProfile(data);
}
