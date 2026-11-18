import { OAuth2Client } from "google-auth-library";
import { config } from "../config.ts";
import type { GoogleUserInfo } from "./auth.ts";

export const googleTokenVerifier = new OAuth2Client();

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleUserInfo> {
    
    const ticket = await googleTokenVerifier.verifyIdToken({
        idToken,
        audience: config.googleClientId.trim(),
    });

    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
        throw new Error("Google identity could not be verified");
    }

    return {
        authSubject: payload.sub,
        email: payload.email.toLowerCase(),
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.picture !== undefined ? { avatarUrl: payload.picture } : {}),
    };
}
