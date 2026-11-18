// Android USB testing: adb reverse tcp:3333 tcp:3333.
// For Wi-Fi/iPad testing, set this to your HTTPS backend or tunnel URL.
export const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3333";
