import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabBarProps } from "expo-router/js-tabs";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { theme } from "../config/theme";


export function GlassTabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
    const [width, setWidth] = useState(0);
    const selected = useSharedValue(state.index);
    const tabWidth = width / state.routes.length;
    const activeOptions = descriptors[state.routes[state.index].key].options;
    const backgroundColor = StyleSheet.flatten(activeOptions.sceneStyle)?.backgroundColor ?? theme.background;

    useEffect(() => {
        selected.value = withTiming(state.index, {
            duration: 250,
            easing: Easing.out(Easing.cubic),
            reduceMotion: ReduceMotion.System,
        });
    }, [state.index, selected]);

    const capsuleStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: selected.value * tabWidth + 2 }],
    }));

    return (
        <View style={[styles.dock, {
            backgroundColor,
            paddingBottom: Math.max(insets.bottom, 12),
            paddingLeft: insets.left + 18,
            paddingRight: insets.right + 18,
        }]}>
            <View style={styles.glass}>
                <View
                    role="tablist"
                    style={styles.tabs}
                    onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}
                >
                    {width > 0 && (
                        <Animated.View
                            pointerEvents="none"
                            style={[styles.capsule, { width: tabWidth - 4 }, capsuleStyle]}
                        >
                            <View style={styles.reflection} />
                        </Animated.View>
                    )}
                    {state.routes.map((route, index) => {
                        const { options } = descriptors[route.key];
                        const focused = state.index === index;
                        const color = focused ? "#6871D9" : "#9293A3";
                        const label = typeof options.tabBarLabel === "string"
                            ? options.tabBarLabel : options.title ?? route.name;

                        return (
                            <Pressable
                                key={route.key}
                                role="tab"
                                accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                                accessibilityState={{ selected: focused }}
                                testID={options.tabBarButtonTestID}
                                onPress={() => {
                                    const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                                    if (!focused && !event.defaultPrevented) navigateToTab(route.key);
                                }}
                                onLongPress={() => emitter.emit({ type: "tabLongPress", target: route.key })}
                                style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.65 : 1 }]}
                            >
                                {options.tabBarIcon?.({ focused, color, size: 22 })}
                                <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[styles.label, { color }]}>
                                    {label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    dock: {
        alignItems: "center",
        paddingTop: 10,
    },
    glass: {
        width: "100%",
        maxWidth: 440,
        padding: 6,
        borderRadius: 38,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.95)",
        backgroundColor: "rgba(255,255,255,0.86)",
        backgroundImage: "linear-gradient(150deg, rgba(255,255,255,0.98), rgba(245,245,255,0.82) 60%, rgba(235,236,251,0.88))",
        boxShadow: "0 6px 24px rgba(43,45,90,0.08), inset 0 1px 0 rgba(255,255,255,0.95)",
    },
    tabs: {
        height: 58,
        flexDirection: "row",
    },
    capsule: {
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        borderRadius: 29,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.94)",
        borderBottomColor: "rgba(174,183,235,0.35)",
        backgroundColor: "rgba(211,217,255,0.5)",
        backgroundImage: "linear-gradient(150deg, rgba(255,255,255,0.92), rgba(221,226,255,0.55) 48%, rgba(198,207,255,0.6))",
        boxShadow: "0 2px 7px rgba(100,111,190,0.12), inset 0 1px 1px rgba(255,255,255,0.95)",
    },
    reflection: {
        position: "absolute",
        top: 1,
        left: 14,
        right: 14,
        height: 1,
        backgroundColor: "rgba(255,255,255,0.9)",
        borderRadius: 1,
    },
    tab: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        paddingHorizontal: 2,
    },
    label: {
        fontFamily: "Inter-Medium",
        fontSize: 10,
        lineHeight: 14,
    },
});
