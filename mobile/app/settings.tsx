import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api, extractErrorMessage, type SettingsMap } from "@/src/lib/api";
import { formatDateTime } from "@/src/lib/format";
import { useAuthGuard } from "@/src/hooks/use-auth-guard";
import { useAuth } from "@/src/providers/auth-provider";
import {
  ActionButton,
  ErrorBanner,
  InputField,
  LoadingView,
  Page,
  SectionCard,
  SectionTitle,
} from "@/src/components/ui";

type FieldConfig = {
  key: string;
  label: string;
  description?: string;
  isSecret?: boolean;
};

const BUSINESS_FIELDS: FieldConfig[] = [
  { key: "business.name", label: "Nom de la plateforme" },
  { key: "business.country", label: "Pays (code ISO)" },
  { key: "business.phone", label: "Téléphone de contact" },
];

const WAVE_FIELDS: FieldConfig[] = [
  { key: "wave.merchant_name", label: "Nom du marchand Wave" },
  { key: "wave.api_key", label: "Clé API Wave", description: "Commence par wave_sn_ ou wave_ci_", isSecret: true },
  { key: "wave.webhook_secret", label: "Secret webhook Wave", description: "Signature HMAC-SHA256", isSecret: true },
];

const HOTSPOT_FIELDS: FieldConfig[] = [
  { key: "hotspot.default_profile", label: "Profil hotspot par défaut" },
  { key: "hotspot.default_server", label: "Serveur hotspot par défaut" },
];

function SettingsInput({
  label, description, value, onChangeText, editable, secureTextEntry = false,
}: {
  label: string; description?: string; value: string;
  onChangeText: (value: string) => void; editable: boolean; secureTextEntry?: boolean;
}) {
  const [showSecret, setShowSecret] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {description ? <Text style={styles.fieldDescription}>{description}</Text> : null}
      <View style={styles.fieldInputWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          editable={editable}
          secureTextEntry={secureTextEntry && !showSecret}
          autoCorrect={false}
          autoCapitalize="none"
          style={[styles.fieldInput, !editable && styles.fieldInputReadonly]}
          placeholderTextColor="#8a96ad"
        />
        {secureTextEntry ? (
          <Pressable onPress={() => setShowSecret((c) => !c)} style={styles.eyeButton}>
            <Text style={styles.eyeButtonText}>{showSecret ? "Masquer" : "Afficher"}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function buildInitialForm(settings: SettingsMap): Record<string, string> {
  return Object.fromEntries(Object.entries(settings).map(([key, entry]) => [key, entry.value]));
}

export default function SettingsScreen() {
  const guard = useAuthGuard();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Profile edit state
  const [profileForm, setProfileForm] = useState({ firstName: "", lastName: "", phone: "" });
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Change password state
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.settings.get(),
  });

  useEffect(() => {
    if (!settingsQuery.data) return;
    setForm((current) => (Object.keys(current).length > 0 ? current : buildInitialForm(settingsQuery.data)));
  }, [settingsQuery.data]);

  // Init profile form from auth user
  useEffect(() => {
    if (auth.user && !profileEditing) {
      setProfileForm({
        firstName: auth.user.firstName,
        lastName: auth.user.lastName,
        phone: "",
      });
    }
  }, [auth.user]);

  const canEdit = auth.user?.role === "SUPER_ADMIN";

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, string>) => api.settings.update(payload),
    onMutate: () => { setActionError(null); setSaved(false); },
    onSuccess: async (nextSettings) => {
      setSaved(true);
      setForm(buildInitialForm(nextSettings));
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error) => setActionError(extractErrorMessage(error)),
  });

  const profileMutation = useMutation({
    mutationFn: (data: { firstName?: string; lastName?: string; phone?: string }) =>
      api.auth.updateProfile(data),
    onMutate: () => { setProfileError(null); setProfileSaved(false); },
    onSuccess: async (updatedUser) => {
      setProfileSaved(true);
      setProfileEditing(false);
      await auth.refreshProfile();
    },
    onError: (error) => setProfileError(extractErrorMessage(error)),
  });

  const changePwMutation = useMutation({
    mutationFn: ({ current, next }: { current: string; next: string }) =>
      api.auth.changePassword(current, next),
    onMutate: () => { setPwError(null); setPwSaved(false); },
    onSuccess: () => {
      setPwSaved(true);
      setPwForm({ current: "", next: "", confirm: "" });
    },
    onError: (error) => setPwError(extractErrorMessage(error)),
  });

  const updatedAtLabel = useMemo(() => {
    if (!settingsQuery.dataUpdatedAt) return "—";
    return new Date(settingsQuery.dataUpdatedAt).toLocaleTimeString("fr-FR");
  }, [settingsQuery.dataUpdatedAt]);

  function setValue(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function saveSettings() {
    if (!canEdit) return;
    void updateMutation.mutateAsync(form);
  }

  function saveProfile() {
    const data: { firstName?: string; lastName?: string; phone?: string } = {};
    if (profileForm.firstName.trim()) data.firstName = profileForm.firstName.trim();
    if (profileForm.lastName.trim()) data.lastName = profileForm.lastName.trim();
    if (profileForm.phone.trim()) data.phone = profileForm.phone.trim();
    void profileMutation.mutateAsync(data);
  }

  function changePassword() {
    if (pwForm.next !== pwForm.confirm) {
      setPwError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (pwForm.next.length < 12) {
      setPwError("Le nouveau mot de passe doit faire au moins 12 caractères.");
      return;
    }
    void changePwMutation.mutateAsync({ current: pwForm.current, next: pwForm.next });
  }

  if (!guard.isReady || guard.isBlocked) {
    return <Page scroll={false}><LoadingView label="Chargement des paramètres..." /></Page>;
  }

  if (settingsQuery.isLoading) {
    return <Page scroll={false}><LoadingView label="Chargement des paramètres..." /></Page>;
  }

  if (settingsQuery.error || !settingsQuery.data) {
    return <Page><ErrorBanner message="Impossible de charger les paramètres." /></Page>;
  }

  return (
    <Page>
      <SectionTitle title="Paramètres" subtitle={`Dernière synchro ${updatedAtLabel}`} />

      {/* ---- Profil administrateur ---- */}
      <SectionCard>
        <SectionTitle title="Profil administrateur" />

        {profileError ? <ErrorBanner message={profileError} /> : null}
        {profileSaved ? (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>Profil mis à jour.</Text>
          </View>
        ) : null}

        {!profileEditing ? (
          <View style={{ gap: 8 }}>
            <Text style={styles.profileLabel}>Nom complet</Text>
            <Text style={styles.profileValue}>
              {auth.user ? `${auth.user.firstName} ${auth.user.lastName}` : "—"}
            </Text>
            <Text style={styles.profileLabel}>Email</Text>
            <Text style={styles.profileValue}>{auth.user?.email ?? "—"}</Text>
            <Text style={styles.profileLabel}>Rôle</Text>
            <Text style={styles.profileValue}>{auth.user?.role ?? "—"}</Text>
            <Text style={styles.profileLabel}>Dernière connexion</Text>
            <Text style={styles.profileValue}>{formatDateTime(auth.user?.lastLoginAt)}</Text>
            <ActionButton
              kind="secondary"
              label="Modifier le profil"
              onPress={() => {
                setProfileEditing(true);
                setProfileSaved(false);
                setProfileError(null);
                setProfileForm({
                  firstName: auth.user?.firstName ?? "",
                  lastName: auth.user?.lastName ?? "",
                  phone: "",
                });
              }}
            />
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <InputField
              label="Prénom"
              value={profileForm.firstName}
              onChangeText={(v) => setProfileForm((f) => ({ ...f, firstName: v }))}
            />
            <InputField
              label="Nom"
              value={profileForm.lastName}
              onChangeText={(v) => setProfileForm((f) => ({ ...f, lastName: v }))}
            />
            <InputField
              label="Téléphone (optionnel)"
              value={profileForm.phone}
              onChangeText={(v) => setProfileForm((f) => ({ ...f, phone: v }))}
              keyboardType="phone-pad"
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <ActionButton
                label={profileMutation.isPending ? "Sauvegarde..." : "Enregistrer"}
                onPress={saveProfile}
                disabled={profileMutation.isPending}
              />
              <ActionButton
                kind="secondary"
                label="Annuler"
                onPress={() => setProfileEditing(false)}
              />
            </View>
          </View>
        )}
      </SectionCard>

      {/* ---- Changer le mot de passe ---- */}
      <SectionCard>
        <SectionTitle title="Changer le mot de passe" />

        {pwError ? <ErrorBanner message={pwError} /> : null}
        {pwSaved ? (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>Mot de passe changé. Toutes les sessions ont été révoquées.</Text>
          </View>
        ) : null}

        <InputField
          label="Mot de passe actuel"
          value={pwForm.current}
          onChangeText={(v) => setPwForm((f) => ({ ...f, current: v }))}
          secureTextEntry
        />
        <InputField
          label="Nouveau mot de passe (min. 12 caractères)"
          value={pwForm.next}
          onChangeText={(v) => setPwForm((f) => ({ ...f, next: v }))}
          secureTextEntry
        />
        <InputField
          label="Confirmer le nouveau mot de passe"
          value={pwForm.confirm}
          onChangeText={(v) => setPwForm((f) => ({ ...f, confirm: v }))}
          secureTextEntry
        />
        <ActionButton
          label={changePwMutation.isPending ? "Changement..." : "Changer le mot de passe"}
          onPress={changePassword}
          disabled={changePwMutation.isPending || !pwForm.current || !pwForm.next}
        />
      </SectionCard>

      {/* ---- Settings platform ---- */}
      {!canEdit ? (
        <ErrorBanner message="Mode lecture seule: seul un super administrateur peut modifier ces paramètres." />
      ) : null}
      {actionError ? <ErrorBanner message={actionError} /> : null}
      {saved ? (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>Paramètres sauvegardés.</Text>
        </View>
      ) : null}

      <SectionCard>
        <SectionTitle title="Informations business" />
        <View style={{ gap: 10 }}>
          {BUSINESS_FIELDS.map((field) => (
            <SettingsInput
              key={field.key}
              label={field.label}
              description={field.description}
              value={form[field.key] ?? ""}
              onChangeText={(value) => setValue(field.key, value)}
              editable={canEdit}
            />
          ))}
        </View>
      </SectionCard>

      <SectionCard>
        <SectionTitle title="Compte Wave CI" subtitle="Paiements mobile money" />
        <View style={{ gap: 10 }}>
          {WAVE_FIELDS.map((field) => (
            <SettingsInput
              key={field.key}
              label={field.label}
              description={field.description}
              value={form[field.key] ?? ""}
              onChangeText={(value) => setValue(field.key, value)}
              secureTextEntry={field.isSecret}
              editable={canEdit}
            />
          ))}
        </View>
      </SectionCard>

      <SectionCard>
        <SectionTitle title="Hotspot par défaut" subtitle="Pré-remplissage nouveau routeur" />
        <View style={{ gap: 10 }}>
          {HOTSPOT_FIELDS.map((field) => (
            <SettingsInput
              key={field.key}
              label={field.label}
              description={field.description}
              value={form[field.key] ?? ""}
              onChangeText={(value) => setValue(field.key, value)}
              editable={canEdit}
            />
          ))}
        </View>
      </SectionCard>

      <SectionCard>
        <SectionTitle title="Infrastructure WireGuard" />
        <View style={{ gap: 6 }}>
          <Text style={styles.infraLine}>Serveur VPS: 10.66.66.1</Text>
          <Text style={styles.infraLine}>Plage routeurs: 10.66.66.2+</Text>
          <Text style={styles.infraLine}>Port API RouterOS: 8728</Text>
          <Text style={styles.infraLine}>Protocole: WireGuard UDP</Text>
          <Text style={styles.infraHint}>
            Chaque routeur MikroTik doit être connecté en WireGuard et exposer l&apos;API RouterOS.
          </Text>
        </View>
      </SectionCard>

      <SectionCard>
        <ActionButton
          label={updateMutation.isPending ? "Sauvegarde..." : "Sauvegarder les paramètres"}
          onPress={saveSettings}
          disabled={!canEdit || updateMutation.isPending}
        />
      </SectionCard>
    </Page>
  );
}

const styles = StyleSheet.create({
  field: { gap: 4 },
  fieldLabel: { color: "#d7e5fc", fontSize: 12, fontWeight: "700" },
  fieldDescription: { color: "#96abc9", fontSize: 12 },
  fieldInputWrap: { position: "relative", justifyContent: "center" },
  fieldInput: {
    borderRadius: 10, borderWidth: 1, borderColor: "#2f4668", backgroundColor: "#0a1422",
    color: "#f2f7ff", paddingHorizontal: 10, paddingVertical: 10, fontSize: 14, paddingRight: 88,
  },
  fieldInputReadonly: { opacity: 0.75 },
  eyeButton: {
    position: "absolute", right: 8, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, borderWidth: 1, borderColor: "#334a6b", backgroundColor: "#132139",
  },
  eyeButtonText: { color: "#c5d7f3", fontSize: 11, fontWeight: "700" },
  profileLabel: { color: "#93a8ca", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  profileValue: { color: "#e8f1ff", fontSize: 14, fontWeight: "600" },
  infraLine: { color: "#d6e4fc", fontSize: 12 },
  infraHint: { color: "#95abcc", fontSize: 12, marginTop: 4 },
  successBanner: {
    borderWidth: 1, borderColor: "#2f704d", backgroundColor: "#143625",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
  },
  successText: { color: "#9ff0c8", fontSize: 13 },
});
