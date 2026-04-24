import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  api, extractErrorMessage,
  type CreateUserPayload, type UserItem,
} from "@/src/lib/api";
import { formatDateTime, formatShortDate } from "@/src/lib/format";
import { useAuthGuard } from "@/src/hooks/use-auth-guard";
import {
  ActionButton,
  Card,
  EmptyState,
  ErrorBanner,
  FormSection,
  InputField,
  LoadingView,
  Page,
  SectionTitle,
  StatusBadge,
} from "@/src/components/ui";

type FormState = { email: string; firstName: string; lastName: string; password: string; phone: string };
const EMPTY: FormState = { email: "", firstName: "", lastName: "", password: "", phone: "" };

export default function ResellersScreen() {
  const guard = useAuthGuard();
  const qc    = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form,      setForm]      = useState<FormState>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);

  const patch = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }));

  const usersQuery = useQuery({
    queryKey: ["users", "resellers"],
    queryFn:  () => api.users.resellers(),
    refetchInterval: 30_000,
  });

  const createMut = useMutation({
    mutationFn: (p: CreateUserPayload) => api.users.create(p),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["users", "resellers"] });
      setShowCreate(false); setForm(EMPTY); setFormError(null);
    },
    onError: (e) => setFormError(extractErrorMessage(e)),
  });

  const statusMut = useMutation({
    mutationFn: (p: { id: string; action: "suspend" | "activate" }) =>
      p.action === "suspend" ? api.users.suspend(p.id) : api.users.activate(p.id),
    onSuccess: async () => qc.invalidateQueries({ queryKey: ["users", "resellers"] }),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => api.users.remove(id),
    onSuccess: async () => qc.invalidateQueries({ queryKey: ["users", "resellers"] }),
  });

  const users = usersQuery.data ?? [];
  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter((u) => u.status === "ACTIVE").length,
    suspended: users.filter((u) => u.status === "SUSPENDED").length,
  }), [users]);

  async function createReseller() {
    if (!form.email || !form.firstName || !form.lastName || !form.password) {
      setFormError("Tous les champs obligatoires doivent être remplis."); return;
    }
    if (form.password.length < 12) {
      setFormError("Le mot de passe doit contenir au moins 12 caractères."); return;
    }
    await createMut.mutateAsync({
      email: form.email.trim(), firstName: form.firstName.trim(),
      lastName: form.lastName.trim(), password: form.password,
      role: "RESELLER", phone: form.phone.trim() || undefined,
    });
  }

  function confirmRemove(user: UserItem) {
    Alert.alert("Supprimer le revendeur", `${user.firstName} ${user.lastName} sera supprimé.`, [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => removeMut.mutate(user.id) },
    ]);
  }

  if (!guard.isReady || guard.isBlocked) {
    return <Page scroll={false}><LoadingView label="Chargement des revendeurs..." /></Page>;
  }
  if (usersQuery.isLoading) {
    return <Page scroll={false}><LoadingView label="Chargement des revendeurs..." /></Page>;
  }
  if (usersQuery.error) {
    return <Page><ErrorBanner message="Impossible de charger les revendeurs." /></Page>;
  }

  return (
    <>
      <Page>
        <Card>
          <View style={S.summaryRow}>
            <View>
              <Text style={S.summaryCount}>{stats.total} revendeurs</Text>
              <Text style={S.summaryMeta}>{stats.active} actifs · {stats.suspended} suspendus</Text>
            </View>
            <ActionButton label="Ajouter" onPress={() => setShowCreate(true)} />
          </View>
        </Card>

        {users.length === 0 ? (
          <EmptyState title="Aucun revendeur" subtitle="Crée le premier compte revendeur." />
        ) : (
          users.map((user) => (
            <View key={user.id} style={S.userCard}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={S.userName}>{user.firstName} {user.lastName}</Text>
                  <Text style={S.userEmail}>{user.email}</Text>
                  <Text style={S.userMeta}>
                    {user.phone || "Sans tél."} · Depuis {formatShortDate(user.createdAt)}
                  </Text>
                  <Text style={S.userMeta}>
                    Connexion: {formatDateTime(user.lastLoginAt)}
                  </Text>
                </View>
                <StatusBadge status={user.status} />
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                <ActionButton
                  flex kind="ghost"
                  label={user.status === "ACTIVE" ? "Suspendre" : "Réactiver"}
                  onPress={() => statusMut.mutate({ id: user.id, action: user.status === "ACTIVE" ? "suspend" : "activate" })}
                  disabled={statusMut.isPending}
                />
                <ActionButton flex kind="danger" label="Supprimer"
                  onPress={() => confirmRemove(user)} disabled={removeMut.isPending} />
              </View>
            </View>
          ))
        )}
      </Page>

      <Modal visible={showCreate} animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <ScrollView
          style={S.modal}
          contentContainerStyle={S.modalContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={S.modalHeader}>
            <Text style={S.modalTitle}>Créer un revendeur</Text>
            <Pressable onPress={() => setShowCreate(false)} style={S.closeBtn} hitSlop={10}>
              <Text style={S.closeBtnText}>✕</Text>
            </Pressable>
          </View>
          {formError ? <ErrorBanner message={formError} /> : null}

          <FormSection title="Identité">
            <InputField label="Prénom *" value={form.firstName} onChangeText={(v) => patch({ firstName: v })} />
            <InputField label="Nom *"    value={form.lastName}  onChangeText={(v) => patch({ lastName: v })} />
            <InputField label="Email *"  value={form.email}     onChangeText={(v) => patch({ email: v })} keyboardType="email-address" />
            <InputField label="Téléphone" value={form.phone}    onChangeText={(v) => patch({ phone: v })} keyboardType="phone-pad" />
          </FormSection>

          <FormSection title="Accès">
            <InputField label="Mot de passe * (min. 12 car.)" value={form.password}
              onChangeText={(v) => patch({ password: v })} secureTextEntry />
          </FormSection>

          <ActionButton
            label={createMut.isPending ? "Création..." : "Créer le compte"}
            onPress={() => void createReseller()}
            disabled={createMut.isPending} loading={createMut.isPending}
          />
          <ActionButton kind="ghost" label="Annuler" onPress={() => setShowCreate(false)} />
        </ScrollView>
      </Modal>
    </>
  );
}

const S = StyleSheet.create({
  summaryRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryCount: { color: "#f0f5ff", fontSize: 17, fontWeight: "700" },
  summaryMeta:  { color: "#6b849f", fontSize: 12 },
  userCard:     { backgroundColor: "#0d1829", borderWidth: 1, borderColor: "#1e2f4a", borderRadius: 14, padding: 14, gap: 6 },
  userName:     { color: "#f0f5ff", fontWeight: "700", fontSize: 15 },
  userEmail:    { color: "#c4d3ef", fontSize: 13 },
  userMeta:     { color: "#6b849f", fontSize: 12 },
  modal:        { flex: 1, backgroundColor: "#060e1c" },
  modalContent: { padding: 16, paddingBottom: 40, gap: 14 },
  modalHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle:   { color: "#f0f5ff", fontSize: 18, fontWeight: "700", flex: 1 },
  closeBtn:     { padding: 4 },
  closeBtnText: { color: "#6b849f", fontSize: 20 },
});
