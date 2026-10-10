import { useLocalSearchParams, router } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { BackButton } from "@/components/ui/BackButton";
import { EmailVerificationForm } from "../components/EmailVerificationForm";

export function VerifyEmailScreen() {
  const params = useLocalSearchParams<{
    email?: string;
    token?: string;
    onboarding?: string;
  }>();
  return (
    <Screen>
      <BackButton />
      <EmailVerificationForm
        email={typeof params.email === "string" ? params.email : ""}
        initialToken={typeof params.token === "string" ? params.token : ""}
        onContinue={() =>
          router.replace({
            pathname: "/auth/login",
            params: { onboarding: params.onboarding === "1" ? "1" : "0" },
          })
        }
      />
    </Screen>
  );
}
