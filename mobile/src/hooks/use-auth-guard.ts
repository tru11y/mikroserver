import { useRouter } from "expo-router";
import { useEffect } from "react";
import { useAuth } from "@/src/providers/auth-provider";

export function useAuthGuard() {
  const router = useRouter();
  const auth = useAuth();

  useEffect(() => {
    if (!auth.isReady) {
      return;
    }

    if (!auth.isAuthenticated) {
      router.replace("/login");
    }
  }, [auth.isAuthenticated, auth.isReady, router]);

  return {
    isBlocked: auth.isReady && !auth.isAuthenticated,
    isReady: auth.isReady,
  };
}

