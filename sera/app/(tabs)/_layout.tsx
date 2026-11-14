import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { theme } from "../../config/theme";



export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontFamily: "Inter-Medium",
          fontSize: 10,
        },
        sceneStyle: { backgroundColor: theme.background },
      }}
    >
      <Tabs.Screen name="home" options={{
        title: "Home",
        tabBarIcon: ({ focused, size }) => <Ionicons name="home-outline" color={focused ? theme.primary : theme.muted} size={size} />,
      }} />
      <Tabs.Screen name="assistant" options={{
        title: "Assistant",
        tabBarIcon: ({ focused, size }) => <Ionicons name="sparkles-outline" color={focused ? theme.primary : theme.muted} size={size} />,
      }} />
      <Tabs.Screen name="activity" options={{
        title: "Activity",
        tabBarIcon: ({ focused, size }) => <Ionicons name="pulse-outline" color={focused ? theme.primary : theme.muted} size={size} />,
      }} />
      <Tabs.Screen name="settings" options={{
        title: "Settings",
        tabBarIcon: ({ focused, size }) => <Ionicons name="settings-outline" color={focused ? theme.primary : theme.muted} size={size} />,
      }} />
    </Tabs>
  );
}
