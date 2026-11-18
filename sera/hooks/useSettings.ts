import { useEffect, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { defaultPreferences, parsePreferences, type SettingsPreferences } from "../config/settings";
import { useAuthStore } from "../store/auth-store";

export function useSettings() {
    const userId = useAuthStore((state) => state.user?.id);
    const key = `sera.settings.${userId ?? "preview"}`;
    const [preferences, setPreferences] = useState(defaultPreferences);
    const [loadedKey, setLoadedKey] = useState<string | null>(null);
    const [saveError, setSaveError] = useState(false);
    const edited = useRef(false);

    useEffect(() => {
        let cancelled = false;
        edited.current = false;
        setSaveError(false);
        SecureStore.getItemAsync(key)
            .then((raw) => {
                if (cancelled) return;
                try {
                    setPreferences(parsePreferences(raw));
                } catch {
                    setPreferences({ ...defaultPreferences });
                }
                setLoadedKey(key);
            })
            .catch(() => {
                if (!cancelled) {
                    setPreferences({ ...defaultPreferences });
                    setLoadedKey(key);
                    setSaveError(true);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [key]);

    useEffect(() => {
        if (loadedKey !== key || !edited.current) return;
        let cancelled = false;
        SecureStore.setItemAsync(key, JSON.stringify(preferences))
            .then(() => {
                if (!cancelled) setSaveError(false);
            })
            .catch(() => {
                if (!cancelled) setSaveError(true);
            });
        return () => {
            cancelled = true;
        };
    }, [key, loadedKey, preferences]);

    function update<K extends keyof SettingsPreferences>(name: K, value: SettingsPreferences[K]) {
        if (loadedKey !== key) return;
        edited.current = true;
        setPreferences((current) => ({ ...current, [name]: value }));
    }

    return {
        preferences,
        update,
        isLoading: loadedKey !== key,
        saveError,
        reset: () => {
            edited.current = true;
            setPreferences({ ...defaultPreferences });
        },
    };
}
