import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  ActionButton,
  Card,
  ErrorBanner,
  InputField,
  Page,
} from "@/src/components/ui";
import { useAuth } from "@/src/providers/auth-provider";

export default function LoginScreen() {
  const auth = useAuth();
  const [email,    setEmail]    = useState("admin@mikroserver.ci");
  const [password, setPassword] = useState("");
  const [showApi,  setShowApi]  = useState(false);
  const [apiUrl,   setApiUrl]   = useState(auth.apiBaseUrl);
  const [apiError, setApiError] = useState<string | null>(null);

  async function handleLogin() {
    try { await auth.login(email.trim(), password); } catch { /* handled in provider */ }
  }

  async function saveApiUrl() {
    setApiError(null);
    try { await auth.updateApiBaseUrl(apiUrl); setShowApi(false); }
    catch (e) { setApiError((e as Error).message); }
  }

  return (
    <Page>
      {/* ── Logo ─────────────────────────────────────── */}
      <View style={S.hero}>
        <View style={S.logoWrap}>
          <View style={S.logoOuter}>
            <View style={S.logoMiddle}>
              <View style={S.logoDot} />
            </View>
          </View>
        </View>
        <Text style={S.appName}>MikroServer</Text>
        <Text style={S.appSub}>Console d'administration WiFi</Text>
      </View>

      {/* ── Login form ───────────────────────────────── */}
      <Card>
        {auth.error ? <ErrorBanner message={auth.error} /> : null}
        <InputField
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          placeholder="admin@example.com"
        />
        <InputField
          label="Mot de passe"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
        />
        <ActionButton
          label={auth.isBusy ? "Connexion..." : "Se connecter"}
          onPress={() => void handleLogin()}
          disabled={auth.isBusy || !email || !password}
          loading={auth.isBusy}
        />
      </Card>

      {/* ── API config (collapsed by default) ────────── */}
      <Card>
        <Pressable
          onPress={() => { setShowApi((v) => !v); auth.clearError(); }}
          style={S.apiToggle}
        >
          <View style={{ flex: 1 }}>
            <Text style={S.apiToggleLabel}>Serveur API</Text>
            <Text style={S.apiToggleUrl} numberOfLines={1}>{auth.apiBaseUrl}</Text>
          </View>
          <Text style={S.apiChevron}>{showApi ? "▲" : "▼"}</Text>
        </Pressable>

        {showApi && (
          <View style={S.apiForm}>
            {apiError ? <ErrorBanner message={apiError} /> : null}
            <InputField
              label="URL de base de l'API"
              value={apiUrl}
              onChangeText={setApiUrl}
              keyboardType="url"
              placeholder="http://139.84.241.27/proxy/api/v1"
              hint="Accepte IP:port, domaine ou URL complète"
            />
            <ActionButton
              label="Enregistrer l'URL"
              onPress={() => void saveApiUrl()}
            />
          </View>
        )}
      </Card>
    </Page>
  );
}

const S = StyleSheet.create({
  hero:       { alignItems: "center", paddingVertical: 32, gap: 10 },

  // Simple geometric WiFi logo (pure React Native, no SVG dep)
  logoWrap:   { marginBottom: 8 },
  logoOuter:  {
    width: 72, height: 72,
    borderRadius: 20,
    backgroundColor: "#0d1829",
    borderWidth: 2, borderColor: "#2e3f6e",
    alignItems: "center", justifyContent: "center",
  },
  logoMiddle: {
    width: 36, height: 36,
    borderRadius: 18,
    borderWidth: 3, borderColor: "#6366f1",
    borderBottomColor: "transparent",
    borderLeftColor: "transparent",
    transform: [{ rotate: "225deg" }],
    alignItems: "center", justifyContent: "center",
  },
  logoDot:    {
    width: 10, height: 10,
    borderRadius: 5,
    backgroundColor: "#a5b4fc",
    transform: [{ rotate: "-225deg" }],
  },

  appName:    { color: "#f0f5ff", fontSize: 26, fontWeight: "700", letterSpacing: -0.5 },
  appSub:     { color: "#6b849f", fontSize: 14 },

  apiToggle:  { flexDirection: "row", alignItems: "center", gap: 10 },
  apiToggleLabel: { color: "#6b849f", fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  apiToggleUrl: { color: "#c4d3ef", fontSize: 12, marginTop: 2 },
  apiChevron: { color: "#3d5070", fontSize: 12 },
  apiForm:    { gap: 10, marginTop: 4 },
});
