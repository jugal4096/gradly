import { Request, Response, NextFunction } from "express";
import { verifyTesterToken, TesterTokenPayload } from "../../config/jwt";

export interface TesterAuthenticatedRequest extends Request { tester?: TesterTokenPayload; }

export function authenticateTesterToken(req: TesterAuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ message: "Tester sign-in required." });
  try {
    req.tester = verifyTesterToken(header.slice(7).trim());
    return next();
  } catch {
    return res.status(401).json({ message: "Tester session is invalid or expired." });
  }
}
