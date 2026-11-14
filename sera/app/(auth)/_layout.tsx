import { Stack } from "expo-router";
import { theme } from "../../config/theme";



export default function AuthLayout() {
  return (
    <Stack screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: theme.lavender },
    }} />
  );
}