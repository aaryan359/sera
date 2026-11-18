import { Image } from "expo-image";

const assets = {
    account: require("../assets/icons/settings/user-round.svg"),
    notifications: require("../assets/icons/settings/bell.svg"),
    connectors: require("../assets/icons/settings/plug-zap.svg"),
    routines: require("../assets/icons/settings/repeat-2.svg"),
    activity: require("../assets/icons/settings/clock-3.svg"),
    shield: require("../assets/icons/settings/shield-check.svg"),
    help: require("../assets/icons/settings/life-buoy.svg"),
    logout: require("../assets/icons/settings/log-out.svg"),
    right: require("../assets/icons/settings/chevron-right.svg"),
    back: require("../assets/icons/settings/chevron-left.svg"),
    stats: require("../assets/icons/settings/chart-no-axes-combined.svg"),
    conversations: require("../assets/icons/settings/message-square.svg"),
    completed: require("../assets/icons/settings/circle-check.svg"),
    pending: require("../assets/icons/settings/clock-3.svg"),
    tokens: require("../assets/icons/settings/coins.svg"),
    close: require("../assets/icons/settings/x.svg"),
    check: require("../assets/icons/settings/check.svg"),
    circle: require("../assets/icons/settings/circle.svg"),
    info: require("../assets/icons/settings/info.svg"),
    reset: require("../assets/icons/settings/rotate-ccw.svg"),
    moon: require("../assets/icons/settings/moon.svg"),
    search: require("../assets/icons/settings/search.svg"),
    morning: require("../assets/icons/settings/sun.svg"),
    calendar: require("../assets/icons/settings/calendar-days.svg"),
    tasks: require("../assets/icons/settings/list-checks.svg"),
    gmail: require("../assets/icons/providers/gmail.png"),
    googleCalendar: require("../assets/icons/providers/google-calendar.png"),
    googleDrive: require("../assets/icons/providers/google-drive.png"),
    googleContacts: require("../assets/icons/providers/google-contacts.png"),
};

export type SettingsIconName = keyof typeof assets;

export function SettingsIcon({
    name,
    size = 21,
    color,
}: {
    name: SettingsIconName;
    size?: number;
    color?: string;
}) {
    return (
        <Image
            source={assets[name]}
            contentFit="contain"
            tintColor={color}
            style={{ width: size, height: size }}
            accessible={false}
        />
    );
}
