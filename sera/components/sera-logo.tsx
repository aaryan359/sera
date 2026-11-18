import { Image } from "expo-image";
import { Text } from "react-native";

export function SeraLogo({ width = 100, weight = "bold" }: { width?: number; weight?: "bold" | "semibold" }) {
    if (weight === "semibold") {
        return (
            <Text accessibilityLabel="sera." style={{
                width,
                fontFamily: "Inter-SemiBold",
                fontSize: width / 2.5,
                lineHeight: width / 2,
                letterSpacing: -width / 70,
                color: "#1c1c2f",
            }}>sera.</Text>
        );
    }

    return (
        <Image
            source={require("../assets/branding/sera-wordmark.svg")}
            style={{ width, aspectRatio: 4.215 }}
            contentFit="contain"
            accessibilityLabel="sera."
        />
    );
}
