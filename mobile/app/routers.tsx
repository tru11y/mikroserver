import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Alert, Modal, ScrollView, Text, View } from "react-native";
import {
  api,
  extractErrorMessage,
  type CreateRouterPayload,
  type RouterItem,
  type UpdateRouterPayload,
} from "@/src/lib/api";
import { formatDateTime } from "@/src/lib/format";
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

type RouterForm = {
  name: string;
  description: string;
  location: string;
  wireguardIp: string;
  apiPort: string;
  apiUsername: string;
  apiPassword: string;
  hotspotProfile: string;
  hotspotServer: string;
};

const EMPTY_FORM: RouterForm = {
  name: "",
  description: "",
  location: "",
  wireguardIp: "",
  apiPort: "8728",
  apiUsername: "admin",
  apiPassword: "",
  hotspotProfile: "default",
  hotspotServer: "hotspot1",
};

function toCreatePayload(form: RouterForm): CreateRouterPayload {
  return {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    location: form.location.trim() || undefined,
    wireguardIp: form.wireguardIp.trim(),
    apiPort: Number(form.apiPort || 8728),
    apiUsername: form.apiUsername.trim(),
    apiPassword: form.apiPassword,
    hotspotProfile: form.hotspotProfile.trim() || undefined,
    hotspotServer: form.hotspotServer.trim() || undefined,
  };
}

function toUpdatePayload(form: RouterForm): UpdateRouterPayload {
  return {
    name: form.name.trim() || undefined,
    description: form.description.trim() || undefined,
    location: form.location.trim() || undefined,
    apiUsername: form.apiUsername.trim() || undefined,
    apiPassword: form.apiPassword.trim() || undefined,
    hotspotProfile: form.hotspotProfile.trim() || undefined,
    hotspotServer: form.hotspotServer.trim() || undefined,
  };
}

function fromRouter(router: RouterItem): RouterForm {
  return {
    name: router.name,
    description: router.description ?? "",
    location: router.location ?? "",
    wireguardIp: router.wireguardIp,
    apiPort: String(router.apiPort),
    apiUsername: router.apiUsername,
    apiPassword: "",
    hotspotProfile: router.hotspotProfile,
    hotspotServer: router.hotspotServer,
  };
}

export default function RoutersScreen() {
  const guard = useAuthGuard();
  const expoRouter = useRouter();
  const qc = useQueryClient();
  const [showEditor, setShowEditor] = useState(false);
  const [editingRouter, setEditingRouter] = useState<RouterItem | null>(null);
  const [form, setForm] = useState<RouterForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const routersQuery = useQuery({
    queryKey: ["routers"],
    queryFn: () => api.routers.list(),
    refetchInterval: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateRouterPayload) => api.routers.create(payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["routers"] });
      setShowEditor(false);
      setEditingRouter(null);
      setForm(EMPTY_FORM);
      setFormError(null);
    },
    onError: (error) => setFormError(extractErrorMessage(error)),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; data: UpdateRouterPayload }) =>
      api.routers.update(payload.id, payload.data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["routers"] });
      setShowEditor(false);
      setEditingRouter(null);
      setForm(EMPTY_FORM);
      setFormError(null);
    },
    onError: (error) => setFormError(extractErrorMessage(error)),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.routers.remove(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["routers"] });
    },
  });

  const healthMutation = useMutation({
    mutationFn: (id: string) => api.routers.healthCheck(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["routers"] });
    },
  });

  function openCreate() {
    setEditingRouter(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowEditor(true);
  }

  function openEdit(router: RouterItem) {
    setEditingRouter(router);
    setForm(fromRouter(router));
    setFormError(null);
    setShowEditor(true);
  }

  async function saveRouter() {
    if (!form.name || !form.apiUsername || (!editingRouter && !form.apiPassword)) {
      setFormError("Nom, utilisateur API et mot de passe sont obligatoires.");
      return;
    }

    if (editingRouter) {
      await updateMutation.mutateAsync({
        id: editingRouter.id,
        data: toUpdatePayload(form),
      });
      return;
    }

    if (!form.wireguardIp) {
      setFormError("IP WireGuard obligatoire.");
      return;
    }

    await createMutation.mutateAsync(toCreatePayload(form));
  }

  function confirmDelete(router: RouterItem) {
    Alert.alert("Supprimer routeur", `Supprimer ${router.name} ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => removeMutation.mutate(router.id),
      },
    ]);
  }

  if (!guard.isReady || guard.isBlocked) {
    return (
      <Page scroll={false}>
        <LoadingView label="Chargement des routeurs..." />
      </Page>
    );
  }

  if (routersQuery.isLoading) {
    return (
      <Page scroll={false}>
        <LoadingView label="Chargement des routeurs..." />
      </Page>
    );
  }

  if (routersQuery.error) {
    return (
      <Page>
        <ErrorBanner message="Impossible de charger les routeurs." />
      </Page>
    );
  }

  const routers = routersQuery.data ?? [];
  const online = routers.filter((router) => router.status === "ONLINE").length;

  return (
    <Page>
      <SectionTitle
        title="Routeurs"
        subtitle={`${routers.length} total · ${online} en ligne`}
      />

      <SectionCard>
        <ActionButton label="Ajouter un routeur" onPress={openCreate} />
      </SectionCard>

      {routers.length === 0 ? (
        <EmptyState title="Aucun routeur configuré" subtitle="Ajoute ton premier routeur MikroTik." />
      ) : (
        <SectionCard>
          {routers.map((router) => (
            <View
              key={router.id}
              style={{
                borderWidth: 1,
                borderColor: "#2a3f5e",
                borderRadius: 10,
                padding: 10,
                marginBottom: 8,
                gap: 4,
              }}
            >
              <Text style={{ color: "#edf5ff", fontWeight: "700", fontSize: 14 }}>
                {router.name}
              </Text>
              <Text style={{ color: "#bdd0ef", fontSize: 12 }}>
                {router.status} · {router.wireguardIp}:{router.apiPort}
              </Text>
              <Text style={{ color: "#97abc9", fontSize: 12 }}>
                {router.location || "Sans localisation"} · Dernier seen:{" "}
                {formatDateTime(router.lastSeenAt)}
              </Text>

              <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                <ActionButton
                  kind="secondary"
                  label="Détail live"
                  onPress={() => expoRouter.push(`/router/${router.id}`)}
                />
                <ActionButton
                  kind="secondary"
                  label="Health check"
                  onPress={() => healthMutation.mutate(router.id)}
                  disabled={healthMutation.isPending}
                />
              </View>

              <View style={{ flexDirection: "row", gap: 8 }}>
                <ActionButton kind="secondary" label="Modifier" onPress={() => openEdit(router)} />
                <ActionButton
                  kind="danger"
                  label="Supprimer"
                  onPress={() => confirmDelete(router)}
                  disabled={removeMutation.isPending}
                />
              </View>
            </View>
          ))}
        </SectionCard>
      )}

      <Modal visible={showEditor} animationType="slide" onRequestClose={() => setShowEditor(false)}>
        <ScrollView
          style={{ flex: 1, backgroundColor: "#0b1018" }}
          contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <SectionTitle title={editingRouter ? "Modifier routeur" : "Nouveau routeur"} />
          <SectionCard>
            {formError ? <ErrorBanner message={formError} /> : null}
            <InputField
              label="Nom"
              value={form.name}
              onChangeText={(value) => setForm((f) => ({ ...f, name: value }))}
            />
            {!editingRouter ? (
              <InputField
                label="IP WireGuard"
                value={form.wireguardIp}
                onChangeText={(value) => setForm((f) => ({ ...f, wireguardIp: value }))}
              />
            ) : null}
            {!editingRouter ? (
              <InputField
                label="Port API"
                value={form.apiPort}
                onChangeText={(value) => setForm((f) => ({ ...f, apiPort: value }))}
                keyboardType="numeric"
              />
            ) : null}
            <InputField
              label="Utilisateur API"
              value={form.apiUsername}
              onChangeText={(value) => setForm((f) => ({ ...f, apiUsername: value }))}
            />
            <InputField
              label={editingRouter ? "Nouveau mot de passe API (optionnel)" : "Mot de passe API"}
              value={form.apiPassword}
              onChangeText={(value) => setForm((f) => ({ ...f, apiPassword: value }))}
              secureTextEntry
            />
            <InputField
              label="Localisation"
              value={form.location}
              onChangeText={(value) => setForm((f) => ({ ...f, location: value }))}
            />
            <InputField
              label="Description"
              value={form.description}
              onChangeText={(value) => setForm((f) => ({ ...f, description: value }))}
            />
            <InputField
              label="Profil hotspot"
              value={form.hotspotProfile}
              onChangeText={(value) => setForm((f) => ({ ...f, hotspotProfile: value }))}
            />
            <InputField
              label="Serveur hotspot"
              value={form.hotspotServer}
              onChangeText={(value) => setForm((f) => ({ ...f, hotspotServer: value }))}
            />
            <ActionButton
              label={createMutation.isPending || updateMutation.isPending ? "Sauvegarde..." : "Enregistrer"}
              onPress={() => void saveRouter()}
              disabled={createMutation.isPending || updateMutation.isPending}
            />
            <ActionButton kind="secondary" label="Fermer" onPress={() => setShowEditor(false)} />
          </SectionCard>
        </ScrollView>
      </Modal>
    </Page>
  );
}

