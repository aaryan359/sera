import { requireOptionalNativeModule } from "expo";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
    AccessibilityInfo,
    Platform,
    StyleSheet,
    View,
    type StyleProp,
    type ViewProps,
    type ViewStyle,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";

// Older development builds can still open while the new native binary is building.
/* eslint-disable @typescript-eslint/no-require-imports -- Native views must load only when included in this binary. */
export const androidGlass =
    Platform.OS === "android" && requireOptionalNativeModule("SeraGlass")
        ? (require("../../modules/sera-glass") as typeof import("../../modules/sera-glass"))
        : null;
/* eslint-enable @typescript-eslint/no-require-imports */
const iosGlass = Platform.OS === "ios" && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
type Tone = "light" | "dark";
const AccessibilityContext = createContext({ reduceTransparency: false, reduceMotion: false });

export function GlassProvider({ children }: { children: ReactNode }) {
    const [reduceTransparency, setReduceTransparency] = useState(false);
    const reduceMotion = useReducedMotion();
    useEffect(() => {
        let active = true;
        void AccessibilityInfo.isReduceTransparencyEnabled()
            .then((value) => {
                if (active) setReduceTransparency(value);
            })
            .catch(() => {});
        const listener = AccessibilityInfo.addEventListener(
            "reduceTransparencyChanged",
            setReduceTransparency,
        );
        return () => {
            active = false;
            listener.remove();
        };
    }, []);
    return (
        <AccessibilityContext.Provider value={{ reduceTransparency, reduceMotion }}>
            {children}
        </AccessibilityContext.Provider>
    );
}

export const useGlassAccessibility = () => useContext(AccessibilityContext);

// Opaque backgrounds and painted gradients would hide the real backdrop shader.
function transparentStyle(style: StyleProp<ViewStyle>) {
    const flat = { ...StyleSheet.flatten(style) };
    delete flat.backgroundColor;
    delete flat.backgroundImage;
    delete flat.boxShadow;
    delete flat.elevation;
    delete flat.shadowColor;
    delete flat.shadowOffset;
    delete flat.shadowOpacity;
    delete flat.shadowRadius;
    return flat;
}

export function GlassSurface({
    tone = "light",
    cornerRadius,
    style,
    children,
    ...props
}: ViewProps & { tone?: Tone; cornerRadius?: number }) {
    const { reduceTransparency } = useGlassAccessibility();
    const shape = transparentStyle(style);
    const radius =
        cornerRadius ?? (typeof shape.borderRadius === "number" ? shape.borderRadius : 24);
    const opaque = tone === "dark" ? "#20232D" : "#F5F7FC";
    if (reduceTransparency)
        return (
            <View {...props} style={[shape, { borderRadius: radius, backgroundColor: opaque }]}>
                {children}
            </View>
        );
    if (androidGlass)
        return (
            <androidGlass.AndroidGlassView
                {...props}
                cornerRadius={radius}
                blurRadius={3}
                refractionHeight={12}
                refractionAmount={24}
                chromaticAberration
                shadow={false}
                surfaceColor={"rgba(255,255,255,0.03)"}
                fallbackColor={tone === "dark" ? "rgba(30,33,45,0.94)" : "rgba(255,255,255,0.82)"}
                style={[shape, { borderRadius: radius }]}
            >
                {children}
            </androidGlass.AndroidGlassView>
        );
    if (iosGlass)
        return (
            <GlassView
                {...props}
                glassEffectStyle="regular"
                colorScheme={tone}
                style={[shape, { borderRadius: radius }]}
            >
                {children}
            </GlassView>
        );
    return (
        <View
            {...props}
            style={[
                shape,
                {
                    borderRadius: radius,
                    backgroundColor:
                        tone === "dark" ? "rgba(30,33,45,0.94)" : "rgba(255,255,255,0.82)",
                },
            ]}
        >
            {children}
        </View>
    );
}
