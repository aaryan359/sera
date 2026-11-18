package expo.modules.seraglass

import android.view.View
import androidx.compose.ui.graphics.Color
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.views.ViewDefinitionBuilder

class SeraGlassModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SeraGlass")

    // Bumped when the backdrop capture changes in a way JS may need to know about.
    // 2: ancestors of a sampling glass view are never drawn again through their own draw()
    //    (0.1.1 crashed inside react-native-screens stacks).
    Constant("captureRevision") { 3 }

    View(AndroidGlassView::class) {
      Name("AndroidGlassView")
      Prop("theme") { view: AndroidGlassView, value: String? ->
        view.glassState.themed = value != null
        view.glassState.dark = value == "dark"
      }

      Prop("cornerRadius") { view: AndroidGlassView, value: Float? ->
        view.glassState.cornerRadius = value ?: GlassState.DEFAULT_CORNER_RADIUS
      }
      Prop("blurGradient") { view: AndroidGlassView, value: String? ->
        view.glassState.blurGradient = value == "top-to-bottom"
      }
      Prop("blurRadius") { view: AndroidGlassView, value: Float? ->
        view.glassState.blurOverride = value
      }
      Prop("refractionHeight") { view: AndroidGlassView, value: Float? ->
        view.glassState.heightOverride = value
      }
      Prop("refractionAmount") { view: AndroidGlassView, value: Float? ->
        view.glassState.amountOverride = value
      }
      Prop("chromaticAberration") { view: AndroidGlassView, value: Boolean? ->
        view.glassState.chromaticAberration = value ?: false
      }
      Prop("depthEffect") { view: AndroidGlassView, value: Boolean? ->
        view.glassState.depthEffect = value ?: false
      }
      Prop("vibrancy") { view: AndroidGlassView, value: Boolean? ->
        view.glassState.vibrancyOverride = value
      }
      Prop("highlight") { view: AndroidGlassView, value: Boolean? ->
        view.glassState.highlight = value ?: true
      }
      Prop("shadow") { view: AndroidGlassView, value: Boolean? ->
        view.glassState.shadow = value ?: true
      }
      // Colours arrive as ARGB ints from processColor() on the JS side.
      Prop("tintColor") { view: AndroidGlassView, value: Int? ->
        view.glassState.tintColor = value.toColorOr(Color.Unspecified)
      }
      Prop("surfaceColor") { view: AndroidGlassView, value: Int? ->
        view.glassState.surfaceColor = value.toColorOr(Color.Unspecified)
      }
      Prop("fallbackColor") { view: AndroidGlassView, value: Int? ->
        view.glassState.fallbackOverride = value?.let { Color(it) }
      }

      ReactChildren()
    }

    View(AndroidGlassBottomTabs::class) {
      Name("AndroidGlassBottomTabs")
      Prop("cornerRadius") { view: AndroidGlassBottomTabs, value: Float? ->
        view.glassState.cornerRadius = value ?: 999f
      }
      Prop("blurGradient") { view: AndroidGlassBottomTabs, value: String? ->
        view.glassState.blurGradient = value == "top-to-bottom"
      }
      Prop("blurRadius") { view: AndroidGlassBottomTabs, value: Float? ->
        view.glassState.blurOverride = value
      }
      Prop("refractionHeight") { view: AndroidGlassBottomTabs, value: Float? ->
        view.glassState.heightOverride = value
      }
      Prop("refractionAmount") { view: AndroidGlassBottomTabs, value: Float? ->
        view.glassState.amountOverride = value
      }
      Prop("chromaticAberration") { view: AndroidGlassBottomTabs, value: Boolean? ->
        view.glassState.chromaticAberration = value ?: false
      }
      Prop("depthEffect") { view: AndroidGlassBottomTabs, value: Boolean? ->
        view.glassState.depthEffect = value ?: false
      }
      Prop("vibrancy") { view: AndroidGlassBottomTabs, value: Boolean? ->
        view.glassState.vibrancyOverride = value
      }
      Prop("highlight") { view: AndroidGlassBottomTabs, value: Boolean? ->
        view.glassState.highlight = value ?: true
      }
      Prop("shadow") { view: AndroidGlassBottomTabs, value: Boolean? ->
        view.glassState.shadow = value ?: true
      }
      Prop("tintColor") { view: AndroidGlassBottomTabs, value: Int? ->
        view.glassState.tintColor = value.toColorOr(Color.Unspecified)
      }
      Prop("surfaceColor") { view: AndroidGlassBottomTabs, value: Int? ->
        view.glassState.surfaceColor = value.toColorOr(Color.Unspecified)
      }
      Prop("fallbackColor") { view: AndroidGlassBottomTabs, value: Int? ->
        view.glassState.fallbackOverride = value?.let { Color(it) }
      }
      Prop("theme") { view: AndroidGlassBottomTabs, value: String? -> view.glassState.themed = value != null; view.glassState.dark = value == "dark" }
      Events("onTabSelected", "onMinimizedChange")

      Prop("minimized") { view: AndroidGlassBottomTabs, value: Boolean? ->
        view.setMinimizedProp(value ?: false)
      }
      Prop("selectedIndex") { view: AndroidGlassBottomTabs, value: Int? ->
        view.selectedIndexProp.value = value ?: 0
      }
      Prop("mostRecentEventCount") { view: AndroidGlassBottomTabs, value: Int? ->
        view.selectedIndexProp.mostRecentEventCount = value ?: 0
      }
      Prop("tabsCount") { view: AndroidGlassBottomTabs, value: Int? ->
        view.tabsCount = value ?: 1
      }
      Prop("accentColor") { view: AndroidGlassBottomTabs, value: Int? ->
        view.accentColor = value?.let { Color(it) }
      }
      Prop("containerColor") { view: AndroidGlassBottomTabs, value: Int? ->
        view.containerColor = value?.let { Color(it) }
      }

      OnViewDidUpdateProps { view: AndroidGlassBottomTabs ->
        view.applyProps()
      }

      ReactChildren()
    }
  }
}

private fun Int?.toColorOr(default: Color): Color = if (this != null) Color(this) else default

/** React children live after the Compose layer; see GlassHostView. */
private inline fun <reified T : GlassHostView> ViewDefinitionBuilder<T>.ReactChildren() {
  GroupView<T> {
    AddChildView { parent, child: View, index ->
      parent.addReactChild(child, index)
    }
    GetChildCount { parent ->
      parent.reactChildCount
    }
    GetChildViewAt { parent, index ->
      parent.getReactChildAt(index)
    }
    RemoveChildView { parent, child: View ->
      parent.removeReactChild(child)
    }
    RemoveChildViewAt { parent, index ->
      parent.removeReactChildAt(index)
    }
  }
}
