import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { ChatService } from "../api/chat";
import { useAuthStore } from "../store/auth-store";
import type { ChatMessage, RunStatus, SavedChatMessage } from "../interfaces/chat";

const finishedStatuses: RunStatus[] = ["COMPLETED", "FAILED", "CANCELLED", "OUTCOME_UNKNOWN"];
const waitingStatuses: RunStatus[] = ["NEEDS_CLARIFICATION", "AWAITING_APPROVAL"];

function displayMessage(message: SavedChatMessage): ChatMessage {
    return { id: message.id, role: message.role === "USER" ? "user" : "assistant", text: message.content };
}

function errorMessage(error: unknown, fallback: string) {
    if (isAxiosError<{ message?: string }>(error)) {
        if (error.response?.status === 401) return "Your session expired. Please sign in again.";
        return error.response?.data?.message || fallback;
    }
    return fallback;
}

const emptyChat = {
    conversationId: null as string | null,
    messages: [] as ChatMessage[],
    runId: null as string | null,
    nextCursor: null as string | null,
    createdAt: null as string | null,
};

export function useChat() {
    const userId = useAuthStore((state) => state.user?.id);
    const queryClient = useQueryClient();
    const [chat, setChat] = useState(emptyChat);
    const [loading, setLoading] = useState<"history" | "older" | null>("history");
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [historyRetry, setHistoryRetry] = useState(0);
    const [appActive, setAppActive] = useState(AppState.currentState === "active");
    const working = useRef(false);

    // 1. Reopen the latest conversation. Cache this read briefly and by user.
    useEffect(() => {
        let cancelled = false;
        setChat(emptyChat);
        setLoading("history");
        setHistoryError(null);
        setNotice(null);

        async function restoreHistory() {
            try {
                if (!userId) return;
                const history = await queryClient.fetchQuery({
                    queryKey: ["chat-history", userId],
                    queryFn: async () => {
                        const { conversations } = await ChatService.getUserConversations(1);
                        return conversations[0]
                            ? ChatService.getConversationById(conversations[0].id)
                            : null;
                    },
                    staleTime: 30_000,
                });
                if (!cancelled && history) {
                    setChat({
                        conversationId: history.conversation.id,
                        messages: history.conversation.messages.map(displayMessage),
                        runId: history.pendingRun?.id ?? null,
                        nextCursor: history.nextCursor,
                        createdAt: history.conversation.createdAt,
                    });
                }
            } catch (error) {
                if (!cancelled) setHistoryError(errorMessage(error, "Couldn't load your chat. Please try again."));
            } finally {
                if (!cancelled) setLoading(null);
            }
        }
        void restoreHistory();
        return () => { cancelled = true; };
    }, [userId, historyRetry, queryClient]);

    // Pause reply polling while the app is in the background.
    useEffect(() => {
        const subscription = AppState.addEventListener("change", (state) => setAppActive(state === "active"));
        return () => subscription.remove();
    }, []);

    // 2. Send only the new message and keep the run ID for checking its reply.
    const submission = useMutation({
        mutationFn: (text: string) => ChatService.sendMessage(text, chat.conversationId),
        retry: false,
        onSuccess: (result) => {
            setChat((current) => ({
                ...current,
                conversationId: result.conversationId,
                messages: [...current.messages, displayMessage(result.message)],
                runId: result.runId,
                createdAt: current.createdAt ?? result.message.createdAt,
            }));
            void queryClient.invalidateQueries({ queryKey: ["chat-history", userId] });
        },
    });

    // 3. Check the run every 1.5 seconds until it finishes or needs user input.
    const run = useQuery({
        queryKey: ["chat-run", userId, chat.runId],
        queryFn: () => ChatService.getRun(chat.runId!),
        enabled: chat.runId !== null && appActive,
        staleTime: 0,
        retry: false,
        refetchInterval: (query) => {
            const status = query.state.data?.run.status;
            return query.state.error || (status && [...finishedStatuses, ...waitingStatuses].includes(status))
                ? false : 1500;
        },
    });

    useEffect(() => {
        const result = run.data;
        if (!result || result.run.id !== chat.runId || !finishedStatuses.includes(result.run.status)) return;
        const answer = result.answer;
        setChat((current) => ({
            ...current,
            runId: null,
            messages: answer && !current.messages.some((message) => message.id === answer.id)
                ? [...current.messages, { id: answer.id, role: "assistant", text: answer.content }]
                : current.messages,
        }));
        if (result.run.status === "COMPLETED") {
            setNotice(answer ? null : "The task completed, but no reply was returned.");
        } else if (result.run.status === "OUTCOME_UNKNOWN") {
            setNotice("The action's outcome is uncertain. Check it before repeating the request.");
        } else {
            setNotice("This request stopped without a reply. You can send a new message.");
        }
        void queryClient.invalidateQueries({ queryKey: ["chat-history", userId] });
    }, [run.data, chat.runId, queryClient, userId]);

    const isBusy = loading !== null || historyError !== null || submission.isPending || chat.runId !== null;

    async function sendMessage(text: string) {
        if (working.current || isBusy || !text.trim()) return false;
        working.current = true;
        setNotice(null);
        try {
            await submission.mutateAsync(text.trim());
            return true;
        } catch (error) {
            setNotice(errorMessage(error, "Couldn't confirm your message was received. It hasn't been sent again automatically."));
            return false;
        } finally {
            working.current = false;
        }
    }

    async function loadOlderMessages() {
        if (working.current || isBusy || !chat.conversationId || !chat.nextCursor) return;
        working.current = true;
        setLoading("older");
        setNotice(null);
        try {
            const history = await ChatService.getConversationById(chat.conversationId, chat.nextCursor);
            setChat((current) => ({
                ...current,
                messages: [...history.conversation.messages.map(displayMessage), ...current.messages],
                nextCursor: history.nextCursor,
            }));
        } catch (error) {
            setNotice(errorMessage(error, "Couldn't load older messages. Please try again."));
        } finally {
            working.current = false;
            setLoading(null);
        }
    }

    function startNewChat() {
        if (working.current || isBusy) return;
        setChat(emptyChat);
        setNotice(null);
        submission.reset();
    }

    const status = run.data?.run.status;
    let statusText: string | null = null;
    if (loading === "history") statusText = "Loading your conversation…";
    else if (submission.isPending) statusText = "Sending…";
    else if (chat.runId) {
        if (status === "NEEDS_CLARIFICATION") statusText = "This task needs clarification.";
        else if (status === "AWAITING_APPROVAL") statusText = "This task is waiting for approval.";
        else if (status === "QUEUED") statusText = "Waiting for Sera…";
        else statusText = "Sera is working…";
    }
    return {
        messages: chat.messages,
        createdAt: chat.createdAt,
        sendMessage,
        startNewChat,
        loadOlderMessages,
        hasOlderMessages: chat.nextCursor !== null,
        isLoadingOlder: loading === "older",
        isLoadingHistory: loading === "history",
        isBusy,
        isSubmitting: submission.isPending,
        status: statusText,
        error: historyError || notice || (chat.runId && run.error
            ? errorMessage(run.error, "Couldn't check your reply. Check again without resending your message.") : null),
        canCheckAgain: !!historyError || (chat.runId !== null && (!!run.error || (!!status && waitingStatuses.includes(status)))),
        checkAgain: () => {
            if (historyError) setHistoryRetry((count) => count + 1);
            else void run.refetch();
        },
    };
}
