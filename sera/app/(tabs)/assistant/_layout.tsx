import { Stack } from "expo-router";
import { theme } from "../../../config/theme";



export default function AssistantLayout() {
  return (
    <Stack screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: theme.background },
    }} />
  );
}
