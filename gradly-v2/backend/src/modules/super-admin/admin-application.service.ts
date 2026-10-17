import {
    acceptAdminApplication,
    createAdminApplication,
    createAdminAuditLog,
    findAdminApplicantContext,
    findAdminApplicationById,
    findAdminApplications,
    findApplicantBlock,
    findExistingApplication,
    permanentlyBlockApplicant,
    rejectAdminApplication,
    type CreateAdminApplicationData,
  } from "./admin-application.repository";
  
  export async function submitAdminApplication(
    data: CreateAdminApplicationData
  ) {
    const applicant =
      await findAdminApplicantContext(data.userId);
  
    if (!applicant) {
      throw new Error(
        "Student account information was not found."
      );
    }
  
    if (!applicant.student_profile_id) {
      throw new Error(
        "Student profile must be completed before applying for admin access."
      );
    }
  
    const block =
      await findApplicantBlock(data.userId);
  
    if (block) {
      throw new Error(
        "This account is not eligible to submit an admin application."
      );
    }
  
    const existingApplication =
      await findExistingApplication(data.userId);
  
    if (existingApplication) {
      throw new Error(
        "An admin application already exists for this account."
      );
    }
  
    if (
      data.institutionId !==
      applicant.institution_id
    ) {
      throw new Error(
        "Institution does not match the student profile."
      );
    }
  
    if (
      data.branchId !==
      applicant.branch_id
    ) {
      throw new Error(
        "Branch does not match the student profile."
      );
    }
  
    if (
      data.enrollmentNumber.trim() !==
      applicant.student_identifier.trim()
    ) {
      throw new Error(
        "Enrollment number does not match the student profile."
      );
    }
  
    if (
      applicant.graduation_year &&
      new Date(data.graduationDate)
        .getUTCFullYear() !==
        Number(applicant.graduation_year)
    ) {
      throw new Error(
        "Graduation date does not match the student profile."
      );
    }
  
    return await createAdminApplication(data);
  }
  
  export async function getMyAdminApplication(
    userId: string
  ) {
    const application =
      await findExistingApplication(userId);
  
    if (!application) {
      return null;
    }
  
    /*
     * Applicant cannot track rejection details.
     */
    if (application.status === "REJECTED") {
      return {
        exists: true,
        status: "UNAVAILABLE",
      };
    }
  
    return {
      id: application.id,
      status: application.status,
      created_at: application.created_at,
    };
  }
  
  export async function listApplications(
    status?: string
  ) {
    return await findAdminApplications(status);
  }
  
  export async function getApplication(
    applicationId: string
  ) {
    const application =
      await findAdminApplicationById(
        applicationId
      );
  
    if (!application) {
      throw new Error(
        "Admin application was not found."
      );
    }
  
    return application;
  }
  
  export async function rejectApplication(
    applicationId: string,
    superAdminId: string,
    reason: string,
    ipAddress?: string | null
  ) {
    if (!reason.trim()) {
      throw new Error(
        "A rejection reason is required."
      );
    }
  
    const result =
      await rejectAdminApplication(
        applicationId,
        superAdminId,
        reason.trim()
      );
  
    if (!result) {
      throw new Error(
        "Only pending admin applications can be rejected."
      );
    }
  
    await createAdminAuditLog({
      superAdminId,
      action:
        "ADMIN_APPLICATION_REJECTED",
      entityTable:
        "admin_applications",
      entityId: applicationId,
      ipAddress,
      metadata: {
        reason: reason.trim(),
      },
    });
  
    return result;
  }
  
  export async function acceptApplication(
    applicationId: string,
    superAdminId: string,
    ipAddress?: string | null
  ) {
    const result =
      await acceptAdminApplication(
        applicationId,
        superAdminId
      );
  
    await createAdminAuditLog({
      superAdminId,
      action:
        "ADMIN_APPLICATION_ACCEPTED",
      entityTable:
        "admin_applications",
      entityId: applicationId,
      ipAddress,
      metadata: {
        adminId: result.admin.id,
        adminCode:
          result.admin.admin_code,
        adminshipExpiresAt:
          result.admin.adminship_expires_at,
      },
    });
  
    return result;
  }
  
  export async function blockApplicant(
    applicationId: string,
    superAdminId: string,
    reason: string,
    ipAddress?: string | null
  ) {
    if (!reason.trim()) {
      throw new Error(
        "A block reason is required."
      );
    }
  
    const application =
      await findAdminApplicationById(
        applicationId
      );
  
    if (!application) {
      throw new Error(
        "Admin application was not found."
      );
    }
  
    const block =
      await permanentlyBlockApplicant(
        application.user_id,
        application.institution_id,
        superAdminId,
        reason.trim()
      );
  
    await createAdminAuditLog({
      superAdminId,
      action:
        "ADMIN_APPLICANT_PERMANENTLY_BLOCKED",
      entityTable:
        "admin_applications",
      entityId: applicationId,
      ipAddress,
      metadata: {
        userId: application.user_id,
        reason: reason.trim(),
        blockId: block.id,
      },
    });
  
    return block;
  }