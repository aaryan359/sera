import { Image } from "expo-image";

export function SeraLogo({ width = 100 }: { width?: number }) {
    return (
        <Image
            source={require("../assets/branding/sera-wordmark.svg")}
            style={{ width, aspectRatio: 4.215 }}
            contentFit="contain"
            accessibilityLabel="sera."
        />
    );
}
