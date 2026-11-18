import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../../../components/screen-header";
import { SettingsIcon } from "../../../components/settings-icon";
import { theme } from "../../../config/theme";
import { useAuthStore } from "../../../store/auth-store";

type Task = {
    id: number;
    title: string;
    time: string;
    category: "Personal" | "Work";
    status: "completed" | "progress" | "todo";
};

const initialTasks: Task[] = [
    {
        id: 1,
        title: "Breakfast with Alice",
        time: "9:30–10:30 AM",
        category: "Personal",
        status: "completed",
    },
    {
        id: 2,
        title: "Prepare daily meeting notes",
        time: "11–11:30 AM",
        category: "Work",
        status: "todo",
    },
    {
        id: 3,
        title: "Review the project proposal",
        time: "1–2 PM",
        category: "Work",
        status: "progress",
    },
    { id: 4, title: "Pick up groceries", time: "5:30–6 PM", category: "Personal", status: "todo" },
    {
        id: 5,
        title: "A little time to recharge",
        time: "7:30–7:45 AM",
        category: "Personal",
        status: "completed",
    },
    {
        id: 6,
        title: "Send the weekly update",
        time: "10–10:15 AM",
        category: "Work",
        status: "completed",
    },
];

const categories = ["All Tasks", "Personal", "Work"] as const;

export default function HomeScreen() {
    const tabBarHeight = useBottomTabBarHeight();
    const user = useAuthStore((state) => state.user);
    const [tasks, setTasks] = useState(initialTasks);
    const [category, setCategory] = useState<(typeof categories)[number]>("All Tasks");
    const [searching, setSearching] = useState(false);
    const [query, setQuery] = useState("");
    const now = new Date();
    const period = now.getHours() < 12 ? "morning" : now.getHours() < 18 ? "afternoon" : "evening";
    const firstName = user?.name?.trim().split(/\s+/)[0];
    const visibleTasks = tasks.filter(
        (task) =>
            (category === "All Tasks" || task.category === category) &&
            task.title.toLowerCase().includes(query.toLowerCase()),
    );
    const completed = visibleTasks.filter((task) => task.status === "completed").length;
    const progress = visibleTasks.filter((task) => task.status === "progress").length;
    const todo = visibleTasks.length - completed - progress;
    const circumference = 113.1;
    const completedArc = visibleTasks.length
        ? (completed / visibleTasks.length) * circumference
        : 0;
    const progressArc = visibleTasks.length ? (progress / visibleTasks.length) * circumference : 0;
    const ring = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g fill="none" stroke-width="5" transform="rotate(-90 24 24)"><circle cx="24" cy="24" r="18" stroke="#EDEEF5"/><circle cx="24" cy="24" r="18" stroke="#B9E5CF" stroke-dasharray="${completedArc} ${circumference}"/><circle cx="24" cy="24" r="18" stroke="#939BF2" stroke-dasharray="${progressArc} ${circumference}" stroke-dashoffset="-${completedArc}"/></g></svg>`;

    return (
        <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
            <ScrollView
                contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 28 }]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <ScreenHeader
                    action={
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={searching ? "Close task search" : "Search tasks"}
                            onPress={() => {
                                setSearching(!searching);
                                setQuery("");
                            }}
                            style={styles.iconButton}
                        >
                            <SettingsIcon
                                name={searching ? "close" : "search"}
                                size={21}
                                color={theme.text}
                            />
                        </Pressable>
                    }
                />

                <View style={styles.greeting}>
                    <Text style={styles.date}>
                        {now.toLocaleDateString("en-US", {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                        })}
                    </Text>
                    <Text style={styles.title}>
                        {firstName
                            ? `${period[0]!.toUpperCase()}${period.slice(1)}, ${firstName}`
                            : `Good ${period}`}{" "}
                        <Text style={styles.wave}>👋</Text>
                    </Text>
                </View>

                {searching && (
                    <TextInput
                        autoFocus
                        accessibilityLabel="Search your tasks"
                        placeholder="Find a task…"
                        placeholderTextColor={theme.muted}
                        value={query}
                        onChangeText={setQuery}
                        style={styles.search}
                        returnKeyType="search"
                    />
                )}

                <View style={styles.filters} role="tablist">
                    {categories.map((item) => (
                        <Pressable
                            key={item}
                            role="tab"
                            accessibilityState={{ selected: category === item }}
                            onPress={() => setCategory(item)}
                            style={[styles.filter, category === item && styles.selectedFilter]}
                        >
                            <Text
                                style={[
                                    styles.filterText,
                                    category === item && styles.selectedFilterText,
                                ]}
                            >
                                {item}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                <Text style={styles.sectionTitle}>
                    {visibleTasks.length} {visibleTasks.length === 1 ? "task" : "tasks"} for today
                </Text>
                <View style={styles.summary}>
                    <View
                        accessibilityRole="progressbar"
                        accessibilityLabel="Completed tasks"
                        accessibilityValue={{
                            min: 0,
                            max: Math.max(visibleTasks.length, 1),
                            now: completed,
                        }}
                    >
                        <Image
                            source={{ uri: `data:image/svg+xml;utf8,${encodeURIComponent(ring)}` }}
                            style={styles.ring}
                        />
                    </View>
                    {[
                        { count: completed, label: "completed", color: "#B9E5CF" },
                        { count: progress, label: "in progress", color: "#939BF2" },
                        { count: todo, label: "to do", color: "#DADCE7" },
                    ].map((item) => (
                        <View key={item.label} style={styles.stat}>
                            <View style={styles.statHeading}>
                                <View style={[styles.dot, { backgroundColor: item.color }]} />
                                <Text style={styles.statCount}>
                                    {item.count} {item.count === 1 ? "task" : "tasks"}
                                </Text>
                            </View>
                            <Text style={styles.statLabel}>{item.label}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.taskList}>
                    {visibleTasks.map((task) => (
                        <View key={task.id} style={styles.task}>
                            <View
                                style={[
                                    styles.taskAccent,
                                    {
                                        backgroundColor:
                                            task.category === "Personal" ? "#B6E5CB" : "#ADB5F6",
                                    },
                                ]}
                            />
                            <View style={styles.taskBody}>
                                <Text style={styles.taskTitle}>{task.title}</Text>
                                <Text style={styles.taskTime}>{task.time}</Text>
                            </View>
                            <Pressable
                                accessibilityRole="checkbox"
                                accessibilityLabel={`Complete ${task.title}`}
                                accessibilityState={{ checked: task.status === "completed" }}
                                hitSlop={12}
                                onPress={() =>
                                    setTasks((current) =>
                                        current.map((item) =>
                                            item.id === task.id
                                                ? {
                                                      ...item,
                                                      status:
                                                          item.status === "completed"
                                                              ? "todo"
                                                              : "completed",
                                                  }
                                                : item,
                                        ),
                                    )
                                }
                            >
                                <Ionicons
                                    name={
                                        task.status === "completed"
                                            ? "checkmark-circle"
                                            : "ellipse-outline"
                                    }
                                    size={22}
                                    color={task.status === "completed" ? "#858FE8" : "#D8DAE5"}
                                />
                            </Pressable>
                        </View>
                    ))}
                    {!visibleTasks.length && (
                        <Text style={styles.empty}>No tasks here. A little room to breathe.</Text>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: theme.background,
        backgroundImage: "linear-gradient(175deg, #E8E9FF, #F2F2F9 42%, #F7F7FB 78%)",
    },
    content: {
        width: "100%",
        maxWidth: 680,
        alignSelf: "center",
        padding: 24,
        paddingTop: 10,
        paddingBottom: 28,
    },
    iconButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: "#FFFFFFE6",
        alignItems: "center",
        justifyContent: "center",
    },
    greeting: { marginTop: 42, marginBottom: 25 },
    date: { fontFamily: "Inter-Regular", fontSize: 12, color: "#858596", marginBottom: 8 },
    title: {
        fontFamily: "Inter-Medium",
        fontSize: 27,
        lineHeight: 37,
        letterSpacing: -1,
        color: theme.text,
    },
    wave: { fontSize: 26 },
    search: {
        fontFamily: "Inter-Regular",
        fontSize: 14,
        backgroundColor: "#FFFFFFD9",
        color: theme.text,
        borderRadius: 18,
        paddingHorizontal: 16,
        paddingVertical: 13,
        marginBottom: 18,
    },
    filters: {
        flexDirection: "row",
        backgroundColor: "#FFFFFF36",
        borderRadius: 24,
        padding: 4,
        marginBottom: 27,
    },
    filter: { flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 21 },
    selectedFilter: { backgroundColor: "#FFFFFF", boxShadow: "0 2px 8px rgba(57,58,93,0.03)" },
    filterText: { fontFamily: "Inter-Regular", fontSize: 12, color: "#90909D" },
    selectedFilterText: { fontFamily: "Inter-Medium", color: theme.text },
    sectionTitle: {
        fontFamily: "Inter-Medium",
        fontSize: 19,
        letterSpacing: -0.5,
        color: theme.text,
        marginBottom: 15,
    },
    summary: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFFBD",
        borderRadius: 22,
        padding: 14,
        gap: 10,
        marginBottom: 24,
    },
    ring: { width: 46, height: 46 },
    stat: { flex: 1 },
    statHeading: { flexDirection: "row", alignItems: "center", gap: 4 },
    dot: { width: 5, height: 5, borderRadius: 3 },
    statCount: { fontFamily: "Inter-Medium", fontSize: 10, color: "#545465" },
    statLabel: {
        fontFamily: "Inter-Regular",
        fontSize: 9,
        color: "#A0A0AD",
        marginTop: 4,
        marginLeft: 9,
    },
    taskList: { gap: 12 },
    task: {
        minHeight: 80,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        paddingHorizontal: 18,
        paddingVertical: 17,
        gap: 12,
        boxShadow: "0 4px 14px rgba(45,46,75,0.025)",
    },
    taskAccent: { width: 3, height: 34, borderRadius: 2 },
    taskBody: { flex: 1 },
    taskTitle: { fontFamily: "Inter-Medium", fontSize: 13, lineHeight: 20, color: theme.text },
    taskTime: {
        fontFamily: "Inter-Regular",
        fontSize: 11,
        lineHeight: 17,
        color: "#A0A0AB",
        marginTop: 3,
    },
    empty: {
        fontFamily: "Inter-Regular",
        fontSize: 13,
        lineHeight: 22,
        color: theme.muted,
        textAlign: "center",
        paddingVertical: 40,
    },
});
