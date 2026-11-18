import apiClient from "../config/client";
import type { AuthResponse } from "../interfaces/user";


export const AuthService = {
    async authenticate(idToken: string) {
        const response = await apiClient.post("/api/v1/auth/authenticate", { idToken });
        return response.data;
    },

    async checkAuth() {
        const response = await apiClient.get("/api/v1/auth/check-auth");
        return response.data;
    },
};
