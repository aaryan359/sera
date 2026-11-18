import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { theme } from "../../config/theme";
import { GlassTabBar } from "../../components/glass-tab-bar";



export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.background },
      }}
    >
      <Tabs.Screen name="home" options={{
        title: "Home",
        tabBarIcon: ({ focused, color, size }) => <Ionicons name={focused ? "home" : "home-outline"} color={typeof color === "string" ? color : theme.muted} size={size} />,
      }} />
      <Tabs.Screen name="assistant" options={{
        title: "Assistant",
        tabBarIcon: ({ focused, color, size }) => <Ionicons name={focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"} color={typeof color === "string" ? color : theme.muted} size={size} />,
      }} />
      <Tabs.Screen name="activity" options={{
        title: "Activity",
        tabBarIcon: ({ focused, color, size }) => <Ionicons name={focused ? "stats-chart" : "stats-chart-outline"} color={typeof color === "string" ? color : theme.muted} size={size} />,
      }} />
      <Tabs.Screen name="settings" options={{
        title: "Settings",
        tabBarIcon: ({ focused, color, size }) => <Ionicons name={focused ? "settings" : "settings-outline"} color={typeof color === "string" ? color : theme.muted} size={size} />,
      }} />
    </Tabs>
  );
}
