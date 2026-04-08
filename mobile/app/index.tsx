import { useRouter } from "expo-router";
import { useEffect } from "react";
import { LoadingView, Page } from "@/src/components/ui";
import { useAuth } from "@/src/providers/auth-provider";

export default function EntryScreen() {
  const router = useRouter();
  const auth = useAuth();

  useEffect(() => {
    if (!auth.isReady) {
      return;
    }

    if (auth.isAuthenticated) {
      router.replace("/home");
      return;
    }

    router.replace("/login");
  }, [auth.isAuthenticated, auth.isReady, router]);

  return (
    <Page scroll={false}>
      <LoadingView label="Initialisation de MikroServer..." />
    </Page>
  );
}

