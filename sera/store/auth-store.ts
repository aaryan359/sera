import { create } from "zustand";
import type { User } from "../interfaces/user";


type AuthState = {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    setUser: (user: User | null) => void;
    setLoading: (isLoading: boolean) => void;
};


export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    setUser: (user) => set({ user, isAuthenticated: user !== null }),
    setLoading: (isLoading) => set({ isLoading }),
}));





