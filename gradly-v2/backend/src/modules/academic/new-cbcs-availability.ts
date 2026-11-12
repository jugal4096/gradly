export type NewCbcsBranchEligibilityInput = {
  programmePrefix: string;
  institutionName: string;
  programmeName: string;
  branchName: string;
  branchCode?: string | null;
  schemeName: string;
};

/**
 * GECA's B.Tech New CBCS intake remains supported only for Information Technology.
 * Other institutions, programmes, schemes and postgraduate curricula are unaffected.
 */
export function isNewCbcsBranchSupported(input: NewCbcsBranchEligibilityInput): boolean {
  const institution = input.institutionName.trim().toLowerCase();
  const programme = input.programmeName.trim().toLowerCase();
  const branch = input.branchName.trim().toLowerCase();
  const branchCode = String(input.branchCode ?? "").trim().toLowerCase();
  const scheme = input.schemeName.trim().toLowerCase();

  const isGeca = institution.includes("government college of engineering") &&
    (institution.includes("chhatrapati sambhajinagar") || institution.includes("aurangabad"));
  const isBtech = programme.includes("bachelor of technology") || /\bb\.?\s*tech\b/.test(programme);
  const isNewCbcs = /^new\s+cbcs(?:\b|$)/.test(scheme);
  const isInformationTechnology = branch === "it" || branchCode === "it" ||
    branch.includes("information technology");

  return !(input.programmePrefix.trim().toUpperCase() === "BE" &&
    isGeca && isBtech && isNewCbcs && !isInformationTechnology);
}
