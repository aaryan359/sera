import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { theme } from "../../config/theme";
import { SeraLogo } from "../../components/sera-logo";
import { useAuth } from "../../hooks/useAuth";


export default function AuthScreen() {

    const { signInWithGoogle, isSigningIn, error } = useAuth();

    useEffect(() => {
        if (!error) return;

        Toast.show({
            type: "error",
            text1: "Couldn't complete sign-in",
            text2: error,
        });
    }, [error]);

    const handleGoogleSignIn = async () => {
        const result = await signInWithGoogle();
        if (!result) return;

        Toast.show({
            type: "success",
            text1: "Signed in",
        });
    };

    return (
        <SafeAreaView style={styles.screen}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.hero}>
                    <View style={styles.symbol}>
                        <SeraLogo width={156} />
                    </View>
                    <Text style={styles.eyebrow}>A LITTLE SPACE FOR YOU</Text>
                    <Text style={styles.title}>Less on your mind.{"\n"}More to your day.</Text>
                    <Text style={styles.subtitle}>
                        Your personal AI assistant, here to help{"\n"}with the things that matter.
                    </Text>
                </View>

                <View style={styles.footer}>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ disabled: isSigningIn, busy: isSigningIn }}
                        disabled={isSigningIn}
                        onPress={handleGoogleSignIn}
                        style={({ pressed }) => [styles.button, { opacity: pressed || isSigningIn ? 0.75 : 1 }]}
                    >
                        {isSigningIn ? (
                            <ActivityIndicator size="small" color={theme.text} />
                        ) : (
                            <Ionicons name="logo-google" size={20} color={theme.text} />
                        )}
                        <Text style={styles.buttonText}>{isSigningIn ? "Connecting…" : "Continue with Google"}</Text>
                    </Pressable>
                    <Text style={styles.caption}>
                        New here? Your account will be created automatically.
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: theme.lavender,
    },
    content: {
        flexGrow: 1,
        padding: 28,
    },
    hero: {
        flex: 1,
        justifyContent: "center",
        paddingVertical: 48,
    },
    symbol: {
        alignItems: "flex-start",
        marginBottom: 38,
    },
    eyebrow: {
        fontFamily: "Inter-Medium",
        fontSize: 10,
        letterSpacing: 2,
        color: theme.muted,
        marginBottom: 18,
    },
    title: {
        fontFamily: "Inter-Bold",
        fontSize: 34,
        lineHeight: 44,
        letterSpacing: -1.2,
        color: theme.text,
    },
    subtitle: {
        fontFamily: "Inter-Regular",
        fontSize: 14,
        lineHeight: 24,
        color: theme.muted,
        marginTop: 18,
    },
    footer: {
        paddingBottom: 16,
    },
    button: {
        minHeight: 58,
        paddingHorizontal: 20,
        paddingVertical: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 22,
    },
    buttonText: {
        fontFamily: "Inter-Medium",
        fontSize: 14,
        color: theme.text,
    },
    caption: {
        fontFamily: "Inter-Regular",
        fontSize: 11,
        lineHeight: 19,
        color: theme.muted,
        textAlign: "center",
        marginTop: 18,
    },
});
