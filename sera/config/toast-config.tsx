import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";


import { useEffect, useState } from "react";
import {
    AccessibilityInfo,
    Easing,
    Platform,
    StyleSheet,
    Text,
    UIManager,
    View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useReducedMotion } from "react-native-reanimated";
import Toast, { type ToastConfig, type ToastConfigParams } from "react-native-toast-message";



const nativeGlass = Platform.OS === "ios" && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();


// Expo Go has no Android refraction module. Load it only in a build that includes it.
const AndroidGlass =
    Platform.OS === "android" && UIManager.getViewManagerConfig("LiquidGlassmorphismView")
        ? (
              require("react-native-liquid-glassmorphism") as typeof import("react-native-liquid-glassmorphism")
          ).LiquidGlassView
        : null;


const androidRefraction = AndroidGlass !== null && Number(Platform.Version) >= 33;





const originalColors = {
    success: { background: "#ECFDF3", border: "#12B76A", text: "#067647" },
    error: { background: "#FEF3F2", border: "#F04438", text: "#D92D20" },
    info: { background: "#EEF4FF", border: "#3E7BFA", text: "#3E7BFA" },
    delete: { background: "#FEF3F2", border: "#F04438", text: "#D92D20" },
};

function OriginalToast({ text1, text2, type }: ToastConfigParams<unknown>) {
    const color = originalColors[type as keyof typeof originalColors] || originalColors.info;

    return (
        <View
            style={[styles.original, { backgroundColor: color.background, borderLeftColor: color.border }]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
        >
            {text1 && <Text style={[styles.originalTitle, { color: color.text }]}>{text1}</Text>}
            {text2 && <Text style={[styles.originalDescription, { color: color.text }]}>{text2}</Text>}
        </View>
    );
}

function GlassToast(props: ToastConfigParams<unknown>) {
    const { text1, text2, isVisible } = props;
    const [glassFailed, setGlassFailed] = useState(false);

    const [keepMounted, setKeepMounted] = useState(isVisible);
    const [reduceTransparency, setReduceTransparency] = useState(false);

    useEffect(() => {
        void AccessibilityInfo.isReduceTransparencyEnabled()
            .then(setReduceTransparency)
            .catch(() => {});
        const listener = AccessibilityInfo.addEventListener(
            "reduceTransparencyChanged",
            setReduceTransparency,
        );
        return () => listener.remove();
    }, []);

    useEffect(() => {
        if (isVisible) {
            setKeepMounted(true);
            return;
        }
        // Release the glass renderer after the toast finishes sliding out.
        const timer = setTimeout(() => setKeepMounted(false), 250);
        return () => clearTimeout(timer);
    }, [isVisible]);


    if (reduceTransparency || glassFailed || (!nativeGlass && !androidRefraction)) {
        return <OriginalToast {...props} />;
    }

    if (!isVisible && !keepMounted) return null;



    return (
        <View style={styles.shadow}>
            <View style={styles.capsule} accessibilityRole="alert" accessibilityLiveRegion="polite">
                {AndroidGlass && androidRefraction ? (
                    <AndroidGlass
                        style={StyleSheet.absoluteFill}
                        borderRadius={36}
                        variant="clear"
                        tintColor="rgba(12, 14, 22, 0.28)"
                        blurRadius={6}
                        thickness={1.4}
                        refraction={true}
                        edgeReflectionStrength={0.5}
                        legibilityFloor={0.3}
                        specular={true}
                        tilt={false}
                        paused={!isVisible}
                        pointerEvents="none"
                        onPipelineReady={({ nativeEvent }) => {
                            if (nativeEvent.tier !== "refraction" || !nativeEvent.shaderCompiled) setGlassFailed(true);
                            if (__DEV__)
                                console.info(
                                    "Toast glass renderer:",
                                    nativeEvent.tier,
                                    "shader compiled:",
                                    nativeEvent.shaderCompiled,
                                );
                        }}
                        onError={({ nativeEvent }) => {
                            setGlassFailed(true);
                            if (__DEV__)
                                console.warn("Toast glass:", nativeEvent.code, nativeEvent.message);
                        }}
                    />
                ) : (
                    <GlassView
                        style={StyleSheet.absoluteFill}
                        glassEffectStyle="regular"
                        colorScheme="dark"
                        tintColor="#111114B3"
                        pointerEvents="none"
                    />
                )}
                {!androidRefraction && (
                    <View
                        pointerEvents="none"
                        style={styles.tint}
                    />
                )}
                <View pointerEvents="none" style={styles.rim} />
                {androidRefraction && (
                    <View pointerEvents="none" style={styles.innerRim} />
                )}
                <View style={styles.message}>
                    {text1 && <Text style={styles.title}>{text1}</Text>}
                    {text2 && <Text style={styles.description}>{text2}</Text>}
                </View>
            </View>
        </View>
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
            autoHide={true}
            visibilityTime={3000}
            swipeable={true}
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
    original: {
        width: "90%",
        maxWidth: 430,
        minHeight: 52,
        padding: 12,
        borderLeftWidth: 4,
        borderRadius: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    originalTitle: {
        fontSize: 14,
        fontFamily: "Inter-SemiBold",
        lineHeight: 20,
    },
    originalDescription: {
        fontSize: 13,
        fontFamily: "Inter-Regular",
        lineHeight: 19,
        marginTop: 4,
    },
    shadow: {
        width: "92%",
        maxWidth: 430,
        borderRadius: 36,
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 18,
        elevation: 10,
    },
    capsule: {
        minHeight: 76,
        borderRadius: 36,
        overflow: "hidden",
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingLeft: 24,
        paddingRight: 24,
        gap: 12,
        borderWidth: 1,
        borderColor: "#FFFFFF24",
    },
    tint: {
        ...StyleSheet.absoluteFill,
        backgroundColor: "#08080C80",
    },
    innerRim: {
        ...StyleSheet.absoluteFill,
        borderRadius: 35,
        borderWidth: 1,
        borderTopColor: "#FFFFFF50",
        borderLeftColor: "#FFFFFF28",
        borderBottomColor: "#FFFFFF18",
        borderRightColor: "#FFFFFF28",
    },
    rim: {
        position: "absolute",
        top: 0,
        left: 25,
        right: 25,
        height: 1,
        backgroundColor: "#FFFFFF28",
    },
    message: {
        flex: 1,
        paddingVertical: 1,
    },
    title: {
        color: "#F6F6F8",
        fontSize: 13,
        fontFamily: "Inter-SemiBold",
        lineHeight: 19,
        letterSpacing: -0.15,
    },
    description: {
        color: "#BDBDC7",
        fontSize: 12,
        fontFamily: "Inter-Regular",
        lineHeight: 18,
        marginTop: 3,
    },

});
