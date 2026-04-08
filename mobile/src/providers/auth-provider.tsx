import { useRouter } from "expo-router";
import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  api,
  bootstrapApiState,
  clearAuthTokens,
  type AuthenticatedUser,
  extractErrorMessage,
  getApiBaseUrl,
  getAuthTokens,
  setApiBaseUrl,
  setApiEventHandlers,
  setAuthTokens,
} from "@/src/lib/api";

type AuthContextValue = {
  isReady: boolean;
  isAuthenticated: boolean;
  isBusy: boolean;
  user: AuthenticatedUser | null;
  apiBaseUrl: string;
  error: string | null;
  clearError: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateApiBaseUrl: (value: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiBaseUrl, setApiBaseUrlState] = useState(getApiBaseUrl());

  useEffect(() => {
    let mounted = true;

    async function boot() {
      try {
        await bootstrapApiState();
        if (!mounted) {
          return;
        }

        setApiBaseUrlState(getApiBaseUrl());
        setApiEventHandlers({
          onUnauthorized: () => {
            setUser(null);
            router.replace("/login");
          },
          onTokensChanged: () => {
            setApiBaseUrlState(getApiBaseUrl());
          },
        });

        const tokens = getAuthTokens();
        if (!tokens) {
          setUser(null);
          return;
        }

        const profile = await api.auth.me();
        if (!mounted) {
          return;
        }
        setUser(profile);
      } catch {
        await clearAuthTokens();
        if (!mounted) {
          return;
        }
        setUser(null);
      } finally {
        if (mounted) {
          setIsReady(true);
        }
      }
    }

    void boot();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function login(email: string, password: string): Promise<void> {
    setIsBusy(true);
    setError(null);
    try {
      const result = await api.auth.login(email, password);
      await setAuthTokens({
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
      });
      setUser(result.user);
      router.replace("/home");
    } catch (authError) {
      setError(extractErrorMessage(authError));
      throw authError;
    } finally {
      setIsBusy(false);
    }
  }

  async function logout(): Promise<void> {
    setIsBusy(true);
    try {
      await api.auth.logout();
    } catch {
      // logout should continue even if API call fails
    } finally {
      await clearAuthTokens();
      setUser(null);
      setIsBusy(false);
      router.replace("/login");
    }
  }

  async function refreshProfile(): Promise<void> {
    const profile = await api.auth.me();
    setUser(profile);
  }

  async function updateApiBaseUrl(value: string): Promise<void> {
    const normalized = await setApiBaseUrl(value);
    setApiBaseUrlState(normalized);
  }

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      isReady,
      isAuthenticated: Boolean(user),
      isBusy,
      user,
      apiBaseUrl,
      error,
      clearError: () => setError(null),
      login,
      logout,
      refreshProfile,
      updateApiBaseUrl,
    }),
    [apiBaseUrl, error, isBusy, isReady, user],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}

