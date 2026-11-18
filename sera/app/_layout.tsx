import { Stack } from "expo-router";
import {
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
} from "@expo-google-fonts/inter";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { View } from "react-native";
import { AppToast } from "../config/toast-config";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../config/query-client";
import { useAuthStore } from "../store/auth-store";
import { restoreSession } from "../utils/auth-session";
import { previewTabs } from "../config/development";


SplashScreen.preventAutoHideAsync();


function AppContent() {


    const isAuthenticated = useAuthStore((state)=> ( state.isAuthenticated));
    const isLoading = useAuthStore((state)=> ( state.isLoading)) && !previewTabs;
    const showTabs = previewTabs || isAuthenticated;
    
    const [fontsLoaded, fontError] = useFonts({
        "Inter-Regular": Inter_400Regular,
        "Inter-Medium": Inter_500Medium,
        "Inter-SemiBold": Inter_600SemiBold,
        "Inter-Bold": Inter_700Bold,
    });

    useEffect(() => {
        if (!previewTabs) void restoreSession();
    }, []);

    useEffect(() => {
        if ((fontsLoaded || fontError) && !isLoading) {
            SplashScreen.hideAsync();
        }
    }, [fontsLoaded, fontError, isLoading]);

    if ((!fontsLoaded && !fontError) || isLoading) {
        return null;
    }

    return (
        <View style={{ flex: 1 }}>
            <Stack
                screenOptions={{ headerShown: false }}
            >
                <Stack.Screen name="index" />
                {/* Avoid routing auth changes through the redirecting index screen. */}
                <Stack.Protected guard={showTabs} redirectTo="/(auth)">
                    <Stack.Screen name="(tabs)" />
                </Stack.Protected>
                <Stack.Protected guard={!showTabs} redirectTo="/(tabs)/home">
                    <Stack.Screen name="(auth)" />
                </Stack.Protected>

            </Stack>
            
            <AppToast />
        </View>
    );
}

export default function RootLayout() {
    
    return <QueryClientProvider client={queryClient}><AppContent /></QueryClientProvider>;
}
