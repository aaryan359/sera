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
export const signJwtToken = (payload: TokenPayload) => {
    return jwt.sign(payload, config.jwtSecret, {
        expiresIn: config.jwtExpiresIn,
    } as jwt.SignOptions);
};




/**
 * Verify an application JWT
 */
export const verifyJwtToken = (token: string) => {
    try {
        return jwt.verify(token, config.jwtSecret) as TokenPayload;
    } catch (error) {
        return null;
    }
};


