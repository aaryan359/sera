import { View, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../config/theme";
import { ScreenHeader } from "./screen-header";

export function ScreenPlaceholder({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
            <View style={styles.heading}>
                <ScreenHeader title={title} />
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
    subtitle: {
        fontFamily: "Inter-Regular",
        fontSize: 13,
        lineHeight: 22,
        color: theme.muted,
        marginTop: 36,
    },
});
