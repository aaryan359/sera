import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useState, type ReactNode } from "react";
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SettingsIcon, type SettingsIconName } from "../../../components/settings-icon";
import { SettingsSheet, type SettingsSheetContent } from "../../../components/settings-sheet";
import {
    morningTimes,
    quietWindows,
    reviewTimes,
    summaryLengths,
    summaryPriorities,
    summarySchedules,
    type SettingsPreferences,
} from "../../../config/settings";
import { useSettings } from "../../../hooks/useSettings";
import { theme } from "../../../config/theme";
import { useAuthStore } from "../../../store/auth-store";

type Panel = "stats" | "connectors" | "notifications" | "routines" | "quiet" | "activity" | "help";

const sources: { name: string; icon: SettingsIconName; description: string; details: string[] }[] =
    [
        {
            name: "Gmail",
            icon: "gmail",
            description: "Email summaries & follow-ups",
            details: [
                "Summarize important emails",
                "Keep track of messages that need a reply",
                "Review drafts before sending",
            ],
        },
        {
            name: "Google Calendar",
            icon: "googleCalendar",
            description: "Events & meeting reminders",
            details: [
                "See the events coming up in your day",
                "Get a reminder before a meeting",
                "Review proposed calendar changes",
            ],
        },
        {
            name: "Google Drive",
            icon: "googleDrive",
            description: "Files & document summaries",
            details: [
                "Find documents relevant to your tasks",
                "Summarize documents you choose",
                "Review changes before applying them",
            ],
        },
        {
            name: "Google Contacts",
            icon: "googleContacts",
            description: "People & contact information",
            details: [
                "Find the right recipient when writing an email",
                "Use contacts only after permission is granted",
            ],
        },
    ];

// Demo figures for the profile design. Replace with account statistics later.
const sampleStats: { label: string; value: string; icon: SettingsIconName; color: string }[] = [
    { label: "Tokens used", value: "128.4K", icon: "tokens", color: "#EEF0FB" },
    { label: "Conversations", value: "42", icon: "conversations", color: "#F8EFE7" },
    { label: "Tasks completed", value: "86", icon: "completed", color: "#EAF2EB" },
    { label: "Tasks pending", value: "7", icon: "pending", color: "#F5EFE0" },
];

function Row({
    icon,
    title,
    value,
    description,
    onPress,
    children,
    last,
    danger,
}: {
    icon: SettingsIconName;
    title: string;
    value?: string;
    description?: string;
    onPress?: () => void;
    children?: ReactNode;
    last?: boolean;
    danger?: boolean;
}) {
    const body = (
        <>
            <SettingsIcon name={icon} size={20} color={danger ? "#A16A62" : undefined} />
            <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, danger && styles.danger]}>{title}</Text>
                {description && <Text style={styles.rowDescription}>{description}</Text>}
            </View>
            {value && (
                <Text numberOfLines={2} style={styles.rowValue}>
                    {value}
                </Text>
            )}
            {children ?? (onPress ? <SettingsIcon name="right" size={16} color="#9CA8A2" /> : null)}
        </>
    );
    return onPress ? (
        <Pressable
            accessibilityRole="button"
            onPress={onPress}
            style={({ pressed }) => [
                styles.row,
                !last && styles.divider,
                pressed && styles.pressed,
            ]}
        >
            {body}
        </Pressable>
    ) : (
        <View style={[styles.row, !last && styles.divider]}>{body}</View>
    );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
    return (
        <View style={styles.group}>
            <Text style={styles.groupLabel}>{title}</Text>
            <View style={styles.card}>{children}</View>
        </View>
    );
}

export default function SettingsScreen() {
    const user = useAuthStore((state) => state.user);
    const queryClient = useQueryClient();
    const { preferences, update, isLoading, reset } = useSettings();
    const [panel, setPanel] = useState<Panel | null>(null);
    const [choice, setChoice] = useState<SettingsSheetContent | null>(null);
    const [sourceQuery, setSourceQuery] = useState("");
    const [avatarFailed, setAvatarFailed] = useState(false);
    const [signingOut, setSigningOut] = useState(false);
    const name = user?.name || "Your account";
    const initials = (user?.name || user?.email || "S")
        .split(" ")
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();

    function choose<K extends keyof SettingsPreferences>(
        key: K,
        title: string,
        description: string,
        options: readonly SettingsPreferences[K][],
    ) {
        if (isLoading) return;
        setChoice({
            title,
            description,
            options: options.map(String),
            selected: String(preferences[key]),
            onSelect: (value) => {
                const option = options.find((item) => String(item) === value);
                if (option !== undefined) update(key, option);
            },
        });
    }

    function toggle(
        key:
            | "homeSummaries"
            | "pushNotifications"
            | "actionUpdates"
            | "quietHours"
            | "morningBriefing"
            | "dailyReview"
            | "eventReminders",
        label: string,
    ) {
        return (
            <Switch
                accessibilityLabel={label}
                value={preferences[key]}
                disabled={isLoading}
                onValueChange={(value) => update(key, value)}
                trackColor={{ false: "#DEE5E0", true: "#A9C0AF" }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#DEE5E0"
            />
        );
    }

    async function signOut() {
        setSigningOut(true);
        try {
            await SecureStore.deleteItemAsync("authToken");
            queryClient.clear();
            useAuthStore.getState().setUser(null);
        } catch {
            Alert.alert("Couldn't sign out", "Please try again.");
            setSigningOut(false);
        }
    }

    let content: SettingsSheetContent | null = null;
    if (panel === "stats")
        content = {
            title: "Your account",
            description: user?.email || "A little look at your time with Sera.",
            body: (
                <View style={styles.statsBody}>
                    <View style={styles.statsIntro}>
                        <Text style={styles.statsHeading}>A little progress, every day.</Text>
                        <Text style={styles.demoBadge}>SAMPLE DATA</Text>
                    </View>
                    <View style={styles.statsGrid}>
                        {sampleStats.map((stat) => (
                            <View
                                key={stat.label}
                                style={[styles.statCard, { backgroundColor: stat.color }]}
                            >
                                <SettingsIcon name={stat.icon} size={22} />
                                <Text style={styles.statValue}>{stat.value}</Text>
                                <Text style={styles.statLabel}>{stat.label}</Text>
                            </View>
                        ))}
                    </View>
                    <View style={styles.progressCard}>
                        <View style={styles.progressHeading}>
                            <Text style={styles.progressTitle}>Tasks at a glance</Text>
                            <Text style={styles.progressCount}>86 of 93 done</Text>
                        </View>
                        <View style={styles.progressTrack}>
                            <View style={styles.progressFill} />
                        </View>
                        <Text style={styles.progressCaption}>
                            7 tasks are still waiting for your attention.
                        </Text>
                    </View>
                    <Text style={styles.sampleNote}>
                        These are illustrative numbers. Your real account stats will be added later.
                    </Text>
                </View>
            ),
        };
    if (panel === "connectors")
        content = {
            title: "Connectors",
            description:
                "Your favorite apps, brought together in Sera. Connection setup is coming soon.",
            body: (
                <View style={styles.panelBody}>
                    <View style={styles.search}>
                        <SettingsIcon name="search" size={18} color="#9BA8A1" />
                        <TextInput
                            accessibilityLabel="Search connectors"
                            placeholder="Search"
                            placeholderTextColor="#9AA79F"
                            value={sourceQuery}
                            onChangeText={setSourceQuery}
                            style={styles.searchInput}
                        />
                    </View>
                    <Text style={styles.panelLabel}>AVAILABLE SOURCES</Text>
                    <View style={styles.panelCard}>
                        {sources
                            .filter((source) =>
                                source.name
                                    .toLowerCase()
                                    .includes(sourceQuery.trim().toLowerCase()),
                            )
                            .map((source, index, list) => (
                                <Row
                                    key={source.name}
                                    icon={source.icon}
                                    title={source.name}
                                    description={source.description}
                                    value="Soon"
                                    last={index === list.length - 1}
                                    onPress={() =>
                                        setChoice({
                                            title: source.name,
                                            description:
                                                "Connection setup is coming soon. You’ll choose the permissions Sera can use.",
                                            details: source.details,
                                        })
                                    }
                                />
                            ))}
                    </View>
                    {!sources.some((source) =>
                        source.name.toLowerCase().includes(sourceQuery.trim().toLowerCase()),
                    ) && (
                        <Text style={styles.sampleNote}>
                            No matching sources. Try Gmail, Calendar, Drive, or Contacts.
                        </Text>
                    )}
                    <View style={styles.panelNote}>
                        <SettingsIcon name="shield" size={18} />
                        <Text style={styles.panelNoteText}>
                            Signing in does not give Sera access to your inbox or files. Each source
                            needs your permission.
                        </Text>
                    </View>
                </View>
            ),
        };
    if (panel === "notifications")
        content = {
            title: "Notifications",
            description:
                "Choose how your Home feed will summarize updates. Delivery is not active yet.",
            body: (
                <View style={styles.panelBody}>
                    <View style={styles.panelCard}>
                        <Row icon="notifications" title="Summaries on Home" last>
                            {toggle("homeSummaries", "Summaries on Home")}
                        </Row>
                    </View>
                    <Text style={styles.panelLabel}>SUMMARY LENGTH</Text>
                    <View style={styles.segments}>
                        {summaryLengths.map((length) => (
                            <Pressable
                                key={length}
                                disabled={isLoading || !preferences.homeSummaries}
                                accessibilityRole="radio"
                                accessibilityState={{
                                    checked: preferences.summaryLength === length,
                                    disabled: isLoading || !preferences.homeSummaries,
                                }}
                                onPress={() => update("summaryLength", length)}
                                style={[
                                    styles.segment,
                                    preferences.summaryLength === length && styles.activeSegment,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.segmentText,
                                        preferences.summaryLength === length &&
                                            styles.activeSegmentText,
                                    ]}
                                >
                                    {length}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                    <View style={styles.panelCard}>
                        <Row
                            icon="pending"
                            title="Delivery"
                            value={preferences.summarySchedule}
                            onPress={() =>
                                choose(
                                    "summarySchedule",
                                    "Summary delivery",
                                    "Choose when updates should be grouped into a summary.",
                                    summarySchedules,
                                )
                            }
                        />
                        <Row
                            icon="tasks"
                            title="Include"
                            value={preferences.summaryPriority}
                            onPress={() =>
                                choose(
                                    "summaryPriority",
                                    "What to include",
                                    "Keep your feed focused or include updates from every source.",
                                    summaryPriorities,
                                )
                            }
                        />
                        <Row icon="notifications" title="Push notifications" last>
                            {toggle("pushNotifications", "Push notifications")}
                        </Row>
                    </View>
                </View>
            ),
        };
    if (panel === "routines")
        content = {
            title: "Daily routines",
            description:
                "Small check-ins for your day. These routines are previews and aren’t running yet.",
            body: (
                <View style={styles.panelBody}>
                    <View style={styles.panelCard}>
                        <Row
                            icon="morning"
                            title="Morning briefing"
                            description="Emails, events, and your priorities"
                        >
                            {toggle("morningBriefing", "Morning briefing")}
                        </Row>
                        {preferences.morningBriefing && (
                            <Row
                                icon="pending"
                                title="Briefing time"
                                value={preferences.morningTime}
                                onPress={() =>
                                    choose(
                                        "morningTime",
                                        "Morning briefing",
                                        "Choose a daily briefing time.",
                                        morningTimes,
                                    )
                                }
                            />
                        )}
                        <Row
                            icon="tasks"
                            title="Daily task check-in"
                            description="Review completed and pending tasks"
                        >
                            {toggle("dailyReview", "Daily task check-in")}
                        </Row>
                        {preferences.dailyReview && (
                            <Row
                                icon="pending"
                                title="Check-in time"
                                value={preferences.reviewTime}
                                onPress={() =>
                                    choose(
                                        "reviewTime",
                                        "Daily check-in",
                                        "Tasks are only marked complete when you confirm.",
                                        reviewTimes,
                                    )
                                }
                            />
                        )}
                        <Row
                            icon="calendar"
                            title="Event reminders"
                            description="15 minutes before an event"
                            last
                        >
                            {toggle("eventReminders", "Upcoming event reminders")}
                        </Row>
                    </View>
                </View>
            ),
        };
    if (panel === "quiet")
        content = {
            title: "Quiet hours",
            description: `A little space to switch off. Times use your account’s time zone (${user?.timezone || "not set"}).`,
            body: (
                <View style={styles.panelCard}>
                    <Row
                        icon="moon"
                        title="Quiet hours"
                        description="Pause non-urgent notifications"
                        last={!preferences.quietHours}
                    >
                        {toggle("quietHours", "Quiet hours")}
                    </Row>
                    {preferences.quietHours && (
                        <Row
                            icon="pending"
                            title="Quiet window"
                            value={preferences.quietWindow}
                            last
                            onPress={() =>
                                choose(
                                    "quietWindow",
                                    "Your quiet window",
                                    "Choose when non-urgent notifications should pause.",
                                    quietWindows,
                                )
                            }
                        />
                    )}
                </View>
            ),
        };
    if (panel === "activity")
        content = {
            title: "Activity & actions",
            description: "A place for completed actions and things waiting for your go-ahead.",
            body: (
                <View style={styles.panelCard}>
                    <Row
                        icon="activity"
                        title="Action updates"
                        description="Show completed actions in Activity"
                        last
                    >
                        {toggle("actionUpdates", "Action updates")}
                    </Row>
                </View>
            ),
            details: [
                "Home will collect short notification summaries",
                "Activity will show sent emails, completed actions, and pending approvals",
                "Review recipients and content before sending an email",
            ],
        };
    if (panel === "help")
        content = {
            title: "Help & support",
            description: "A little guide to your space.",
            details: [
                "Assistant is where you can ask Sera for help",
                "Your saved conversations stay in your account",
                "Source connections, notification delivery, and routines are still in preview",
                "Preferences are saved only on this device for now",
            ],
        };

    return (
        <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                        style={styles.headerButton}
                        onPress={() =>
                            router.canGoBack() ? router.back() : router.navigate("/(tabs)/home")
                        }
                    >
                        <SettingsIcon name="back" size={21} />
                    </Pressable>
                    <Text accessibilityRole="header" style={styles.title}>
                        Settings
                    </Text>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="View account statistics"
                        style={styles.headerButton}
                        onPress={() => setPanel("stats")}
                    >
                        <SettingsIcon name="stats" size={20} />
                    </Pressable>
                </View>

                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="View your profile and account statistics"
                    style={({ pressed }) => [styles.profile, pressed && styles.pressed]}
                    onPress={() => setPanel("stats")}
                >
                    <View style={styles.avatar}>
                        {user?.avatarUrl && !avatarFailed ? (
                            <Image
                                source={{ uri: user.avatarUrl }}
                                contentFit="cover"
                                onError={() => setAvatarFailed(true)}
                                style={styles.avatarImage}
                            />
                        ) : (
                            <Text style={styles.initials}>{initials}</Text>
                        )}
                    </View>
                    <View style={styles.profileDetails}>
                        <Text style={styles.profileName}>{name}</Text>
                        <Text numberOfLines={1} style={styles.profileEmail}>
                            {user?.email || "Your personal assistant"}
                        </Text>
                        <View style={styles.profileLink}>
                            <Text style={styles.profileLinkText}>Your account overview</Text>
                            <SettingsIcon name="right" size={13} color="#82958A" />
                        </View>
                    </View>
                </Pressable>

                <Group title="Account settings">
                    <Row
                        icon="account"
                        title="Account"
                        value="View stats"
                        onPress={() => setPanel("stats")}
                    />
                    <Row
                        icon="connectors"
                        title="Connectors"
                        value="4 sources"
                        onPress={() => {
                            setSourceQuery("");
                            setPanel("connectors");
                        }}
                    />
                    <Row
                        icon="shield"
                        title="Activity & actions"
                        last
                        onPress={() => setPanel("activity")}
                    />
                </Group>
                <Group title="Preferences">
                    <Row
                        icon="notifications"
                        title="Notifications"
                        value={preferences.summaryLength}
                        onPress={() => setPanel("notifications")}
                    />
                    <Row
                        icon="routines"
                        title="Daily routines"
                        value="Preview"
                        onPress={() => setPanel("routines")}
                    />
                    <Row
                        icon="moon"
                        title="Quiet hours"
                        value={preferences.quietHours ? "On" : "Off"}
                        last
                        onPress={() => setPanel("quiet")}
                    />
                </Group>
                <Group title="More">
                    <Row icon="help" title="Help & support" onPress={() => setPanel("help")} />
                    <Row
                        icon="reset"
                        title="Reset preferences"
                        onPress={() => {
                            if (!isLoading)
                                Alert.alert(
                                    "Reset preferences?",
                                    "Restore defaults on this device. Your account and conversations will stay saved.",
                                    [
                                        { text: "Cancel", style: "cancel" },
                                        { text: "Reset", onPress: reset },
                                    ],
                                );
                        }}
                    />
                    {user && (
                        <Row
                            icon="logout"
                            title={signingOut ? "Signing out…" : "Log out"}
                            danger
                            last
                            onPress={() => {
                                if (!signingOut)
                                    Alert.alert(
                                        "Log out of Sera?",
                                        "Your conversations will stay saved in your account.",
                                        [
                                            { text: "Cancel", style: "cancel" },
                                            {
                                                text: "Log out",
                                                style: "destructive",
                                                onPress: () => {
                                                    void signOut();
                                                },
                                            },
                                        ],
                                    );
                            }}
                        />
                    )}
                </Group>

                <Text style={styles.wordmark}>sera.</Text>
            </ScrollView>
            <SettingsSheet
                content={choice ?? content}
                onClose={() => (choice ? setChoice(null) : setPanel(null))}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.settingsBackground },
    content: {
        width: "100%",
        maxWidth: 620,
        alignSelf: "center",
        paddingHorizontal: 23,
        paddingTop: 13,
        paddingBottom: 28,
        gap: 23,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingBottom: 2,
    },
    headerButton: {
        width: 39,
        height: 39,
        borderRadius: 20,
        backgroundColor: "#FFFFFFE8",
        alignItems: "center",
        justifyContent: "center",
    },
    title: { fontFamily: "Inter-Medium", fontSize: 17, color: "#263D33", letterSpacing: -0.4 },
    profile: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 16 },
    profileDetails: { flex: 1, minWidth: 0, gap: 6 },
    avatar: {
        width: 74,
        height: 74,
        borderRadius: 37,
        flexShrink: 0,
        backgroundColor: "#D6E3DC",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        borderWidth: 3,
        borderColor: "#F7FAF8",
    },
    avatarImage: { width: "100%", height: "100%" },
    initials: { fontFamily: "Inter-Medium", fontSize: 28, color: "#6D8A7A" },
    profileName: {
        fontFamily: "Inter-SemiBold",
        fontSize: 18,
        letterSpacing: -0.4,
        color: "#263D33",
    },
    profileEmail: { fontFamily: "Inter-Regular", fontSize: 12, color: "#7C8E83" },
    profileLink: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        paddingTop: 4,
        paddingBottom: 4,
    },
    profileLinkText: { fontFamily: "Inter-Regular", fontSize: 10, color: "#82958A" },
    group: { gap: 10 },
    groupLabel: { fontFamily: "Inter-Medium", fontSize: 12, color: "#73857A", paddingLeft: 8 },
    card: { backgroundColor: "#FFFFFFF2", borderRadius: 23, paddingHorizontal: 17 },
    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 57,
        paddingVertical: 15,
    },
    divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#EDF1EE" },
    rowCopy: { flex: 1, minWidth: 0 },
    rowTitle: { fontFamily: "Inter-Regular", fontSize: 13, lineHeight: 20, color: "#334A3E" },
    rowDescription: {
        fontFamily: "Inter-Regular",
        fontSize: 11,
        lineHeight: 17,
        color: "#89988E",
        marginTop: 3,
    },
    rowValue: {
        fontFamily: "Inter-Regular",
        fontSize: 11,
        lineHeight: 16,
        color: "#96A298",
        textAlign: "right",
        maxWidth: "37%",
    },
    pressed: { opacity: 0.6 },
    danger: { color: "#A16A62" },
    footer: {
        fontFamily: "Inter-Regular",
        fontSize: 10,
        lineHeight: 18,
        color: "#91A096",
        textAlign: "center",
        paddingHorizontal: 12,
    },
    wordmark: {
        fontFamily: "Inter-SemiBold",
        fontSize: 23,
        letterSpacing: -1,
        color: "#B0BDB4",
        textAlign: "center",
        marginTop: -12,
    },
    panelBody: { gap: 15 },
    panelCard: { backgroundColor: "white", borderRadius: 20, paddingHorizontal: 15 },
    panelLabel: {
        fontFamily: "Inter-Medium",
        fontSize: 9,
        letterSpacing: 1.1,
        color: "#92A095",
        marginLeft: 4,
    },
    search: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: "white",
        borderRadius: 16,
        paddingHorizontal: 14,
    },
    searchInput: {
        flex: 1,
        minHeight: 47,
        fontFamily: "Inter-Regular",
        fontSize: 14,
        color: "#334A3E",
    },
    panelNote: { flexDirection: "row", gap: 10, paddingHorizontal: 3, paddingVertical: 7 },
    panelNoteText: {
        flex: 1,
        fontFamily: "Inter-Regular",
        fontSize: 12,
        lineHeight: 20,
        color: "#86978C",
    },
    segments: { flexDirection: "row", backgroundColor: "#E6EDE8", padding: 4, borderRadius: 16 },
    segment: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 12 },
    activeSegment: { backgroundColor: "white" },
    segmentText: { fontFamily: "Inter-Medium", fontSize: 12, color: "#91A094" },
    activeSegmentText: { color: "#3F6150" },
    statsBody: { gap: 18 },
    statsIntro: { gap: 10, alignItems: "flex-start" },
    statsHeading: { fontFamily: "Inter-Medium", fontSize: 15, color: "#465E4F" },
    demoBadge: {
        fontFamily: "Inter-SemiBold",
        fontSize: 8,
        letterSpacing: 1.2,
        color: "#8D9279",
        backgroundColor: "#ECEEDC",
        paddingVertical: 6,
        paddingHorizontal: 9,
        borderRadius: 8,
    },
    statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    statCard: { width: "47%", flexGrow: 1, borderRadius: 21, padding: 18, gap: 10 },
    statValue: {
        fontFamily: "Inter-SemiBold",
        fontSize: 29,
        letterSpacing: -1.2,
        color: "#354A3C",
        marginTop: 4,
    },
    statLabel: { fontFamily: "Inter-Regular", fontSize: 11, color: "#819081" },
    progressCard: { backgroundColor: "white", padding: 18, borderRadius: 20, gap: 12 },
    progressHeading: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
    progressTitle: { fontFamily: "Inter-Medium", fontSize: 12, color: "#415A4B" },
    progressCount: { fontFamily: "Inter-Regular", fontSize: 11, color: "#91A095" },
    progressTrack: { height: 6, borderRadius: 3, backgroundColor: "#F0EEDF", overflow: "hidden" },
    progressFill: { width: "92.5%", height: "100%", borderRadius: 3, backgroundColor: "#A7C4AF" },
    progressCaption: { fontFamily: "Inter-Regular", fontSize: 11, color: "#8C9C90" },
    sampleNote: {
        fontFamily: "Inter-Regular",
        fontSize: 11,
        lineHeight: 18,
        color: "#93A096",
        textAlign: "center",
        paddingHorizontal: 10,
    },
});
