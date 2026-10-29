import {
    createGuestCourse,
    createGuestSemester,
    findGuestSemester,
    findGuestSemesterByIdAndSession,
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
    data: CreateGuestCourseData,
    guestSessionId: string
  ) {
    return await createGuestCourse(data, guestSessionId);
  }
  
  export async function getGuestCourses(
    guestSessionId: string,
    guestSemesterId: string
  ) {
    const semester = await findGuestSemesterByIdAndSession(
      guestSemesterId,
      guestSessionId
    );

    if (!semester) {
      return null;
    }

    return await getGuestSemesterCourses(guestSessionId, guestSemesterId);
  }