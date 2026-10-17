import {
    createStudentProfile,
    findStudentProfileByUserId,
    type CreateStudentProfileData,
  } from "./student.repository";
  
  export async function getStudentProfile(userId: string) {
    return await findStudentProfileByUserId(userId);
  }
  
  export async function createProfile(
    data: CreateStudentProfileData
  ) {
    const existingProfile =
      await findStudentProfileByUserId(data.userId);
  
    if (existingProfile) {
      throw new Error("Student profile already exists.");
    }
  
    return await createStudentProfile(data);
  }