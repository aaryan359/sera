import type { Request, Response } from "express";
import { prisma } from "../db/prisma.ts";
import ApiResponse from "../utils/ApiResponse.ts";
import { resolveGoogleUserInfo, signJwtToken, verifyJwtToken } from "../utils/auth.ts";
import { extractToken, type AuthenticatedRequest } from "../middleware/auth.middleware.ts";




/**
 * Helper to resolve the authenticated user ID from either req.user or the Authorization header
 */
const getAuthenticatedUserId = (req: Request): string | null => {
  const authReq = req as AuthenticatedRequest;
  if (authReq.user?.id) {
    return authReq.user.id;
  }

  const token = extractToken(req);
  if (!token) {
    return null;
  }

  const payload = verifyJwtToken(token);
  return payload?.userId || null;
};









// Register a new user via Google OAuth
export const RegisterUser = async (req: Request, res: Response): Promise<void> => {
  try {


    const body = req.body || {};
    const googleUser = await resolveGoogleUserInfo(body);

    // Check if user already exists with this email or Google subject
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { authSubject: googleUser.authSubject },
          { email: googleUser.email },
        ],
      },
    });

    if (existingUser) {
      ApiResponse.error(res, {
        statusCode: 409,
        message: "User with this email is already registered. Please log in.",
        error: "USER_ALREADY_EXISTS",
      });
      return;
    }

    const { timezone, locale } = body;

    const newUser = await prisma.user.create({
      data: {
        email: googleUser.email,
        name: googleUser.name || null,
        authSubject: googleUser.authSubject,
        avatarUrl: googleUser.avatarUrl || null,
        timezone: timezone || "UTC",
        locale: locale || "en",
      },
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

    const token = signJwtToken({
      userId: newUser.id,
      email: newUser.email,
    });

    ApiResponse.success(res, {
      statusCode: 201,
      message: "User registered successfully with Google",
      data: {
        user: newUser,
        token,
      },
    });
  } catch (error: any) {
    ApiResponse.error(res, {
      statusCode: 400,
      message: error.message || "Failed to register user with Google",
      error: error.message || "GOOGLE_REGISTER_ERROR",
    });
  }
};

/**
 * Login user via Google OAuth
 */
export const Login = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body || {};
    const googleUser = await resolveGoogleUserInfo(body);

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { authSubject: googleUser.authSubject },
          { email: googleUser.email },
        ],
      },
    });

    if (!user) {
      ApiResponse.error(res, {
        statusCode: 404,
        message: "No user found with this Google account. Please register first.",
        error: "USER_NOT_FOUND",
      });
      return;
    }

    // Keep authSubject and profile picture updated if Google provided them
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        authSubject: user.authSubject || googleUser.authSubject || "",
        avatarUrl: googleUser.avatarUrl || user.avatarUrl || "",
        ...(user.name || googleUser.name ? { name: user.name || googleUser.name } : {}),
      },
    });

    const token = signJwtToken({
      userId: user.id,
      email: user.email,
    });

    const { id, email, name, authSubject, timezone, locale, avatarUrl, createdAt, updatedAt } = user;

    ApiResponse.success(res, {
      statusCode: 200,
      message: "User logged in successfully with Google",
      data: {
        user: { id, email, name, authSubject, timezone, locale, avatarUrl, createdAt, updatedAt },
        token,
      },
    });
  } catch (error: any) {
    ApiResponse.error(res, {
      statusCode: 400,
      message: error.message || "Failed to login with Google",
      error: error.message || "GOOGLE_LOGIN_ERROR",
    });
  }
};

/**
 * Update user profile details (name, timezone, locale)
 */
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      ApiResponse.error(res, {
        statusCode: 401,
        message: "Unauthorized: Missing or invalid authentication token",
        error: "UNAUTHORIZED",
      });
      return;
    }

    const body = req.body || {};
    const { name, timezone, locale } = body;

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      ApiResponse.error(res, {
        statusCode: 404,
        message: "User not found",
        error: "USER_NOT_FOUND",
      });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(timezone !== undefined ? { timezone } : {}),
        ...(locale !== undefined ? { locale } : {}),
      },
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

    ApiResponse.success(res, {
      statusCode: 200,
      message: "User profile updated successfully",
      data: {
        user: updatedUser,
      },
    });
  } catch (error: any) {
    ApiResponse.error(res, {
      statusCode: 500,
      message: "Failed to update user profile",
      error: error.message || "UPDATE_USER_ERROR",
    });
  }
};

/**
 * Update user profile picture
 */
export const updateProfilePicture = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      ApiResponse.error(res, {
        statusCode: 401,
        message: "Unauthorized: Missing or invalid authentication token",
        error: "UNAUTHORIZED",
      });
      return;
    }

    const body = req.body || {};
    const avatarUrl = body.avatarUrl || body.picture || body.profilePicture;

    if (!avatarUrl || typeof avatarUrl !== "string") {
      ApiResponse.error(res, {
        statusCode: 400,
        message: "A valid avatarUrl or picture URL is required",
        error: "INVALID_PICTURE_URL",
      });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        avatarUrl,
      },
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

    ApiResponse.success(res, {
      statusCode: 200,
      message: "Profile picture updated successfully",
      data: {
        user: updatedUser,
      },
    });
  } catch (error: any) {
    ApiResponse.error(res, {
      statusCode: 500,
      message: "Failed to update profile picture",
      error: error.message || "UPDATE_PICTURE_ERROR",
    });
  }
};

/**
 * Check authentication status and return current user details
 */
export const checkAuth = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      ApiResponse.error(res, {
        statusCode: 401,
        message: "Unauthorized: Invalid or missing token",
        error: "UNAUTHORIZED",
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
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
        statusCode: 404,
        message: "User account not found",
        error: "USER_NOT_FOUND",
      });
      return;
    }

    ApiResponse.success(res, {
      statusCode: 200,
      message: "User is authenticated",
      data: {
        user,
      },
    });
  } catch (error: any) {
    ApiResponse.error(res, {
      statusCode: 500,
      message: "Failed to verify authentication",
      error: error.message || "CHECK_AUTH_ERROR",
    });
  }
};
