import { useState } from "react";
import { Text, View } from "react-native";
import {
  ActionButton,
  ErrorBanner,
  InputField,
  Page,
  SectionCard,
  SectionTitle,
} from "@/src/components/ui";
import { useAuth } from "@/src/providers/auth-provider";

export default function LoginScreen() {
  const auth = useAuth();
  const [email, setEmail] = useState("admin@mikroserver.ci");
  const [password, setPassword] = useState("");
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [apiUrl, setApiUrl] = useState(auth.apiBaseUrl);
  const [apiError, setApiError] = useState<string | null>(null);

  async function handleLogin() {
    try {
      await auth.login(email.trim(), password);
    } catch {
      // Message handled in provider
    }
  }

  async function saveApiUrl() {
    setApiError(null);
    try {
      await auth.updateApiBaseUrl(apiUrl);
      setShowApiConfig(false);
    } catch (error) {
      setApiError((error as Error).message);
    }
  }

  return (
    <Page>
      <SectionTitle
        title="MikroServer Native"
        subtitle="Connexion administrateur à la plateforme."
      />

      <SectionCard>
        {auth.error ? <ErrorBanner message={auth.error} /> : null}
        <InputField
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          placeholder="admin@mikroserver.ci"
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
        />
      </SectionCard>

      <SectionCard>
        <View style={{ gap: 8 }}>
          <Text style={{ color: "#d9e6fd", fontWeight: "700", fontSize: 14 }}>
            API active
          </Text>
          <Text style={{ color: "#9eb1d0", fontSize: 12 }}>{auth.apiBaseUrl}</Text>
          <ActionButton
            kind="secondary"
            label={showApiConfig ? "Masquer configuration API" : "Configurer API"}
            onPress={() => {
              setShowApiConfig((v) => !v);
              auth.clearError();
            }}
          />
        </View>

        {showApiConfig ? (
          <View style={{ gap: 8 }}>
            {apiError ? <ErrorBanner message={apiError} /> : null}
            <InputField
              label="Base URL API"
              value={apiUrl}
              onChangeText={setApiUrl}
              keyboardType="url"
              placeholder="http://139.84.241.27/proxy/api/v1"
            />
            <ActionButton
              label="Enregistrer l'URL API"
              onPress={() => void saveApiUrl()}
            />
          </View>
        ) : null}
      </SectionCard>
    </Page>
  );
}

