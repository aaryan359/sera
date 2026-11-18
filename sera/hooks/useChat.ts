import { useMutation, useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { ChatService } from "../api/chat";
import type { ChatMessage, RunStatus } from "../interfaces/chat";

const runLabels: Record<RunStatus, string> = {
    QUEUED: "Waiting for Sera…",
    PLANNING: "Planning…",
    RUNNING: "Sera is working…",
    EVALUATING: "Checking results…",
    REFLECTING: "Reviewing the task…",
    REPLANNING: "Updating the plan…",
    NEEDS_CLARIFICATION: "This task needs clarification.",
    AWAITING_APPROVAL: "This task is waiting for approval.",
    EXECUTING: "Carrying out the action…",
    VERIFYING: "Verifying the result…",
    COMPLETED: "Reply received",
    FAILED: "Sera couldn't complete this request. You can send a new message.",
    CANCELLED: "This request was cancelled.",
    OUTCOME_UNKNOWN: "The action's outcome is uncertain. Don't repeat it until it is checked.",
};

function requestError(error: unknown, submitting: boolean) {
    if (isAxiosError(error)) {
        if (error.response?.status === 401) return "Your session expired. Please sign in again.";
        if (error.response?.status === 403)
            return "You don't have permission to access this conversation.";
        if (!error.response || error.response.status >= 500) {
            return submitting
                ? "Couldn't confirm whether your message was received. It has not been sent again automatically."
                : "Couldn't check your reply. Your task may still be running; check again without resending it.";
        }
        return error.response.data?.message || "The request couldn't be completed.";
    }
    return "The server returned an unexpected response. Please try checking again.";
}

export function useChat() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [runId, setRunId] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [appActive, setAppActive] = useState(AppState.currentState === "active");
    const sending = useRef(false);

    useEffect(() => {
        const subscription = AppState.addEventListener("change", (state) =>
            setAppActive(state === "active"),
        );
        return () => subscription.remove();
    }, []);

    const submission = useMutation({
        mutationFn: (text: string) => ChatService.sendMessage(text, conversationId),
        retry: false,
        onSuccess: (result) => {
            setConversationId(result.conversationId);
            setMessages((current) => [
                ...current,
                {
                    id: result.message.id,
                    role: "user",
                    text: result.message.content,
                },
            ]);
            setRunId(result.runId);
            setNotice(null);
        },
    });

    const run = useQuery({
        queryKey: ["chat-run", runId],
        queryFn: ({ signal }) => ChatService.getRun(runId!, signal),
        enabled: runId !== null && appActive,
        staleTime: 0,
        retry: (count, error) =>
            count < 2 &&
            !(isAxiosError(error) && [401, 403, 404].includes(error.response?.status ?? 0)),
        refetchInterval: (query) => {
            if (query.state.error) return false;
            const status = query.state.data?.run.status;
            return status &&
                [
                    "COMPLETED",
                    "FAILED",
                    "CANCELLED",
                    "OUTCOME_UNKNOWN",
                    "NEEDS_CLARIFICATION",
                    "AWAITING_APPROVAL",
                ].includes(status)
                ? false
                : 1500;
        },
    });

    useEffect(() => {
        const result = run.data;
        if (!result || result.run.id !== runId) return;
        const status = result.run.status;
        if (status === "COMPLETED") {
            const answer = result.answer;
            if (answer) {
                setMessages((current) =>
                    current.some((message) => message.id === answer.id)
                        ? current
                        : [...current, { id: answer.id, role: "assistant", text: answer.content }],
                );
            }
            setNotice(answer ? null : "The task completed, but no reply was returned.");
            setRunId(null);
        } else if (["FAILED", "CANCELLED", "OUTCOME_UNKNOWN"].includes(status)) {
            setNotice(runLabels[status]);
            setRunId(null);
        }
    }, [run.data, runId]);

    async function sendMessage(text: string) {
        if (sending.current || runId || !text.trim()) return false;
        sending.current = true;
        setNotice(null);
        try {
            await submission.mutateAsync(text.trim());
            return true;
        } catch {
            return false;
        } finally {
            sending.current = false;
        }
    }

    function startNewChat() {
        if (sending.current || runId) return;
        setMessages([]);
        setConversationId(null);
        setNotice(null);
        submission.reset();
    }

    return {
        messages,
        sendMessage,
        startNewChat,
        isBusy: submission.isPending || runId !== null,
        isSubmitting: submission.isPending,
        status: submission.isPending
            ? "Sending…"
            : runId
              ? runLabels[run.data?.run.status ?? "QUEUED"]
              : null,
        error: submission.error
            ? requestError(submission.error, true)
            : runId && run.error
              ? requestError(run.error, false)
              : notice,
        canCheckAgain:
            runId !== null &&
            (!!run.error ||
                ["NEEDS_CLARIFICATION", "AWAITING_APPROVAL"].includes(run.data?.run.status ?? "")),
        checkAgain: () => {
            void run.refetch();
        },
    };
}
