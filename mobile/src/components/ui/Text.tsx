import { Text as NativeText, type TextProps } from "react-native";
import { colors, fonts } from "@/theme";

export function Text({ style, ...props }: TextProps) {
  return (
    <NativeText
      {...props}
      style={[
        { color: colors.text, fontFamily: fonts.regular, fontSize: 15 },
        style,
      ]}
    />
  );
}
