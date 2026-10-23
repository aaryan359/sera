import jwt from "jsonwebtoken";
import { config } from "../config.ts";

export interface TokenPayload {
  userId: string;
  email: string;
}

export interface GoogleUserInfo {
  email: string;
  name?: string;
  authSubject: string;
  avatarUrl?: string;
}

/**
 * Generate a JWT for an authenticated user
 */
export const signJwtToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
};



/**
 * Verify an application JWT
 */
export const verifyJwtToken = (token: string): TokenPayload | null => {
  try {
    return jwt.verify(token, config.jwtSecret) as TokenPayload;
  } catch (error) {
    return null;
  }
};



/**
 * Verify Google ID Token via Google's tokeninfo endpoint
 */
export const verifyGoogleIdToken = async (idToken: string): Promise<GoogleUserInfo> => {
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
  const response = await fetch(url);

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      error_description?: string;
    };
    throw new Error(errorData.error_description || "Invalid Google ID token");
  }

  const payload = (await response.json()) as {
    sub: string;
    email: string;
    email_verified?: string | boolean;
    name?: string;
    picture?: string;
    aud?: string;
  };

  if (!payload.sub || !payload.email) {
    throw new Error("Google token missing required user details (sub or email)");
  }

  // Validate audience if GOOGLE_CLIENT_ID is configured
  if (config.googleClientId && payload.aud && payload.aud !== config.googleClientId) {
    throw new Error("Google token audience mismatch");
  }

  return {
    email: payload.email,
    authSubject: payload.sub,
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.picture !== undefined ? { avatarUrl: payload.picture } : {}),
  };
};



/**
 * Resolve Google user info from either an idToken or direct input (for dev/test)
 */
export const resolveGoogleUserInfo = async (body?: {
  idToken?: string;
  token?: string;
  credential?: string;
  email?: string;
  name?: string;
  authSubject?: string;
  picture?: string;
  avatarUrl?: string;
}): Promise<GoogleUserInfo> => {
  const safeBody = body || {};
  const token = safeBody.idToken || safeBody.token || safeBody.credential;

  if (token) {
    return await verifyGoogleIdToken(token);
  }

  // Allow direct payload for development/testing if no idToken is supplied
  if (safeBody.email) {
    return {
      email: safeBody.email,
      authSubject: safeBody.authSubject || `google_${safeBody.email}`,
      ...(safeBody.name !== undefined ? { name: safeBody.name } : {}),
      ...((safeBody.avatarUrl || safeBody.picture) !== undefined
        ? { avatarUrl: safeBody.avatarUrl || safeBody.picture }
        : {}),
    };
  }

  throw new Error("Missing credentials. Please send 'Content-Type: application/json' with either an 'idToken' or 'email'.");
};

