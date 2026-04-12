import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api, extractErrorMessage, type SettingsMap } from "@/src/lib/api";
import { formatDateTime } from "@/src/lib/format";
import { useAuthGuard } from "@/src/hooks/use-auth-guard";
import { useAuth } from "@/src/providers/auth-provider";
import {
  ActionButton,
  Card,
  ErrorBanner,
  FormSection,
  InputField,
  LoadingView,
  Page,
  SectionTitle,
  SuccessBanner,
} from "@/src/components/ui";

type FieldConfig = { key: string; label: string; description?: string; isSecret?: boolean };

const BUSINESS_FIELDS: FieldConfig[] = [
  { key: "business.name",    label: "Nom de la plateforme" },
  { key: "business.country", label: "Pays (code ISO)" },
  { key: "business.phone",   label: "Téléphone de contact" },
];
const WAVE_FIELDS: FieldConfig[] = [
  { key: "wave.merchant_name",  label: "Nom du marchand Wave" },
  { key: "wave.api_key",        label: "Clé API Wave",          description: "Commence par wave_sn_ ou wave_ci_", isSecret: true },
  { key: "wave.webhook_secret", label: "Secret webhook Wave",   description: "Signature HMAC-SHA256",             isSecret: true },
];
const HOTSPOT_FIELDS: FieldConfig[] = [
  { key: "hotspot.default_profile", label: "Profil hotspot par défaut" },
  { key: "hotspot.default_server",  label: "Serveur hotspot par défaut" },
];

function SecretInput({
  label, description, value, onChangeText, editable,
}: {
  label: string; description?: string; value: string;
  onChangeText: (v: string) => void; editable: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <View style={S.field}>
      <Text style={S.fieldLabel}>{label}</Text>
      {description ? <Text style={S.fieldHint}>{description}</Text> : null}
      <View style={{ position: "relative", justifyContent: "center" }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          editable={editable}
          secureTextEntry={!show}
          autoCorrect={false}
          autoCapitalize="none"
          style={[S.fieldInput, !editable && { opacity: 0.6 }]}
          placeholderTextColor="#6b849f"
        />
        <Pressable onPress={() => setShow((c) => !c)} style={S.eyeBtn}>
          <Text style={S.eyeText}>{show ? "Masquer" : "Afficher"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function buildInitialForm(settings: SettingsMap): Record<string, string> {
  return Object.fromEntries(Object.entries(settings).map(([k, e]) => [k, e.value]));
}

export default function SettingsScreen() {
  const guard = useAuthGuard();
  const auth  = useAuth();
  const qc    = useQueryClient();
  const [form,           setForm]           = useState<Record<string, string>>({});
  const [saved,          setSaved]          = useState(false);
  const [actionError,    setActionError]    = useState<string | null>(null);
  const [profileForm,    setProfileForm]    = useState({ firstName: "", lastName: "", phone: "" });
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileSaved,   setProfileSaved]   = useState(false);
  const [profileError,   setProfileError]   = useState<string | null>(null);
  const [pwForm,  setPwForm]  = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);

  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: () => api.settings.get() });

  useEffect(() => {
    if (!settingsQuery.data) return;
    setForm((c) => Object.keys(c).length > 0 ? c : buildInitialForm(settingsQuery.data!));
  }, [settingsQuery.data]);

  useEffect(() => {
    if (auth.user && !profileEditing) {
      setProfileForm({ firstName: auth.user.firstName, lastName: auth.user.lastName, phone: "" });
    }
  }, [auth.user]);

  const canEdit = auth.user?.role === "SUPER_ADMIN";

  const updateMut = useMutation({
    mutationFn: (p: Record<string, string>) => api.settings.update(p),
    onMutate:  () => { setActionError(null); setSaved(false); },
    onSuccess: async (next) => { setSaved(true); setForm(buildInitialForm(next)); await qc.invalidateQueries({ queryKey: ["settings"] }); },
    onError:   (e) => setActionError(extractErrorMessage(e)),
  });

  const profileMut = useMutation({
    mutationFn: (data: { firstName?: string; lastName?: string; phone?: string }) => api.auth.updateProfile(data),
    onMutate:  () => { setProfileError(null); setProfileSaved(false); },
    onSuccess: async () => { setProfileSaved(true); setProfileEditing(false); await auth.refreshProfile(); },
    onError:   (e) => setProfileError(extractErrorMessage(e)),
  });

  const changePwMut = useMutation({
    mutationFn: (p: { current: string; next: string }) => api.auth.changePassword(p.current, p.next),
    onMutate:  () => { setPwError(null); setPwSaved(false); },
    onSuccess: () => { setPwSaved(true); setPwForm({ current: "", next: "", confirm: "" }); },
    onError:   (e) => setPwError(extractErrorMessage(e)),
  });

  const updatedAt = useMemo(() => {
    if (!settingsQuery.dataUpdatedAt) return "—";
    return new Date(settingsQuery.dataUpdatedAt).toLocaleTimeString("fr-FR");
  }, [settingsQuery.dataUpdatedAt]);

  const setValue = (key: string, value: string) => setForm((c) => ({ ...c, [key]: value }));

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
      <SectionTitle title="Paramètres" subtitle={`Synchro ${updatedAt}`} />

      {/* ── Profil ──────────────────────────────── */}
      <FormSection title="Profil administrateur">
        {profileError ? <ErrorBanner message={profileError} /> : null}
        {profileSaved ? <SuccessBanner message="Profil mis à jour." /> : null}
        {!profileEditing ? (
          <View style={{ gap: 6 }}>
            {auth.user ? (
              <>
                <KV label="Nom complet" value={`${auth.user.firstName} ${auth.user.lastName}`} />
                <KV label="Email"        value={auth.user.email} />
                <KV label="Rôle"         value={auth.user.role} />
                <KV label="Connexion"    value={formatDateTime(auth.user.lastLoginAt)} />
              </>
            ) : null}
            <ActionButton kind="secondary" label="Modifier le profil"
              onPress={() => { setProfileEditing(true); setProfileSaved(false); setProfileError(null); setProfileForm({ firstName: auth.user?.firstName ?? "", lastName: auth.user?.lastName ?? "", phone: "" }); }} />
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <InputField label="Prénom" value={profileForm.firstName} onChangeText={(v) => setProfileForm((f) => ({ ...f, firstName: v }))} />
            <InputField label="Nom"    value={profileForm.lastName}  onChangeText={(v) => setProfileForm((f) => ({ ...f, lastName: v }))} />
            <InputField label="Téléphone (optionnel)" value={profileForm.phone} onChangeText={(v) => setProfileForm((f) => ({ ...f, phone: v }))} keyboardType="phone-pad" />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <ActionButton flex label={profileMut.isPending ? "Sauvegarde..." : "Enregistrer"}
                onPress={() => void profileMut.mutateAsync({ firstName: profileForm.firstName.trim() || undefined, lastName: profileForm.lastName.trim() || undefined, phone: profileForm.phone.trim() || undefined })}
                disabled={profileMut.isPending} />
              <ActionButton flex kind="ghost" label="Annuler" onPress={() => setProfileEditing(false)} />
            </View>
          </View>
        )}
      </FormSection>

      {/* ── Mot de passe ─────────────────────── */}
      <FormSection title="Changer le mot de passe">
        {pwError ? <ErrorBanner message={pwError} /> : null}
        {pwSaved ? <SuccessBanner message="Mot de passe changé. Toutes les sessions ont été révoquées." /> : null}
        <InputField label="Mot de passe actuel" value={pwForm.current}  onChangeText={(v) => setPwForm((f) => ({ ...f, current: v }))} secureTextEntry />
        <InputField label="Nouveau mot de passe (min. 12)"  value={pwForm.next}    onChangeText={(v) => setPwForm((f) => ({ ...f, next: v }))}    secureTextEntry />
        <InputField label="Confirmer le nouveau"           value={pwForm.confirm} onChangeText={(v) => setPwForm((f) => ({ ...f, confirm: v }))} secureTextEntry />
        <ActionButton
          label={changePwMut.isPending ? "Changement..." : "Changer le mot de passe"}
          onPress={() => {
            if (pwForm.next !== pwForm.confirm) { setPwError("Les mots de passe ne correspondent pas."); return; }
            if (pwForm.next.length < 12) { setPwError("Minimum 12 caractères."); return; }
            void changePwMut.mutateAsync({ current: pwForm.current, next: pwForm.next });
          }}
          disabled={changePwMut.isPending || !pwForm.current || !pwForm.next}
        />
      </FormSection>

      {/* ── Paramètres plateforme ─────────────── */}
      {!canEdit ? (
        <ErrorBanner message="Mode lecture seule — seul un super administrateur peut modifier ces paramètres." />
      ) : null}
      {actionError ? <ErrorBanner message={actionError} /> : null}
      {saved ? <SuccessBanner message="Paramètres sauvegardés." /> : null}

      <FormSection title="Informations business">
        {BUSINESS_FIELDS.map((field) => (
          <InputField key={field.key} label={field.label}
            value={form[field.key] ?? ""}
            onChangeText={(v) => setValue(field.key, v)}
            editable={canEdit}
          />
        ))}
      </FormSection>

      <FormSection title="Compte Wave CI" subtitle="Paiements mobile money">
        {WAVE_FIELDS.map((field) => field.isSecret ? (
          <SecretInput key={field.key} label={field.label} description={field.description}
            value={form[field.key] ?? ""} onChangeText={(v) => setValue(field.key, v)} editable={canEdit} />
        ) : (
          <InputField key={field.key} label={field.label}
            value={form[field.key] ?? ""} onChangeText={(v) => setValue(field.key, v)} editable={canEdit} />
        ))}
      </FormSection>

      <FormSection title="Hotspot par défaut" subtitle="Pré-remplissage nouveau routeur">
        {HOTSPOT_FIELDS.map((field) => (
          <InputField key={field.key} label={field.label}
            value={form[field.key] ?? ""} onChangeText={(v) => setValue(field.key, v)} editable={canEdit} />
        ))}
      </FormSection>

      <Card>
        <Text style={S.infraTitle}>Infrastructure WireGuard</Text>
        {[
          "Serveur VPS: 10.66.66.1",
          "Plage routeurs: 10.66.66.2+",
          "Port API RouterOS: 8728",
          "Protocole: WireGuard UDP",
        ].map((line) => (
          <Text key={line} style={S.infraLine}>{line}</Text>
        ))}
        <Text style={S.infraHint}>
          Chaque routeur MikroTik doit être connecté en WireGuard et exposer l&apos;API RouterOS.
        </Text>
      </Card>

      <Card>
        <ActionButton
          label={updateMut.isPending ? "Sauvegarde..." : "Sauvegarder les paramètres"}
          onPress={() => void updateMut.mutateAsync(form)}
          disabled={!canEdit || updateMut.isPending}
          loading={updateMut.isPending}
        />
      </Card>
    </Page>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <Text style={S.kvLabel}>{label}</Text>
      <Text style={S.kvValue}>{value}</Text>
    </View>
  );
}

const S = StyleSheet.create({
  field:      { gap: 4 },
  fieldLabel: { color: "#c4d3ef", fontSize: 12, fontWeight: "700" },
  fieldHint:  { color: "#6b849f", fontSize: 11 },
  fieldInput: {
    borderRadius: 10, borderWidth: 1, borderColor: "#1e2f4a", backgroundColor: "#060e1c",
    color: "#f0f5ff", paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, paddingRight: 90,
  },
  eyeBtn:  { position: "absolute", right: 8, borderWidth: 1, borderColor: "#1e2f4a", borderRadius: 8, backgroundColor: "#0d1829", paddingHorizontal: 8, paddingVertical: 4 },
  eyeText: { color: "#6b849f", fontSize: 11, fontWeight: "700" },
  kvLabel: { color: "#6b849f", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, minWidth: 90 },
  kvValue: { color: "#f0f5ff", fontSize: 13, fontWeight: "600", flex: 1 },
  infraTitle: { color: "#c4d3ef", fontSize: 12, fontWeight: "700", marginBottom: 6 },
  infraLine:  { color: "#6b849f", fontSize: 12 },
  infraHint:  { color: "#4a617e", fontSize: 11, marginTop: 6 },
});
