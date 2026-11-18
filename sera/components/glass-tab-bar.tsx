import { useContext } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from "expo-router/js-tabs";
import { androidGlass, GlassSurface, useGlassAccessibility } from "./ui/glass";
import { useKeyboardVisible } from "../hooks/useKeyboardVisible";

export function GlassTabBar({
    state,
    descriptors,
    emitter,
    navigateToTab,
    insets,
}: BottomTabBarProps) {
    const onHeightChange = useContext(BottomTabBarHeightCallbackContext);
    const keyboardVisible = useKeyboardVisible();
    const { reduceTransparency, reduceMotion } = useGlassAccessibility();
    const NativeTabs = androidGlass?.AndroidGlassBottomTabs;
    const NativeTab = androidGlass?.AndroidGlassTab;

    function selectTab(index: number) {
        const route = state.routes[index];
        if (!route) return;
        const event = emitter.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
        });
        if (index !== state.index && !event.defaultPrevented) navigateToTab(route.key);
    }

    if (keyboardVisible) return null;
    return (
        <View
            pointerEvents="box-none"
            onLayout={({ nativeEvent }) => onHeightChange?.(nativeEvent.layout.height)}
            style={[
                styles.dock,
                {
                    paddingBottom: Math.max(insets.bottom, 12),
                    paddingLeft: insets.left + 18,
                    paddingRight: insets.right + 18,
                },
            ]}
        >
            {NativeTabs && NativeTab && !reduceTransparency && !reduceMotion ? (
                <NativeTabs
                    blurRadius={3}
                    refractionHeight={12}
                    refractionAmount={24}
                    chromaticAberration
                    shadow={false}
                    selectedIndex={state.index}
                    onTabSelected={selectTab}
                    accentColor="#686CD6"
                    surfaceColor="rgba(255,255,255,0.03)"
                    style={styles.bar}
                >
                    {state.routes.map((route, index) => {
                        const { options } = descriptors[route.key];
                        return (
                            <NativeTab
                                key={route.key}
                                label={
                                    typeof options.tabBarLabel === "string"
                                        ? options.tabBarLabel
                                        : (options.title ?? route.name)
                                }
                                labelStyle={styles.label}
                                icon={options.tabBarIcon?.({
                                    focused: index === state.index,
                                    color: index === state.index ? "#686CD6" : "#585A70",
                                    size: 22,
                                })}
                            />
                        );
                    })}
                </NativeTabs>
            ) : (
                <GlassSurface cornerRadius={36} style={[styles.bar, styles.fallback]}>
                    {state.routes.map((route, index) => {
                        const { options } = descriptors[route.key];
                        return (
                            <Pressable
                                key={route.key}
                                accessibilityRole="tab"
                                accessibilityState={{ selected: index === state.index }}
                                accessibilityLabel={
                                    options.tabBarAccessibilityLabel ?? options.title ?? route.name
                                }
                                testID={options.tabBarButtonTestID}
                                onPress={() => selectTab(index)}
                                onLongPress={() =>
                                    emitter.emit({ type: "tabLongPress", target: route.key })
                                }
                                style={[styles.tab, index === state.index && styles.selected]}
                            >
                                {options.tabBarIcon?.({
                                    focused: index === state.index,
                                    color: index === state.index ? "#686CD6" : "#585A70",
                                    size: 22,
                                })}
                                <Text style={styles.label}>
                                    {typeof options.tabBarLabel === "string"
                                        ? options.tabBarLabel
                                        : (options.title ?? route.name)}
                                </Text>
                            </Pressable>
                        );
                    })}
                </GlassSurface>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    dock: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingTop: 10,
        alignItems: "center",
    },
    bar: { width: "100%", maxWidth: 440, height: 64 },
    fallback: { flexDirection: "row", padding: 5, gap: 3 },
    tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, borderRadius: 30 },
    selected: { backgroundColor: "rgba(172,180,255,0.25)" },
    label: { fontFamily: "Inter-Medium", fontSize: 10, color: "#585A70" },
});
