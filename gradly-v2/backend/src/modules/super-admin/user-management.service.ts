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
      semesters: semestersWithCourses,
    };
  }