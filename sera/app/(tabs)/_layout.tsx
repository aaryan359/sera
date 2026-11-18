import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { theme } from "../../config/theme";
import { useGlassAccessibility } from "../../components/ui/glass";
import { GlassTabBar } from "../../components/glass-tab-bar";

export default function TabsLayout() {
    const { reduceMotion } = useGlassAccessibility();
    return (
        <Tabs
            tabBar={(props) => <GlassTabBar {...props} />}
            screenOptions={{
                headerShown: false,
                lazy: false,
                animation: reduceMotion ? "none" : "shift",
                transitionSpec: { animation: "timing", config: { duration: reduceMotion ? 0 : 180 } },
                tabBarStyle: { position: "absolute" },
                sceneStyle: { backgroundColor: theme.background },
            }}
        >
            <Tabs.Screen
                name="home"
                options={{
                    title: "Home",
                    tabBarIcon: ({ focused, color, size }) => (
                        <Ionicons
                            name={focused ? "home" : "home-outline"}
                            color={typeof color === "string" ? color : theme.muted}
                            size={size}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="assistant"
                options={{
                    title: "Assistant",
                    tabBarIcon: ({ focused, color, size }) => (
                        <Ionicons
                            name={focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"}
                            color={typeof color === "string" ? color : theme.muted}
                            size={size}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="activity"
                options={{
                    title: "Activity",
                    tabBarIcon: ({ focused, color, size }) => (
                        <Ionicons
                            name={focused ? "stats-chart" : "stats-chart-outline"}
                            color={typeof color === "string" ? color : theme.muted}
                            size={size}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: "Settings",
                    sceneStyle: { backgroundColor: theme.settingsBackground },
                    tabBarIcon: ({ focused, color, size }) => (
                        <Ionicons
                            name={focused ? "settings" : "settings-outline"}
                            color={typeof color === "string" ? color : theme.muted}
                            size={size}
                        />
                    ),
                }}
            />
        </Tabs>
    );
}
