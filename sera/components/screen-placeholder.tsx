import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../config/theme";
import { SeraLogo } from "./sera-logo";

export function ScreenPlaceholder({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
            <View style={styles.heading}>
                <View style={styles.brand}>
                    <SeraLogo width={80} weight="semibold" />
                </View>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: theme.background,
    },
    heading: {
        padding: 28,
        paddingBottom: 36,
        backgroundColor: theme.lavender,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
    },
    brand: {
        marginBottom: 48,
    },
    title: {
        fontFamily: "Inter-SemiBold",
        fontSize: 30,
        letterSpacing: -1,
        color: theme.text,
    },
    subtitle: {
        fontFamily: "Inter-Regular",
        fontSize: 13,
        lineHeight: 22,
        color: theme.muted,
        marginTop: 10,
    },
});
