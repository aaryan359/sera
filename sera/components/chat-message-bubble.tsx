import Markdown, { MarkdownIt, type RenderRules } from "@ronradtke/react-native-markdown-display";
import { memo } from "react";
import {
    Alert,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    View,
    type TextProps,
} from "react-native";
import type { ChatMessage } from "../interfaces/chat";

// Parse model output as Markdown; never interpret it as executable HTML.
const markdown = new MarkdownIt({ html: false, linkify: true });
const monospace = Platform.select({ ios: "Menlo", default: "monospace" });

function openLink(url: string) {
    if (!/^(https?:\/\/|mailto:)/i.test(url)) return false;

    void Linking.openURL(url).catch(() => {
        Alert.alert("Couldn't open link", "Please try opening this address in your browser.");
    });
    // We handle navigation ourselves, including failures.
    return false;
}

function SelectableText(props: TextProps) {
    return <Text {...props} selectable />;
}

const rules: RenderRules = {
    link: (node, children) => (
        <Text
            key={node.key}
            accessibilityRole="link"
            style={markdownStyles.link}
            onPress={() => openLink(node.attributes.href)}
        >
            {children}
        </Text>
    ),
    // Wide tables and code scroll inside the bubble rather than stretching the chat.
    table: (node, children) => (
        <ScrollView key={node.key} horizontal style={styles.wideBlock}>
            <View style={styles.table}>{children}</View>
        </ScrollView>
    ),
    fence: (node) => (
        <ScrollView key={node.key} horizontal style={styles.codeBlock}>
            <Text selectable style={styles.code}>
                {node.content.replace(/\n$/, "")}
            </Text>
        </ScrollView>
    ),
    code_block: (node) => (
        <ScrollView key={node.key} horizontal style={styles.codeBlock}>
            <Text selectable style={styles.code}>
                {node.content.replace(/\n$/, "")}
            </Text>
        </ScrollView>
    ),
};

export const ChatMessageBubble = memo(function ChatMessageBubble({
    message,
}: {
    message: ChatMessage;
}) {
    const isUser = message.role === "user";

    return (
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
            {isUser ? (
                <Text selectable style={styles.userText}>
                    {message.text}
                </Text>
            ) : (
                <Markdown
                    markdownit={markdown}
                    style={markdownStyles}
                    rules={rules}
                    onLinkPress={openLink}
                    textcomponent={SelectableText}
                >
                    {message.text}
                </Markdown>
            )}
        </View>
    );
});

const styles = StyleSheet.create({
    bubble: {
        maxWidth: "94%",
        minWidth: 0,
        paddingHorizontal: 17,
        paddingVertical: 16,
        borderRadius: 20,
    },
    assistantBubble: {
        alignSelf: "flex-start",
        backgroundColor: "#FFFFFFF5",
        borderTopLeftRadius: 5,
    },
    userBubble: {
        alignSelf: "flex-end",
        backgroundColor: "#202124",
        borderTopRightRadius: 5,
        marginTop: 3,
    },
    userText: {
        fontFamily: "Inter-Regular",
        fontSize: 14,
        lineHeight: 23,
        letterSpacing: -0.15,
        color: "#F5F4F8",
        flexShrink: 1,
    },
    wideBlock: { maxWidth: "100%", marginVertical: 8 },
    table: { borderWidth: 1, borderColor: "#DDDCE8", borderRadius: 6, overflow: "hidden" },
    codeBlock: { maxWidth: "100%", backgroundColor: "#F1F0F7", borderRadius: 8, marginVertical: 8 },
    code: { fontFamily: monospace, fontSize: 12, lineHeight: 20, color: "#3E3D49", padding: 12 },
});

const markdownStyles = StyleSheet.create({
    body: {
        fontFamily: "Inter-Regular",
        fontSize: 14,
        lineHeight: 23,
        letterSpacing: -0.15,
        color: "#3E3D49",
        flexShrink: 1,
    },
    paragraph: { marginTop: 0, marginBottom: 8 },
    strong: { fontFamily: "Inter-Bold", fontWeight: "700" },
    heading1: { fontFamily: "Inter-Bold", fontSize: 22, lineHeight: 29, marginBottom: 8 },
    heading2: { fontFamily: "Inter-SemiBold", fontSize: 19, lineHeight: 26, marginBottom: 8 },
    heading3: { fontFamily: "Inter-SemiBold", fontSize: 17, lineHeight: 24, marginBottom: 6 },
    heading4: { fontFamily: "Inter-SemiBold", fontSize: 15, lineHeight: 23, marginBottom: 6 },
    heading5: { fontFamily: "Inter-SemiBold", fontSize: 14, lineHeight: 23, marginBottom: 6 },
    heading6: { fontFamily: "Inter-SemiBold", fontSize: 14, lineHeight: 23, marginBottom: 6 },
    link: { color: "#515EC4", textDecorationLine: "underline" },
    blockquote: {
        backgroundColor: "#F5F4FA",
        borderLeftColor: "#939BF2",
        borderLeftWidth: 3,
        paddingLeft: 12,
        marginVertical: 8,
    },
    code_inline: {
        fontFamily: monospace,
        fontSize: 12,
        backgroundColor: "#F1F0F7",
        color: "#514A78",
    },
    bullet_list: { marginBottom: 8 },
    ordered_list: { marginBottom: 8 },
    th: { minWidth: 120, padding: 8, backgroundColor: "#F1F0F7" },
    td: { minWidth: 120, padding: 8 },
    tr: { borderBottomWidth: 1, borderColor: "#DDDCE8" },
    hr: { backgroundColor: "#DDDCE8", height: 1, marginVertical: 12 },
});
