import { Redirect } from "expo-router";
import { useAuthStore } from "../store/auth-store";
import { previewTabs } from "../config/development";


export default function IndexScreen() {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    return <Redirect href={previewTabs || isAuthenticated ? "/(tabs)/home" : "/(auth)"} />;
}

