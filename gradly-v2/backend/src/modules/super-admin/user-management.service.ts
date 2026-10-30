import {
    createAuditLog,
    findAllStudents,
    findUserActivity,
    updateStudentActive,
    findSemesterCourses,
    findStudentById,
    findStudentSemesters,
  } from "./user-management.repository";
  
  
  export async function getStudents(filters: { search?: string; institution?: string; program?: string; branch?: string; active?: boolean } = {}) {
    return await findAllStudents(filters);
  }

export async function setStudentActive(userId: string, active: boolean, auditContext: { superAdminId: string; ipAddress?: string | null }) {
  const student = await updateStudentActive(userId, active);
  if (!student) throw new Error("Student account was not found.");
  await createAuditLog({
    actorType: "SUPER_ADMIN", actorId: auditContext.superAdminId, actorRole: "SUPER_ADMIN",
    action: active ? "SUPER_ADMIN_REACTIVATED_USER" : "SUPER_ADMIN_DISABLED_USER",
    entityTable: "users", entityId: userId, ipAddress: auditContext.ipAddress ?? null,
    metadata: { active },
  });
  return student;
}

export async function getStudentActivity(userId: string) {
  return await findUserActivity(userId);
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