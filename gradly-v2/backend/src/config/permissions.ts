export const ADMIN_PERMISSIONS = {
    FEEDBACK_VIEW: "FEEDBACK_VIEW",
    FEEDBACK_MANAGE: "FEEDBACK_MANAGE",
  
    CURRICULUM_VIEW: "CURRICULUM_VIEW",
    CURRICULUM_CHANGE_REQUEST: "CURRICULUM_CHANGE_REQUEST",
  
    STUDENT_VIEW: "STUDENT_VIEW",
    STUDENT_ACADEMIC_VIEW: "STUDENT_ACADEMIC_VIEW",
  
    RESULT_VIEW: "RESULT_VIEW",
  
    BUG_REPORT_VIEW: "BUG_REPORT_VIEW",
    BUG_REPORT_MANAGE: "BUG_REPORT_MANAGE",
  
    ADMIN_VIEW: "ADMIN_VIEW",
    ADMIN_CREATE: "ADMIN_CREATE",
    ADMIN_UPDATE: "ADMIN_UPDATE",
    ADMIN_SUSPEND: "ADMIN_SUSPEND",
  
    AUDIT_VIEW: "AUDIT_VIEW",
  } as const;
  
  export type AdminPermission =
    (typeof ADMIN_PERMISSIONS)[keyof typeof ADMIN_PERMISSIONS];
  
  export function isValidAdminPermission(
    permission: string
  ): permission is AdminPermission {
    return Object.values(ADMIN_PERMISSIONS).includes(
      permission as AdminPermission
    );
  }