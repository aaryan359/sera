import type { ReactNode } from "react";
import type { ColorValue, StyleProp, TextStyle } from "react-native";
import type { AndroidGlassViewProps } from "./AndroidGlassView.types";
export type AndroidGlassBottomTabsProps = AndroidGlassViewProps & {
  selectedIndex?: number;
  onTabSelected?: (index: number) => void;
  minimized?: boolean;
  onMinimizedChange?: (minimized: boolean) => void;
  accentColor?: ColorValue;
  containerColor?: ColorValue;
  opacity?: number;
};
export type AndroidGlassTabProps = { icon?: ReactNode; label?: string; labelStyle?: StyleProp<TextStyle> };
