import type { ReactNode } from "react";
import { SettingsIcon } from "./settings-icon";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../config/theme";

export interface SettingsSheetContent {
    title: string;
    description: string;
    options?: readonly string[];
    selected?: string;
    onSelect?: (value: string) => void;
    details?: string[];
    body?: ReactNode;
}

export function SettingsSheet({
    content,
    onClose,
}: {
    content: SettingsSheetContent | null;
    onClose: () => void;
}) {
    const insets = useSafeAreaInsets();
    return (
        <Modal
            visible={content !== null}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel="Close settings panel"
                />
                <View
                    accessibilityViewIsModal
                    style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}
                >
                    <View style={styles.handle} />
                    <View style={styles.heading}>
                        <Text accessibilityRole="header" style={styles.title}>
                            {content?.title}
                        </Text>
                        <Pressable
                            onPress={onClose}
                            hitSlop={12}
                            accessibilityRole="button"
                            accessibilityLabel="Close"
                        >
                            <SettingsIcon name="close" size={23} />
                        </Pressable>
                    </View>
                    <ScrollView contentContainerStyle={styles.body}>
                        <Text style={styles.description}>{content?.description}</Text>
                        {content?.body}
                        {content?.options?.map((option) => (
                            <Pressable
                                key={option}
                                accessibilityRole="radio"
                                accessibilityState={{ checked: content.selected === option }}
                                onPress={() => {
                                    content.onSelect?.(option);
                                    onClose();
                                }}
                                style={[
                                    styles.option,
                                    content.selected === option && styles.selected,
                                ]}
                            >
                                <Text style={styles.optionText}>{option}</Text>
                                <SettingsIcon
                                    name={content.selected === option ? "completed" : "circle"}
                                    size={23}
                                    color={content.selected === option ? "#58776B" : "#C8CECB"}
                                />
                            </Pressable>
                        ))}
                        {content?.details?.map((detail) => (
                            <View key={detail} style={styles.detail}>
                                <SettingsIcon name="check" size={17} color="#6F8D7F" />
                                <Text style={styles.detailText}>{detail}</Text>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(30,28,48,0.3)" },
    sheet: {
        backgroundColor: "#F4F7F5",
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingHorizontal: 25,
        maxHeight: "85%",
    },
    handle: {
        width: 38,
        height: 4,
        borderRadius: 2,
        backgroundColor: "#D9D7E5",
        alignSelf: "center",
        marginTop: 11,
        marginBottom: 23,
    },
    heading: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 12 },
    title: { flex: 1, fontFamily: "Inter-SemiBold", fontSize: 22, color: theme.text },
    body: { paddingBottom: 16, gap: 10 },
    description: {
        fontFamily: "Inter-Regular",
        fontSize: 14,
        lineHeight: 23,
        color: "#838093",
        marginBottom: 12,
    },
    option: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 17,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "#ECEAF3",
        backgroundColor: "white",
    },
    selected: { backgroundColor: "#E8F0EB", borderColor: "#CFDFD4" },
    optionText: { flex: 1, fontFamily: "Inter-Medium", fontSize: 14, color: theme.text },
    detail: { flexDirection: "row", gap: 12, paddingVertical: 10 },
    detailText: {
        flex: 1,
        fontFamily: "Inter-Regular",
        fontSize: 14,
        lineHeight: 22,
        color: theme.text,
    },
});
