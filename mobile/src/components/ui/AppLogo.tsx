import { Image } from "react-native";

const logo = require("../../../assets/brand/logo.png");

export function AppLogo({ size = 56 }: { size?: number }) {
  return (
    <Image
      source={logo}
      accessibilityLabel="Podyum logosu"
      resizeMode="contain"
      style={{ width: size, height: size }}
    />
  );
}
