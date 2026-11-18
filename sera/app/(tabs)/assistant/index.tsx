import {
    Pressable,
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenHeader } from "../../../components/screen-header";
import { theme } from "../../../config/theme";
import { ChatMessageBubble } from "../../../components/chat-message-bubble";
import type { ChatMessage } from "../../../interfaces/chat";
import { useChat } from "../../../hooks/useChat";

export default function AssistantScreen() {
    const insets = useSafeAreaInsets();

    const list = useRef<FlatList<ChatMessage>>(null);
    const followingLatest = useRef(true);
    const scrollFrame = useRef<number | null>(null);
    const chat = useChat();

    const [draft, setDraft] = useState("");

    const canSend = draft.trim().length > 0 && !chat.isBusy;

    const scrollToLatest = useCallback(() => {
        if (!followingLatest.current) return;
        if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
        scrollFrame.current = requestAnimationFrame(() => {
            scrollFrame.current = null;
            if (followingLatest.current) list.current?.scrollToEnd({ animated: false });
        });
    }, []);

    useEffect(
        () => () => {
            if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
        },
        [],
    );

    const sendMessage = async () => {
        if (!canSend) return;
        followingLatest.current = true;
        const sent = await chat.sendMessage(draft);
        if (sent) setDraft("");
    };

    return (
        <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
            <KeyboardAvoidingView
                style={styles.content}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={insets.top}
            >
                <View style={styles.header}>
                    <ScreenHeader title="AI Assistant" />
                </View>

                <FlatList
                    ref={list}
                    style={styles.conversation}
                    data={chat.messages}
                    keyExtractor={(item) => item.id}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.messages}
                    onContentSizeChange={scrollToLatest}
                    onLayout={scrollToLatest}
                    onScroll={({ nativeEvent }) => {
                        const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
                        followingLatest.current =
                            contentSize.height - contentOffset.y - layoutMeasurement.height < 80;
                    }}
                    scrollEventThrottle={16}
                    removeClippedSubviews={false}
                    maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
                    ListHeaderComponent={
                        <View>
                            {chat.hasOlderMessages && (
                                <Pressable
                                    accessibilityRole="button"
                                    disabled={chat.isBusy}
                                    style={styles.retry}
                                    onPress={() => {
                                        followingLatest.current = false;
                                        void chat.loadOlderMessages();
                                    }}
                                >
                                    <Text style={styles.retryText}>
                                        {chat.isLoadingOlder ? "Loading…" : "Load older messages"}
                                    </Text>
                                </Pressable>
                            )}
                            <Text style={styles.timestamp}>
                                {chat.createdAt
                                    ? new Date(chat.createdAt).toLocaleString()
                                    : "New conversation"}
                            </Text>
                        </View>
                    }
                    renderItem={({ item }) => <ChatMessageBubble message={item} />}
                    ListEmptyComponent={
                        !chat.isLoadingHistory && !chat.error ? (
                            <ChatMessageBubble
                                message={{
                                    id: "welcome",
                                    role: "assistant",
                                    text: "Hey! What can I help you with today?",
                                }}
                            />
                        ) : undefined
                    }
                    ListFooterComponent={
                        <View accessibilityLiveRegion="polite">
                            {chat.status && !chat.error && (
                                <View style={styles.status}>
                                    <ActivityIndicator size="small" color="#918C9E" />
                                    <Text style={styles.statusText}>{chat.status}</Text>
                                </View>
                            )}
                            {chat.error && (
                                <Text accessibilityRole="alert" style={styles.error}>
                                    {chat.error}
                                </Text>
                            )}
                            {chat.canCheckAgain && (
                                <Pressable
                                    accessibilityRole="button"
                                    onPress={chat.checkAgain}
                                    style={styles.retry}
                                >
                                    <Text style={styles.retryText}>
                                        {chat.error && !chat.messages.length
                                            ? "Try again"
                                            : "Check reply again"}
                                    </Text>
                                </Pressable>
                            )}
                        </View>
                    }
                />

                <View style={styles.composerArea}>
                    <View style={styles.composer}>
                        <TextInput
                            accessibilityLabel="Message Sera"
                            placeholder="Message…"
                            placeholderTextColor="#A1A0AF"
                            editable={!chat.isSubmitting}
                            value={draft}
                            onChangeText={setDraft}
                            multiline
                            maxLength={20_000}
                            style={styles.input}
                            underlineColorAndroid="transparent"
                        />
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Send message"
                            accessibilityState={{ disabled: !canSend }}
                            disabled={!canSend}
                            onPress={sendMessage}
                            style={[styles.send, canSend && styles.sendReady]}
                        >
                            <Ionicons
                                name="paper-plane-outline"
                                size={20}
                                color={canSend ? "#FFFFFF" : "#ACADBB"}
                            />
                        </Pressable>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: "#E8E7F4",
        backgroundImage: "linear-gradient(160deg, #F5E8E1, #EEE6EE 40%, #E2E3F8 100%)",
    },
    content: { flex: 1, width: "100%", maxWidth: 680, alignSelf: "center" },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 24,
        paddingTop: 10,
        paddingBottom: 22,
        gap: 12,
    },
    conversation: { flex: 1 },
    messages: { paddingHorizontal: 24, paddingBottom: 24, gap: 12 },
    timestamp: {
        fontFamily: "Inter-Regular",
        fontSize: 10,
        textAlign: "center",
        color: "#A09AA6",
        marginTop: 3,
        marginBottom: 21,
    },
    status: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, paddingLeft: 3 },
    error: {
        fontFamily: "Inter-Regular",
        fontSize: 13,
        lineHeight: 20,
        color: "#9E3549",
        marginTop: 12,
    },
    retry: { alignSelf: "flex-start", paddingVertical: 12 },
    retryText: { fontFamily: "Inter-SemiBold", fontSize: 13, color: "#515EC4" },
    statusText: { fontFamily: "Inter-Regular", fontSize: 11, color: "#918C9E" },
    composerArea: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
    composer: {
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 8,
        borderRadius: 29,
        backgroundColor: "#FFFFFFF5",
        padding: 7,
        paddingLeft: 19,
        boxShadow: "0 3px 14px rgba(75,64,106,0.025)",
    },
    input: {
        flex: 1,
        minHeight: 42,
        maxHeight: 120,
        paddingVertical: 11,
        fontFamily: "Inter-Regular",
        fontSize: 14,
        lineHeight: 20,
        color: theme.text,
    },
    send: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: "#F5F5FA",
        alignItems: "center",
        justifyContent: "center",
    },
    sendReady: { backgroundColor: "#818AE9" },
});
