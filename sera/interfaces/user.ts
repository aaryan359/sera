export type User = {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    timezone: string;
    locale: string;
};

export type AuthResponse = {
    success: boolean;
    data: { user: User; token: string };
};
