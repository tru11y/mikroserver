import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
  Card,
  Divider,
  EmptyState,
  ErrorBanner,
  FormSection,
  InputField,
  LoadingView,
  Page,
  Row,
  StatusBadge,
} from "@/src/components/ui";

// ─── Types ────────────────────────────────────────────────────────────────────

type RouterForm = {
  name:           string;
  description:    string;
  location:       string;
  wireguardIp:    string;
  apiPort:        string;
  apiUsername:    string;
  apiPassword:    string;
  hotspotProfile: string;
  hotspotServer:  string;
};

const EMPTY: RouterForm = {
  name: "", description: "", location: "",
  wireguardIp: "", apiPort: "8728",
  apiUsername: "admin", apiPassword: "",
  hotspotProfile: "default", hotspotServer: "hotspot1",
};

function toCreate(f: RouterForm): CreateRouterPayload {
  return {
    name:           f.name.trim(),
    description:    f.description.trim() || undefined,
    location:       f.location.trim()    || undefined,
    wireguardIp:    f.wireguardIp.trim(),
    apiPort:        Number(f.apiPort || 8728),
    apiUsername:    f.apiUsername.trim(),
    apiPassword:    f.apiPassword,
    hotspotProfile: f.hotspotProfile.trim() || undefined,
    hotspotServer:  f.hotspotServer.trim()  || undefined,
  };
}

function toUpdate(f: RouterForm): UpdateRouterPayload {
  return {
    name:           f.name.trim()           || undefined,
    description:    f.description.trim()    || undefined,
    location:       f.location.trim()       || undefined,
    apiUsername:    f.apiUsername.trim()    || undefined,
    apiPassword:    f.apiPassword.trim()    || undefined,
    hotspotProfile: f.hotspotProfile.trim() || undefined,
    hotspotServer:  f.hotspotServer.trim()  || undefined,
  };
}

function fromRouter(r: RouterItem): RouterForm {
  return {
    name:           r.name,
    description:    r.description     ?? "",
    location:       r.location        ?? "",
    wireguardIp:    r.wireguardIp,
    apiPort:        String(r.apiPort),
    apiUsername:    r.apiUsername,
    apiPassword:    "",
    hotspotProfile: r.hotspotProfile,
    hotspotServer:  r.hotspotServer,
  };
}

// ─── Router card ─────────────────────────────────────────────────────────────

function RouterCard({
  router,
  onEdit,
  onDelete,
  onHealthCheck,
  onDetail,
  healthPending,
}: {
  router:         RouterItem;
  onEdit:         (r: RouterItem) => void;
  onDelete:       (r: RouterItem) => void;
  onHealthCheck:  (id: string) => void;
  onDetail:       (id: string) => void;
  healthPending:  boolean;
}) {
  return (
    <View style={S.routerCard}>
      {/* Header row */}
      <View style={S.routerHeader}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={S.routerName}>{router.name}</Text>
          {router.location ? (
            <Text style={S.routerMeta}>{router.location}</Text>
          ) : null}
          <Text style={S.routerMeta}>
            {router.wireguardIp}:{router.apiPort}
          </Text>
        </View>
        <StatusBadge status={router.status} />
      </View>

      {router.lastSeenAt ? (
        <Text style={S.routerSeen}>
          Dernier contact · {formatDateTime(router.lastSeenAt)}
        </Text>
      ) : null}

      <Divider />

      {/* Actions */}
      <Row>
        <ActionButton
          flex
          kind="secondary"
          label="Détail live"
          onPress={() => onDetail(router.id)}
        />
        <ActionButton
          flex
          kind="secondary"
          label="Health check"
          onPress={() => onHealthCheck(router.id)}
          disabled={healthPending}
          loading={healthPending}
        />
      </Row>
      <Row>
        <ActionButton
          flex
          kind="ghost"
          label="Modifier"
          onPress={() => onEdit(router)}
        />
        <ActionButton
          flex
          kind="danger"
          label="Supprimer"
          onPress={() => onDelete(router)}
        />
      </Row>
    </View>
  );
}

// ─── Form modal ───────────────────────────────────────────────────────────────

function RouterFormModal({
  visible,
  editing,
  form,
  error,
  saving,
  onChange,
  onSave,
  onClose,
}: {
  visible:  boolean;
  editing:  RouterItem | null;
  form:     RouterForm;
  error:    string | null;
  saving:   boolean;
  onChange: (patch: Partial<RouterForm>) => void;
  onSave:   () => void;
  onClose:  () => void;
}) {
  const isNew = !editing;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScrollView
        style={S.modal}
        contentContainerStyle={S.modalContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Modal header */}
        <View style={S.modalHeader}>
          <Text style={S.modalTitle}>
            {isNew ? "Nouveau routeur" : `Modifier · ${editing?.name ?? ""}`}
          </Text>
          <Pressable onPress={onClose} style={S.closeBtn} hitSlop={10}>
            <Text style={S.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        {error ? <ErrorBanner message={error} /> : null}

        {/* ── Section 1: Identification ─────────────────────── */}
        <FormSection title="Identification">
          <InputField
            label="Nom *"
            value={form.name}
            onChangeText={(v) => onChange({ name: v })}
            placeholder="Point relais Yopougon"
          />
          <InputField
            label="Localisation"
            value={form.location}
            onChangeText={(v) => onChange({ location: v })}
            placeholder="Yopougon, Abidjan"
          />
          <InputField
            label="Description"
            value={form.description}
            onChangeText={(v) => onChange({ description: v })}
            placeholder="Description optionnelle"
            multiline
          />
        </FormSection>

        {/* ── Section 2: Réseau WireGuard (création seult.) ── */}
        {isNew && (
          <FormSection title="Réseau WireGuard">
            <InputField
              label="IP WireGuard *"
              value={form.wireguardIp}
              onChangeText={(v) => onChange({ wireguardIp: v })}
              placeholder="10.66.66.2"
              hint="IP dans le sous-réseau WireGuard du VPS (10.66.66.x)"
            />
            <InputField
              label="Port API RouterOS"
              value={form.apiPort}
              onChangeText={(v) => onChange({ apiPort: v })}
              keyboardType="numeric"
              placeholder="8728"
              hint="Port API MikroTik — 8728 par défaut"
            />
          </FormSection>
        )}

        {/* ── Section 3: Accès API MikroTik ─────────────────── */}
        <FormSection title="Accès API MikroTik">
          <InputField
            label="Utilisateur *"
            value={form.apiUsername}
            onChangeText={(v) => onChange({ apiUsername: v })}
            placeholder="admin"
          />
          <InputField
            label={isNew ? "Mot de passe *" : "Nouveau mot de passe (optionnel)"}
            value={form.apiPassword}
            onChangeText={(v) => onChange({ apiPassword: v })}
            secureTextEntry
            placeholder="••••••••"
          />
        </FormSection>

        {/* ── Section 4: Hotspot ────────────────────────────── */}
        <FormSection title="Configuration Hotspot">
          <InputField
            label="Profil hotspot"
            value={form.hotspotProfile}
            onChangeText={(v) => onChange({ hotspotProfile: v })}
            placeholder="default"
            hint="Nom du profil dans /ip hotspot user profile"
          />
          <InputField
            label="Serveur hotspot"
            value={form.hotspotServer}
            onChangeText={(v) => onChange({ hotspotServer: v })}
            placeholder="hotspot1"
            hint="Nom du serveur dans /ip hotspot"
          />
        </FormSection>

        <ActionButton
          label={saving ? "Enregistrement..." : "Enregistrer"}
          onPress={onSave}
          disabled={saving}
          loading={saving}
        />
        <ActionButton
          kind="ghost"
          label="Annuler"
          onPress={onClose}
        />
      </ScrollView>
    </Modal>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function RoutersScreen() {
  const guard      = useAuthGuard();
  const expoRouter = useRouter();
  const qc         = useQueryClient();

  const [showEditor,   setShowEditor]   = useState(false);
  const [editingRouter,setEditingRouter]= useState<RouterItem | null>(null);
  const [form,         setForm]         = useState<RouterForm>(EMPTY);
  const [formError,    setFormError]    = useState<string | null>(null);

  const patch = (p: Partial<RouterForm>) => setForm((f) => ({ ...f, ...p }));

  const routersQuery = useQuery({
    queryKey: ["routers"],
    queryFn:  () => api.routers.list(),
    refetchInterval: 30_000,
  });

  const createMut = useMutation({
    mutationFn: (payload: CreateRouterPayload) => api.routers.create(payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["routers"] });
      setShowEditor(false); setEditingRouter(null);
      setForm(EMPTY); setFormError(null);
    },
    onError: (e) => setFormError(extractErrorMessage(e)),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRouterPayload }) =>
      api.routers.update(id, data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["routers"] });
      setShowEditor(false); setEditingRouter(null);
      setForm(EMPTY); setFormError(null);
    },
    onError: (e) => setFormError(extractErrorMessage(e)),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => api.routers.remove(id),
    onSuccess: async () => qc.invalidateQueries({ queryKey: ["routers"] }),
  });

  const healthMut = useMutation({
    mutationFn: (id: string) => api.routers.healthCheck(id),
    onSuccess: async () => qc.invalidateQueries({ queryKey: ["routers"] }),
  });

  function openCreate() {
    setEditingRouter(null); setForm(EMPTY); setFormError(null); setShowEditor(true);
  }

  function openEdit(router: RouterItem) {
    setEditingRouter(router); setForm(fromRouter(router)); setFormError(null); setShowEditor(true);
  }

  async function saveRouter() {
    if (!form.name.trim() || !form.apiUsername.trim()) {
      setFormError("Le nom et l'utilisateur API sont obligatoires.");
      return;
    }
    if (editingRouter) {
      await updateMut.mutateAsync({ id: editingRouter.id, data: toUpdate(form) });
      return;
    }
    if (!form.wireguardIp.trim() || !form.apiPassword) {
      setFormError("IP WireGuard et mot de passe obligatoires pour la création.");
      return;
    }
    await createMut.mutateAsync(toCreate(form));
  }

  function confirmDelete(router: RouterItem) {
    Alert.alert(
      "Supprimer routeur",
      `Supprimer « ${router.name} » ? Cette action est irréversible.`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive",
          onPress: () => removeMut.mutate(router.id) },
      ],
    );
  }

  if (!guard.isReady || guard.isBlocked) {
    return <Page scroll={false}><LoadingView /></Page>;
  }

  if (routersQuery.isLoading) {
    return <Page scroll={false}><LoadingView label="Chargement des routeurs..." /></Page>;
  }

  const routers = routersQuery.data ?? [];
  const online  = routers.filter((r) => r.status === "ONLINE").length;

  return (
    <>
      <Page>
        {/* Summary + action */}
        <Card>
          <View style={S.summaryRow}>
            <View>
              <Text style={S.summaryCount}>{routers.length} routeurs</Text>
              <Text style={S.summaryMeta}>{online} en ligne</Text>
            </View>
            <ActionButton label="Ajouter" onPress={openCreate} />
          </View>
        </Card>

        {routers.length === 0 ? (
          <EmptyState
            title="Aucun routeur configuré"
            subtitle="Ajoute ton premier routeur MikroTik."
          />
        ) : (
          routers.map((router) => (
            <RouterCard
              key={router.id}
              router={router}
              onEdit={openEdit}
              onDelete={confirmDelete}
              onHealthCheck={(id) => healthMut.mutate(id)}
              onDetail={(id) => expoRouter.push({ pathname: "/router/[id]", params: { id } })}
              healthPending={healthMut.isPending && healthMut.variables === router.id}
            />
          ))
        )}
      </Page>

      <RouterFormModal
        visible={showEditor}
        editing={editingRouter}
        form={form}
        error={formError}
        saving={createMut.isPending || updateMut.isPending}
        onChange={patch}
        onSave={() => void saveRouter()}
        onClose={() => { setShowEditor(false); setFormError(null); }}
      />
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  routerCard:   {
    backgroundColor: "#0d1829",
    borderWidth: 1,
    borderColor: "#1e2f4a",
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  routerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  routerName:   { color: "#f0f5ff", fontWeight: "700", fontSize: 15 },
  routerMeta:   { color: "#6b849f", fontSize: 12 },
  routerSeen:   { color: "#4a617e", fontSize: 11 },
  summaryRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryCount: { color: "#f0f5ff", fontSize: 17, fontWeight: "700" },
  summaryMeta:  { color: "#6b849f", fontSize: 12 },

  modal:        { flex: 1, backgroundColor: "#060e1c" },
  modalContent: { padding: 16, paddingBottom: 40, gap: 14 },
  modalHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle:   { color: "#f0f5ff", fontSize: 18, fontWeight: "700", flex: 1 },
  closeBtn:     { padding: 4 },
  closeBtnText: { color: "#6b849f", fontSize: 20 },
});
