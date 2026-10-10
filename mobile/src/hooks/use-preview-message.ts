import { Alert, Platform } from "react-native";

export function usePreviewMessage() {
  return (message: string) => {
    if (Platform.OS === "web") globalThis.alert(message);
    else Alert.alert("Podyum", message);
  };
}
