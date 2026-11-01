import type { Request, Response } from "express";

/**
 * This legacy setup-token route has no backing token storage or validator in
 * the current schema. Fail closed instead of exposing a broken credential
 * setup path. The supported flow is authenticated admin registration.
 */
export async function validateAdminSetup(
  _req: Request,
  res: Response
) {
  return res.status(410).json({
    valid: false,
    message: "This legacy setup-token endpoint is no longer supported. Sign in and use the approved admin registration flow.",
  });
}

export async function completeAdminSetup(
  _req: Request,
  res: Response
) {
  return res.status(410).json({
    message: "This legacy setup-token endpoint is no longer supported. Sign in and use the approved admin registration flow.",
  });
}
