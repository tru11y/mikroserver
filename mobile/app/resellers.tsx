import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Modal, ScrollView, Text, View } from "react-native";
import {
  api,
  extractErrorMessage,
  type CreateUserPayload,
  type UserItem,
} from "@/src/lib/api";
import { formatDateTime, formatShortDate } from "@/src/lib/format";
import { useAuthGuard } from "@/src/hooks/use-auth-guard";
import {
  ActionButton,
  EmptyState,
  ErrorBanner,
  InputField,
  LoadingView,
  Page,
  SectionCard,
  SectionTitle,
} from "@/src/components/ui";

type FormState = {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  phone: string;
};

const EMPTY_FORM: FormState = {
  email: "",
  firstName: "",
  lastName: "",
  password: "",
  phone: "",
};

export default function ResellersScreen() {
  const guard = useAuthGuard();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ["users", "resellers"],
    queryFn: () => api.users.resellers(),
    refetchInterval: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateUserPayload) => api.users.create(payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["users", "resellers"] });
      setShowCreate(false);
      setForm(EMPTY_FORM);
      setFormError(null);
    },
    onError: (error) => setFormError(extractErrorMessage(error)),
  });

  const statusMutation = useMutation({
    mutationFn: async (payload: { id: string; action: "suspend" | "activate" }) => {
      if (payload.action === "suspend") {
        return api.users.suspend(payload.id);
      }
      return api.users.activate(payload.id);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["users", "resellers"] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.users.remove(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["users", "resellers"] });
    },
  });

  const users = usersQuery.data ?? [];
  const stats = useMemo(() => {
    const active = users.filter((user) => user.status === "ACTIVE").length;
    const suspended = users.filter((user) => user.status === "SUSPENDED").length;
    return { total: users.length, active, suspended };
  }, [users]);

  async function createReseller() {
    if (!form.email || !form.firstName || !form.lastName || !form.password) {
      setFormError("Tous les champs obligatoires doivent être remplis.");
      return;
    }

    if (form.password.length < 12) {
      setFormError("Le mot de passe doit contenir au moins 12 caractères.");
      return;
    }

    await createMutation.mutateAsync({
      email: form.email.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      password: form.password,
      role: "RESELLER",
      phone: form.phone.trim() || undefined,
    });
  }

  function confirmRemove(user: UserItem) {
    Alert.alert(
      "Supprimer le revendeur",
      `${user.firstName} ${user.lastName} sera supprimé.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => removeMutation.mutate(user.id),
        },
      ],
    );
  }

  if (!guard.isReady || guard.isBlocked) {
    return (
      <Page scroll={false}>
        <LoadingView label="Chargement des revendeurs..." />
      </Page>
    );
  }

  if (usersQuery.isLoading) {
    return (
      <Page scroll={false}>
        <LoadingView label="Chargement des revendeurs..." />
      </Page>
    );
  }

  if (usersQuery.error) {
    return (
      <Page>
        <ErrorBanner message="Impossible de charger les revendeurs." />
      </Page>
    );
  }

  return (
    <Page>
      <SectionTitle
        title="Revendeurs"
        subtitle={`${stats.total} comptes · ${stats.active} actifs · ${stats.suspended} suspendus`}
      />

      <SectionCard>
        <ActionButton label="Nouveau revendeur" onPress={() => setShowCreate(true)} />
      </SectionCard>

      {users.length === 0 ? (
        <EmptyState title="Aucun revendeur" subtitle="Crée le premier compte revendeur." />
      ) : (
        <SectionCard>
          {users.map((user) => (
            <View
              key={user.id}
              style={{
                borderWidth: 1,
                borderColor: "#2a3f5e",
                borderRadius: 10,
                padding: 10,
                marginBottom: 8,
                gap: 4,
              }}
            >
              <Text style={{ color: "#eef5ff", fontWeight: "700", fontSize: 14 }}>
                {user.firstName} {user.lastName}
              </Text>
              <Text style={{ color: "#bed0ec", fontSize: 13 }}>{user.email}</Text>
              <Text style={{ color: "#97adcf", fontSize: 12 }}>
                {user.phone || "Sans téléphone"} · {user.status}
              </Text>
              <Text style={{ color: "#8197bc", fontSize: 12 }}>
                Dernière connexion: {formatDateTime(user.lastLoginAt)} · Créé le{" "}
                {formatShortDate(user.createdAt)}
              </Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                {user.status === "ACTIVE" ? (
                  <ActionButton
                    kind="secondary"
                    label="Suspendre"
                    onPress={() => statusMutation.mutate({ id: user.id, action: "suspend" })}
                    disabled={statusMutation.isPending}
                  />
                ) : (
                  <ActionButton
                    kind="secondary"
                    label="Réactiver"
                    onPress={() => statusMutation.mutate({ id: user.id, action: "activate" })}
                    disabled={statusMutation.isPending}
                  />
                )}
                <ActionButton
                  kind="danger"
                  label="Supprimer"
                  onPress={() => confirmRemove(user)}
                  disabled={removeMutation.isPending}
                />
              </View>
            </View>
          ))}
        </SectionCard>
      )}

      <Modal visible={showCreate} animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <ScrollView
          style={{ flex: 1, backgroundColor: "#0b1018" }}
          contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <SectionTitle title="Créer un revendeur" />
          <SectionCard>
            {formError ? <ErrorBanner message={formError} /> : null}
            <InputField
              label="Prénom"
              value={form.firstName}
              onChangeText={(value) => setForm((f) => ({ ...f, firstName: value }))}
            />
            <InputField
              label="Nom"
              value={form.lastName}
              onChangeText={(value) => setForm((f) => ({ ...f, lastName: value }))}
            />
            <InputField
              label="Email"
              value={form.email}
              onChangeText={(value) => setForm((f) => ({ ...f, email: value }))}
              keyboardType="email-address"
            />
            <InputField
              label="Téléphone"
              value={form.phone}
              onChangeText={(value) => setForm((f) => ({ ...f, phone: value }))}
              keyboardType="phone-pad"
            />
            <InputField
              label="Mot de passe"
              value={form.password}
              onChangeText={(value) => setForm((f) => ({ ...f, password: value }))}
              secureTextEntry
            />
            <ActionButton
              label={createMutation.isPending ? "Création..." : "Créer le compte"}
              onPress={() => void createReseller()}
              disabled={createMutation.isPending}
            />
            <ActionButton kind="secondary" label="Fermer" onPress={() => setShowCreate(false)} />
          </SectionCard>
        </ScrollView>
      </Modal>
    </Page>
  );
}

