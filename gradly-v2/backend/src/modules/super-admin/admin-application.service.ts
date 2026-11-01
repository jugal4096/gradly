/**
 * Compatibility exports for the current Super Admin application repository.
 * Application review logic lives in the repository's transactional operations.
 */
export {
  listApplications,
  listInstitutionBranches,
  saveApplicationConfiguration,
  reviewApplication,
} from "./admin-application.repository";

export type {
  ApplicationDecision,
  ReviewApplicationInput,
  SaveApplicationConfigurationInput,
} from "./admin-application.repository";
