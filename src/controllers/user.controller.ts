import type { Request, Response } from "express";
import { prisma } from "../db/prisma.ts";
import ApiResponse from "../utils/ApiResponse.ts";

import type { AuthenticatedRequest } from "../middleware/auth.middleware.ts";
import { z } from "zod";
import { config } from "../config.ts";
import { verifyGoogleIdToken } from "../utils/google-auth.ts";
import { signJwtToken, type GoogleUserInfo } from "../utils/auth.ts";
import { Prisma } from "@prisma/client";



export class UserController {

    
    static async authenticate(req: Request, res: Response) {

        console.log("Authenticating user with Google ID token...");
        
        res.set("Cache-Control", "no-store");

        const parsed = z.object({
            idToken: z.string().trim().min(1).max(20_000),
        }).safeParse(req.body);

        if (!parsed.success) {
            ApiResponse.error(res, {
                statusCode: 400,
                message: "A Google ID token is required",
                error: "INVALID_ID_TOKEN",
            });
            return;
        }

        if (!config.googleClientId.trim()) {
            ApiResponse.error(res, {
                statusCode: 500,
                message: "Google login is not configured",
                error: "GOOGLE_AUTH_NOT_CONFIGURED",
            });
            return;
        }

        let googleUser: GoogleUserInfo;

        try {
            googleUser = await verifyGoogleIdToken(parsed.data.idToken);
        } catch {
            ApiResponse.error(res, {
                statusCode: 401,
                message: "Google token is invalid or expired. Please sign in again.",
                error: "GOOGLE_AUTH_FAILED",
            });
            return;
        }

        try {
            // Google sub is the stable identity; do not silently link accounts by email.
            const user = await prisma.user.upsert({
                where: { authSubject: googleUser.authSubject },
                create: {
                    authSubject: googleUser.authSubject,
                    email: googleUser.email,
                    name: googleUser.name ?? null,
                    avatarUrl: googleUser.avatarUrl ?? null,
                },
                update: {
                    email: googleUser.email,
                    ...(googleUser.name !== undefined ? { name: googleUser.name } : {}),
                    ...(googleUser.avatarUrl !== undefined ? { avatarUrl: googleUser.avatarUrl } : {}),
                },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    avatarUrl: true,
                    timezone: true,
                    locale: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });

            const token = signJwtToken({ userId: user.id, email: user.email });

            ApiResponse.success(res, {
                message: "Signed in with Google",
                data: { user, token },
            });
            
        } catch (error) {
            const conflict = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
            ApiResponse.error(res, {
                statusCode: conflict ? 409 : 500,
                message: conflict ? "This email is already linked to another account" : "Unable to complete sign-in",
                error: conflict ? "ACCOUNT_CONFLICT" : "GOOGLE_LOGIN_ERROR",
            });
        }
    }



    static async checkAuth(req: AuthenticatedRequest, res: Response) {
        try {
            const userId = req.user?.id;

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
    }
}
