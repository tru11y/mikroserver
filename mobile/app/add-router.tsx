import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthGuard } from "@/src/hooks/use-auth-guard";
import {
  ActionButton,
  Card,
  InputField,
  Page,
  StatusBadge,
} from "@/src/components/ui";
import { MikroTikLanClient } from "@/src/services/mikrotik-lan/MikroTikLanClient";
import {
  OnboardingOrchestrator,
  type OnboardingProgress,
  type OnboardingStepName,
} from "@/src/services/onboarding/OnboardingOrchestrator";
import { extractErrorMessage } from "@/src/lib/api";

type Form = {
  address: string;
  port: string;
  username: string;
  password: string;
  name: string;
  comment: string;
};

const EMPTY_FORM: Form = {
  address: "192.168.88.1",
  port: "80",
  username: "admin",
  password: "",
  name: "",
  comment: "",
};

const STEP_LABELS: Record<OnboardingStepName, string> = {
  "connect-lan": "Connexion au routeur…",
  "fetch-metadata": "Récupération des informations…",
  "allocate-tunnel": "Allocation du tunnel VPN…",
  "configure-wireguard": "Configuration WireGuard…",
  "create-agent-user": "Création du compte agent…",
  "finalize-backend": "Enregistrement sur le serveur…",
  "install-beacon": "Installation du beacon santé…",
};

const ALL_STEPS: OnboardingStepName[] = [
  "connect-lan",
  "fetch-metadata",
  "allocate-tunnel",
  "configure-wireguard",
  "create-agent-user",
  "finalize-backend",
  "install-beacon",
];

export default function AddRouterScreen() {
  const guard = useAuthGuard();
  const nav = useRouter();
  const qc = useQueryClient();

  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const patch = (p: Partial<Form>) =>
    setForm((f) => ({ ...f, ...p }));

  const canSubmit =
    !running &&
    form.address.trim().length > 0 &&
    form.username.trim().length > 0 &&
    form.name.trim().length > 0;

  const startOnboarding = useCallback(async () => {
    setRunning(true);
    setError(null);
    setProgress(null);

    const client = new MikroTikLanClient({
      host: form.address.trim(),
      port: Number(form.port) || 80,
      username: form.username.trim(),
      password: form.password,
    });

    const orchestrator = new OnboardingOrchestrator(client);
    orchestrator.onProgressUpdate((p) => setProgress({ ...p }));

    try {
      const result = await orchestrator.run({
        host: form.address.trim(),
        port: Number(form.port) || 80,
        username: form.username.trim(),
        password: form.password,
        name: form.name.trim(),
        comment: form.comment.trim() || undefined,
      });

      qc.invalidateQueries({ queryKey: ["routers"] });
      Alert.alert(
        "Routeur ajouté",
        `"${form.name}" est connecté et prêt.`,
        [
          {
            text: "OK",
            onPress: () => nav.back(),
          },
        ],
      );
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setRunning(false);
    }
  }, [form, nav, qc]);

  if (!guard.ready) return null;

  return (
    <Page title="Ajouter un routeur">
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <Card>
          <Text style={styles.sectionTitle}>Connexion locale</Text>
          <Text style={styles.hint}>
            Connectez-vous au WiFi du routeur puis renseignez les informations
            ci-dessous.
          </Text>

          <InputField
            label="Adresse IP du routeur"
            value={form.address}
            onChangeText={(v) => patch({ address: v })}
            placeholder="192.168.88.1"
            keyboardType="numeric"
            editable={!running}
          />
          <InputField
            label="Port REST API"
            value={form.port}
            onChangeText={(v) => patch({ port: v })}
            placeholder="80"
            keyboardType="numeric"
            editable={!running}
          />
          <InputField
            label="Nom d'utilisateur"
            value={form.username}
            onChangeText={(v) => patch({ username: v })}
            placeholder="admin"
            autoCapitalize="none"
            editable={!running}
          />
          <InputField
            label="Mot de passe"
            value={form.password}
            onChangeText={(v) => patch({ password: v })}
            placeholder="Mot de passe du routeur"
            secureTextEntry
            editable={!running}
          />

          <View style={styles.separator} />

          <Text style={styles.sectionTitle}>Informations</Text>
          <InputField
            label="Nom du routeur"
            value={form.name}
            onChangeText={(v) => patch({ name: v })}
            placeholder="Cybercafé Plateau"
            editable={!running}
          />
          <InputField
            label="Commentaire (optionnel)"
            value={form.comment}
            onChangeText={(v) => patch({ comment: v })}
            placeholder="Notes ou emplacement"
            editable={!running}
          />
        </Card>

        {/* Progress steps */}
        {progress && (
          <Card>
            <Text style={styles.sectionTitle}>
              Onboarding en cours
            </Text>
            {ALL_STEPS.map((step) => {
              const done = progress.completedSteps.includes(step);
              const current = progress.currentStep === step;
              const failed =
                progress.error?.step === step;
              return (
                <View key={step} style={styles.stepRow}>
                  <View style={styles.stepIcon}>
                    {done && <Text style={styles.checkmark}>✓</Text>}
                    {current && !failed && (
                      <ActivityIndicator size="small" color="#6366f1" />
                    )}
                    {failed && <Text style={styles.cross}>✗</Text>}
                    {!done && !current && !failed && (
                      <View style={styles.dot} />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.stepLabel,
                      done && styles.stepDone,
                      failed && styles.stepFailed,
                    ]}
                  >
                    {STEP_LABELS[step]}
                  </Text>
                </View>
              );
            })}
          </Card>
        )}

        {/* Error */}
        {error && (
          <Card>
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        )}

        {/* Submit */}
        <View style={styles.buttonRow}>
          <ActionButton
            label={running ? "Onboarding en cours…" : "Connecter le routeur"}
            onPress={startOnboarding}
            disabled={!canSubmit}
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#e2e8f0",
    marginBottom: 8,
  },
  hint: {
    fontSize: 13,
    color: "#94a3b8",
    marginBottom: 12,
    lineHeight: 18,
  },
  separator: { height: 16 },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    gap: 10,
  },
  stepIcon: { width: 24, alignItems: "center" },
  checkmark: { color: "#22c55e", fontSize: 16, fontWeight: "700" },
  cross: { color: "#ef4444", fontSize: 16, fontWeight: "700" },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#475569",
  },
  stepLabel: { fontSize: 14, color: "#cbd5e1" },
  stepDone: { color: "#22c55e" },
  stepFailed: { color: "#ef4444" },
  errorText: { color: "#ef4444", fontSize: 14, lineHeight: 20 },
  buttonRow: { paddingHorizontal: 4 },
});
