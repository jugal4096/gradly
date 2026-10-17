import { Request, Response } from "express";

import {
  setupAdminCredentials,
  validateAdminSetupToken,
} from "./admin-application.service";


/* =========================================================
   VALIDATE SETUP TOKEN
   ========================================================= */

export async function validateAdminSetup(
  req: Request,
  res: Response
) {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        message: "Admin setup token is required.",
      });
    }

    const setup =
      await validateAdminSetupToken(token);

    return res.status(200).json({
      valid: true,
      setup,
    });
  } catch (error) {
    console.error(
      "Admin setup token validation failed:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Invalid or expired admin setup token.";

    return res.status(400).json({
      valid: false,
      message,
    });
  }
}


/* =========================================================
   COMPLETE ADMIN ACCOUNT SETUP
   ========================================================= */

export async function completeAdminSetup(
  req: Request,
  res: Response
) {
  try {
    const {
      token,
      adminUsername,
      password,
    } = req.body;

    if (
      typeof token !== "string" ||
      !token.trim()
    ) {
      return res.status(400).json({
        message:
          "Admin setup token is required.",
      });
    }

    if (
      typeof adminUsername !== "string" ||
      !adminUsername.trim()
    ) {
      return res.status(400).json({
        message:
          "Admin username is required.",
      });
    }

    if (
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        message:
          "Admin password is required.",
      });
    }

    const admin =
      await setupAdminCredentials(
        token,
        adminUsername,
        password
      );

    return res.status(200).json({
      message:
        "Admin account setup completed successfully.",
      admin,
    });
  } catch (error) {
    console.error(
      "Admin account setup failed:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Failed to complete admin account setup.";

    if (
      message.includes("username") ||
      message.includes("password") ||
      message.includes("token") ||
      message.includes("setup link") ||
      message.includes("activate")
    ) {
      return res.status(400).json({
        message,
      });
    }

    return res.status(500).json({
      message:
        "Failed to complete admin account setup.",
    });
  }
}