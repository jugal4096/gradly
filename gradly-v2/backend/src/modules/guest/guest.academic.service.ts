import {
    createGuestCourse,
    createGuestSemester,
    findGuestSemester,
    getGuestSemesterCourses,
    type CreateGuestCourseData,
    type CreateGuestSemesterData,
  } from "./guest.academic.repository";
  
  export async function getOrCreateGuestSemester(
    data: CreateGuestSemesterData
  ) {
    const existing = await findGuestSemester(
      data.guestSessionId,
      data.semesterId
    );
  
    if (existing) {
      return existing;
    }
  
    return await createGuestSemester(data);
  }
  
  export async function addGuestCourse(
    data: CreateGuestCourseData
  ) {
    return await createGuestCourse(data);
  }
  
  export async function getGuestCourses(
    guestSemesterId: string
  ) {
    return await getGuestSemesterCourses(guestSemesterId);
  }