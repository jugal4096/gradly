import { Request, Response } from "express";

import { authenticateAdmin } from "./admin.service";

import {
  LoginLockedError,
} from "../auth-security/login-security.service";

export async function loginAdmin(
  req: Request,
  res: Response
) {
  try {
    const {
      adminCode,
      password,
      deviceFingerprint,
    } = req.body;

    if (
      typeof adminCode !== "string" ||
      typeof password !== "string" ||
      !adminCode.trim() ||
      !password
    ) {
      return res.status(400).json({
        message:
          "Admin ID and password are required.",
      });
    }

    const result = await authenticateAdmin(
      adminCode.trim(),
      password,
      {
        ipAddress:
          req.ip ||
          req.socket.remoteAddress ||
          null,

        userAgent:
          req.get("user-agent") || null,

        /*
         * We are accepting the value for now.
         *
         * We will replace this with a server-side
         * HMAC-based device identifier later.
         */
        deviceFingerprintHash:
          typeof deviceFingerprint === "string"
            ? deviceFingerprint
            : null,
      }
    );

    return res.status(200).json({
      message: "Admin login successful.",
      ...result,
    });
  } catch (error) {
    console.error(
      "Admin login failed:",
      error
    );

    if (error instanceof LoginLockedError) {
      return res.status(423).json({
        message:
          "Too many unsuccessful login attempts. Your admin account is temporarily locked.",
        lockedUntil:
          error.lockedUntil.toISOString(),
      });
    }

    return res.status(401).json({
      message:
        "Invalid admin credentials.",
    });
  }
}