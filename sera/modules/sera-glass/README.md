# Sera glass (Android)

Local Expo module used **only by the tab bar and toast**. Screens, cards, buttons, chat bubbles and switches use ordinary React Native views.

Based on [expo-android-glass-view 1.0.2](https://github.com/kagantemizkan/expo-android-glass-view), with its surface, bottom tabs, backdrop capture and shader dependencies. Button, toggle, slider and menu implementations are excluded. The original Apache 2.0 license and upstream MIT/Apache notices are included here.

Sera changes:
- Local module/namespace `SeraGlass` / `expo.modules.seraglass`.
- Unthemed tabs disable the material color filter, rather than silently using the light/dark tint.
- Gesture handlers dispatch user selections directly; the selection observer animates the droplet and handles external navigation without emitting another event.
- A faint accent and refracting rim replace the resting gray selection fill.
- Only a tab bar and a visible toast capture the backdrop. A 3 dp blur preserves detail under the refracting rim.

Copying code is not inherently faster. The main performance improvement is removing screen-wide captures and keeping the droplet animation native. Tab scenes mount ahead of the first tap and use a short shift transition.

Rebuild after changing Kotlin or adding this module:

```sh
npx expo run:android
```

Expo autolinks local modules from `modules/`. No generated Android project edits are needed. An older development build uses the plain fallback until rebuilt. Android 13+ supports the full refraction shader, Android 12 supports blur, and older devices use the fallback. iOS uses the existing Expo glass surface when available.

Clear glass reflects actual content behind it. Sera's pale backgrounds naturally produce a subtle effect; colorful content produces a stronger refraction like the repository demo.
