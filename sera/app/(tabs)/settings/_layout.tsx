import { Stack } from "expo-router";
import { theme } from "../../../config/theme";



export default function SettingsLayout() {
  return (
    <Stack screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: theme.settingsBackground },
    }} />
  );
}
