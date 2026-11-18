/*
 * Copyright 2025 Kyant (https://github.com/Kyant0/AndroidLiquidGlass)
 * Licensed under the Apache License, Version 2.0. See THIRD_PARTY_NOTICES.md.
 *
 * Vendored into expo-android-glass-view. Changes from upstream: package relocated
 * from com.kyant.backdrop, Kotlin Multiplatform expect/actual merged into Android-only
 * code, dependency on io.github.kyant0:shapes removed, Kotlin 2.1 compatible syntax.
 */
package expo.modules.seraglass.backdrop.effects

import androidx.compose.ui.graphics.RenderEffect
import expo.modules.seraglass.backdrop.BackdropEffectScope
import expo.modules.seraglass.backdrop.RuntimeShader
import expo.modules.seraglass.backdrop.internal.RuntimeShaderEffect
import expo.modules.seraglass.backdrop.internal.chain
import expo.modules.seraglass.backdrop.isRenderEffectSupported
import expo.modules.seraglass.backdrop.isRuntimeShaderSupported
import kotlin.contracts.ExperimentalContracts

fun BackdropEffectScope.effect(effect: RenderEffect) {
    if (!isRenderEffectSupported()) return

    renderEffect = renderEffect.chain(effect)
}

@OptIn(ExperimentalContracts::class)
fun BackdropEffectScope.runtimeShaderEffect(
    key: String,
    shaderString: String,
    uniformShaderName: String,
    block: RuntimeShader.() -> Unit
) {
    if (!isRuntimeShaderSupported()) return

    val effect =
        RuntimeShaderEffect(
            runtimeShader = obtainRuntimeShader(key, shaderString).apply(block),
            uniformShaderName = uniformShaderName
        )
    renderEffect = renderEffect.chain(effect)
}
