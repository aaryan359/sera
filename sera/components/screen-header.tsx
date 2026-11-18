import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SeraLogo } from "./sera-logo";
import { theme } from "../config/theme";

export function ScreenHeader({ title, action }: { title?: string; action?: ReactNode }) {
    return (
        <View style={styles.header}>
            <SeraLogo width={68} weight="semibold" />
            {action ??
                (title ? (
                    <Text accessibilityRole="header" style={styles.title}>
                        {title}
                    </Text>
                ) : null)}
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        width: "100%",
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
    },
    title: { fontFamily: "Inter-Medium", fontSize: 15, color: theme.text },
});
