import { Stack } from "expo-router";
import { theme } from "../../../config/theme";



export default function HomeLayout() {
  return (
    <Stack screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: theme.background },
    }} />
  );
}
