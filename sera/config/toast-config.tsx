import { useEffect, useState } from "react";
import { Easing, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import Toast, { type ToastConfig, type ToastConfigParams } from "react-native-toast-message";
import { GlassSurface } from "../components/ui/glass";
import { SettingsIcon, type SettingsIconName } from "../components/settings-icon";

const toastIcons: Record<string, SettingsIconName> = {
    success: "completed",
    error: "info",
    info: "notifications",
    delete: "reset",
};

function GlassToast({ text1, text2, type, isVisible }: ToastConfigParams<unknown>) {
    const [mounted, setMounted] = useState(isVisible);
    useEffect(() => {
        if (isVisible) {
            setMounted(true);
            return;
        }
        // Release the native capture after the toast's exit animation.
        const timer = setTimeout(() => setMounted(false), 230);
        return () => clearTimeout(timer);
    }, [isVisible]);
    if (!isVisible && !mounted) return null;
    return (
        <GlassSurface
            cornerRadius={30}
            style={styles.toast}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
        >
            <SettingsIcon
                name={toastIcons[type] ?? "info"}
                size={23}
                color={type === "error" ? "#B84759" : "#686CD6"}
            />
            <View style={styles.message}>
                {text1 && <Text style={styles.title}>{text1}</Text>}
                {text2 && <Text style={styles.description}>{text2}</Text>}
            </View>
        </GlassSurface>
    );
}

export const toastConfig: ToastConfig = {
    success: (props) => <GlassToast {...props} />,
    error: (props) => <GlassToast {...props} />,
    info: (props) => <GlassToast {...props} />,
    delete: (props) => <GlassToast {...props} />,
};

export function AppToast() {
    const insets = useSafeAreaInsets();
    const reduceMotion = useReducedMotion();
    return (
        <Toast
            config={toastConfig}
            position="top"
            topOffset={insets.top + 10}
            bottomOffset={insets.bottom + 10}
            autoHide
            visibilityTime={3000}
            swipeable
            animationConfig={{
                enter: {
                    type: "timing",
                    duration: reduceMotion ? 0 : 350,
                    easing: Easing.out(Easing.cubic),
                },
                exit: {
                    type: "timing",
                    duration: reduceMotion ? 0 : 230,
                    easing: Easing.in(Easing.quad),
                },
            }}
        />
    );
}

const styles = StyleSheet.create({
    toast: {
        width: "92%",
        maxWidth: 430,
        minHeight: 68,
        paddingHorizontal: 21,
        paddingVertical: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    message: { flex: 1 },
    title: { color: "#262638", fontSize: 13, fontFamily: "Inter-SemiBold", lineHeight: 19 },
    description: {
        color: "#53536A",
        fontSize: 12,
        fontFamily: "Inter-Regular",
        lineHeight: 18,
        marginTop: 3,
    },
});
