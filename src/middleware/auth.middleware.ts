import type { Request, Response, NextFunction } from "express";
import ApiResponse from "../utils/ApiResponse.ts";
import { verifyJwtToken } from "../utils/auth.ts";
import { prisma } from "../db/prisma.ts";



export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string | null;
  authSubject?: string | null;
  timezone: string;
  locale: string;
  avatarUrl?: string | null;
}





export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export const extractToken = (req: Request): string | null => {

  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }


  if (req.headers["x-access-token"]) {
    return String(req.headers["x-access-token"]).trim();
  }

  return null;
};



export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);

    if (!token) {
      ApiResponse.error(res, {
        statusCode: 401,
        message: "Authentication token is required",
        error: "UNAUTHORIZED",
      });
      return;
    }

    const payload = verifyJwtToken(token);

    if (!payload || !payload.userId) {
      ApiResponse.error(res, {
        statusCode: 401,
        message: "Invalid or expired token",
        error: "INVALID_TOKEN",
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        authSubject: true,
        timezone: true,
        locale: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      ApiResponse.error(res, {
        statusCode: 401,
        message: "User not found or account no longer exists",
        error: "USER_NOT_FOUND",
      });
      return;
    }

    req.user = user;
    next();

  } catch (error: any) {
    ApiResponse.error(res, {
      statusCode: 500,
      message: "Error verifying authentication",
      error: error.message || "INTERNAL_AUTH_ERROR",
    });
  }
};
