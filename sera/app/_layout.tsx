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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

SplashScreen.preventAutoHideAsync();



function AppContent() {
    const insets = useSafeAreaInsets();
    
    const isAuthenticated = false; // Replace with your actual authentication logic

    // useEffect(() => {
    // 	configureGoogleSignIn();
    // 	dispatch(checkAuth());
    // }, [dispatch]);

    const [fontsLoaded, fontError] = useFonts({
        "Inter-Regular": Inter_400Regular,
        "Inter-Medium": Inter_500Medium,
        "Inter-SemiBold": Inter_600SemiBold,
        "Inter-Bold": Inter_700Bold,
    });

    useEffect(() => {
        if (fontsLoaded || fontError) {
            SplashScreen.hideAsync();
        }
    }, [fontsLoaded, fontError]);

    if (!fontsLoaded && !fontError) {
        return null;
    }

    return (
        <View style={{ flex: 1 }}>
            <Stack
                key={isAuthenticated ? "authed" : "guest"}
                screenOptions={{ headerShown: false }}
            >
                {isAuthenticated ? (
                    <Stack.Screen name="(tabs)" />
                ) : (
                    <Stack.Screen name="(auth)" />
                )}

            </Stack>
            
            <AppToast />
        </View>
    );
}

export default function RootLayout() {
    
    return <AppContent />;
}
