import {
    createAuditLog,
    findAllStudents,
    findSemesterCourses,
    findStudentById,
    findStudentSemesters,
  } from "./user-management.repository";
  
  
  export async function getStudents(
    search?: string
  ) {
    return await findAllStudents(search);
  }
  
  
  export async function getStudentDetails(
    userId: string,
    auditContext?: {
      superAdminId: string;
      ipAddress?: string | null;
    }
  ) {
    const student =
      await findStudentById(userId);
  
    if (!student) {
      throw new Error(
        "Student account was not found."
      );
    }
  
    const semesters =
      await findStudentSemesters(userId);
  
    const semestersWithCourses =
      await Promise.all(
        semesters.map(async (semester) => {
          const courses =
            await findSemesterCourses(
              semester.id
            );
  
          return {
            ...semester,
            courses,
          };
        })
      );

    // Match the student's CGPA tracker: cumulative credit-weighted SGPA,
    // evaluated in semester order and exposed as a snapshot on each result.
    let cumulativeCredits = 0;
    let cumulativeWeightedPoints = 0;
    const semestersWithCumulativeCgpa = semestersWithCourses.map((semester) => {
      const credits = Number(semester.credits_registered ?? 0);
      const sgpa = Number(semester.sgpa);
      if (credits > 0 && Number.isFinite(credits) && Number.isFinite(sgpa)) {
        cumulativeCredits += credits;
        cumulativeWeightedPoints += sgpa * credits;
      }
      return {
        ...semester,
        cumulative_cgpa: cumulativeCredits > 0
          ? Number((cumulativeWeightedPoints / cumulativeCredits).toFixed(2))
          : null,
      };
    });
  
    if (auditContext) {
      await createAuditLog({
        actorType: "SUPER_ADMIN",
        actorId: auditContext.superAdminId,
        actorRole: "SUPER_ADMIN",
        action:
          "SUPER_ADMIN_VIEWED_USER_ACADEMIC_RECORD",
        entityTable: "users",
        entityId: userId,
        ipAddress:
          auditContext.ipAddress ?? null,
        metadata: {
          viewedArea: "USER_ACADEMIC_RECORD",
        },
      });
    }
  
    return {
      student,
      semesters: semestersWithCumulativeCgpa,
    };
  }