import {
  createApplication,
  findApplicationsForUser,
  findBranchInInstitution,
  findProgramName,
  findProgramInInstitution,
  findSpecializationInBranch,
  findDuplicateApplication,
  findUserByFirebaseUid,
  CreateApplicationInput
} from "./admin-application.repository";

export class ApplicationError extends Error {
  constructor(
    message: string,
    public statusCode = 400
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ApplicationError(`${field} is required.`);
  }

  return value.trim();
}

export async function submitAdminApplication(
  firebaseUid: string,
  authenticatedEmail: string | undefined,
  body: Record<string, unknown>
) {
  const user = await findUserByFirebaseUid(firebaseUid);

  if (!user) {
    throw new ApplicationError(
      "Your account has not been synchronized with Gradly. Sign in again and retry.",
      403
    );
  }

  if (!user.active) {
    throw new ApplicationError("Your account is inactive.", 403);
  }

  const institutionId = requiredString(
    body.institution_id,
    "Institution"
  );
  const programId = requiredString(body.program_id, "Program");
  const programName = (await findProgramName(programId))?.trim().toLowerCase() ?? "";
  const isMCA = programName === "mca" || programName.includes("master of computer applications");
  const branchId = isMCA ? "" : requiredString(body.branch_id, "Branch");
  const fullName = requiredString(body.full_name, "Full name");
  const enrollmentNumber = requiredString(
    body.enrollment_number,
    "Enrollment number"
  );
  const mobileNumber = requiredString(
    body.mobile_number,
    "Mobile number"
  );
  const graduationDate = requiredString(
    body.graduation_date,
    "Graduation date"
  );

  if (!/^\d{4}-\d{2}-\d{2}$/.test(graduationDate)) {
    throw new ApplicationError("Graduation date must use YYYY-MM-DD.");
  }

  const parsedDate = new Date(`${graduationDate}T00:00:00Z`);

  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== graduationDate
  ) {
    throw new ApplicationError("Graduation date is invalid.");
  }

  const today = new Date().toISOString().slice(0, 10);

  if (graduationDate < today) {
    throw new ApplicationError(
      "Graduation date must be today or in the future."
    );
  }

  if (!/^[6-9]\d{9}$/.test(mobileNumber)) {
    throw new ApplicationError(
      "Enter a valid 10-digit Indian mobile number."
    );
  }

  const email = (authenticatedEmail || user.email || "")
    .trim()
    .toLowerCase();

  if (!email) {
    throw new ApplicationError(
      "Your Google account must have an email address.",
      400
    );
  }

  if (
    user.email &&
    authenticatedEmail &&
    user.email.toLowerCase() !== authenticatedEmail.toLowerCase()
  ) {
    throw new ApplicationError(
      "Your authenticated email does not match your Gradly account.",
      403
    );
  }

  if (isMCA) {
    const program = await findProgramInInstitution(programId, institutionId);
    if (!program) {
      throw new ApplicationError("The selected program does not belong to the selected institution.");
    }
  } else {
    const branch = await findBranchInInstitution(branchId, institutionId, programId);
    if (!branch) {
      throw new ApplicationError("The selected branch does not belong to the selected institution.");
    }
  }

  if (isMCA && typeof body.specialization_code === "string" && body.specialization_code.trim()) {
    throw new ApplicationError("MCA does not use an M.Tech stream / specialization.");
  }

  const specializationCode = typeof body.specialization_code === "string"
    ? body.specialization_code.trim()
    : "";
  let specializationId: string | undefined;
  if (specializationCode) {
    const specialization = await findSpecializationInBranch(
      specializationCode,
      programId,
      branchId
    );
    if (!specialization) {
      throw new ApplicationError("The selected stream does not belong to the selected M.Tech department.");
    }
    specializationId = specialization.id;
  }

  const duplicate = await findDuplicateApplication(
    user.id,
    institutionId,
    branchId
  );

  if (duplicate) {
    throw new ApplicationError(
      `This Firebase account has already submitted its one allowed admin application (current status: ${duplicate.status.toLowerCase()}).`,
      409
    );
  }

  const optionalString = (value: unknown, field: string) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    if (typeof value !== "string") {
      throw new ApplicationError(`${field} must be text.`);
    }

    return value.trim();
  };

  const input: CreateApplicationInput = {
    userId: user.id,
    institutionId,
    programId,
    branchId,
    specializationId,
    fullName,
    enrollmentNumber,
    mobileNumber,
    email,
    graduationDate,
    qualification: optionalString(body.qualification, "Qualification"),
    reason: optionalString(body.reason, "Reason"),
    additionalNote: optionalString(
      body.additional_note,
      "Additional note"
    )
  };

  return createApplication(input);
}

export async function getMyAdminApplications(firebaseUid: string) {
  const user = await findUserByFirebaseUid(firebaseUid);

  if (!user) {
    throw new ApplicationError(
      "Your account has not been synchronized with Gradly.",
      403
    );
  }

  return findApplicationsForUser(user.id);
}