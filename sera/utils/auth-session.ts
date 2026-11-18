import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { AuthService } from "../api/auth";
import { useAuthStore } from "../store/auth-store";

let restoring: Promise<void> | undefined;


export function restoreSession() {

    if (restoring) return restoring;

    restoring = (async () => {
        try {
            const token = await SecureStore.getItemAsync("authToken");

            if (token) {
                const response = await AuthService.checkAuth();
                useAuthStore.getState().setUser(response.data.user);
                useAuthStore.getState().setLoading(false);
            }
        } catch (error) {
            // Preserve the saved session on temporary network/server failures.
            if (axios.isAxiosError(error) && [401, 403, 404].includes(error.response?.status || 0)) {
                await SecureStore.deleteItemAsync("authToken");
            }
            useAuthStore.getState().setUser(null);
        } finally {
            useAuthStore.getState().setLoading(false);
        }
    })();
    return restoring;
}

