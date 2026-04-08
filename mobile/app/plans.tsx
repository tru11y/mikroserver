import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal, ScrollView, Switch, Text, View } from "react-native";
import { api, extractErrorMessage, type Plan, type PlanPayload } from "@/src/lib/api";
import { formatDuration, formatXof } from "@/src/lib/format";
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

type PlanForm = {
  name: string;
  description: string;
  priceXof: string;
  durationMinutes: string;
  downloadKbps: string;
  uploadKbps: string;
  dataLimitMb: string;
  userProfile: string;
  displayOrder: string;
  isPopular: boolean;
};

const EMPTY_FORM: PlanForm = {
  name: "",
  description: "",
  priceXof: "500",
  durationMinutes: "60",
  downloadKbps: "2048",
  uploadKbps: "1024",
  dataLimitMb: "0",
  userProfile: "default",
  displayOrder: "0",
  isPopular: false,
};

function toPayload(form: PlanForm): PlanPayload {
  const payload: PlanPayload = {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    priceXof: Number(form.priceXof || 0),
    durationMinutes: Number(form.durationMinutes || 0),
    userProfile: form.userProfile.trim() || undefined,
    displayOrder: Number(form.displayOrder || 0),
    isPopular: form.isPopular,
  };

  const download = Number(form.downloadKbps || 0);
  const upload = Number(form.uploadKbps || 0);
  const data = Number(form.dataLimitMb || 0);

  if (download > 0) payload.downloadKbps = download;
  if (upload > 0) payload.uploadKbps = upload;
  if (data > 0) payload.dataLimitMb = data;

  return payload;
}

function fromPlan(plan: Plan): PlanForm {
  return {
    name: plan.name,
    description: plan.description ?? "",
    priceXof: String(plan.priceXof),
    durationMinutes: String(plan.durationMinutes),
    downloadKbps: String(plan.downloadKbps ?? 0),
    uploadKbps: String(plan.uploadKbps ?? 0),
    dataLimitMb: String(plan.dataLimitMb ?? 0),
    userProfile: plan.userProfile ?? "default",
    displayOrder: String(plan.displayOrder ?? 0),
    isPopular: Boolean(plan.isPopular),
  };
}

export default function PlansScreen() {
  const guard = useAuthGuard();
  const qc = useQueryClient();
  const [includeArchived, setIncludeArchived] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState<PlanForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const plansQuery = useQuery({
    queryKey: ["plans", includeArchived],
    queryFn: () => api.plans.list(includeArchived),
  });

  const createMutation = useMutation({
    mutationFn: (payload: PlanPayload) => api.plans.create(payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["plans"] });
      setShowEditor(false);
      setEditingPlan(null);
      setForm(EMPTY_FORM);
      setFormError(null);
    },
    onError: (error) => setFormError(extractErrorMessage(error)),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; data: Partial<PlanPayload> }) =>
      api.plans.update(payload.id, payload.data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["plans"] });
      setShowEditor(false);
      setEditingPlan(null);
      setForm(EMPTY_FORM);
      setFormError(null);
    },
    onError: (error) => setFormError(extractErrorMessage(error)),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.plans.archive(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["plans"] });
    },
  });

  const plans = plansQuery.data ?? [];
  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
    [plans],
  );

  function openCreate() {
    setEditingPlan(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowEditor(true);
  }

  function openEdit(plan: Plan) {
    setEditingPlan(plan);
    setForm(fromPlan(plan));
    setFormError(null);
    setShowEditor(true);
  }

  async function savePlan() {
    const payload = toPayload(form);
    if (!payload.name || payload.priceXof <= 0 || payload.durationMinutes <= 0) {
      setFormError("Nom, prix et durée sont obligatoires.");
      return;
    }

    if (editingPlan) {
      await updateMutation.mutateAsync({ id: editingPlan.id, data: payload });
      return;
    }
    await createMutation.mutateAsync(payload);
  }

  if (!guard.isReady || guard.isBlocked) {
    return (
      <Page scroll={false}>
        <LoadingView label="Chargement des forfaits..." />
      </Page>
    );
  }

  if (plansQuery.isLoading) {
    return (
      <Page scroll={false}>
        <LoadingView label="Chargement des forfaits..." />
      </Page>
    );
  }

  if (plansQuery.error) {
    return (
      <Page>
        <ErrorBanner message="Impossible de charger les forfaits." />
      </Page>
    );
  }

  return (
    <Page>
      <SectionTitle
        title="Forfaits"
        subtitle={`${plans.length} forfait(s) configuré(s)`}
      />

      <SectionCard>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: "#dbe8fd", fontSize: 13 }}>Inclure les forfaits archivés</Text>
          <Switch value={includeArchived} onValueChange={setIncludeArchived} />
        </View>
        <ActionButton label="Nouveau forfait" onPress={openCreate} />
      </SectionCard>

      {sortedPlans.length === 0 ? (
        <EmptyState
          title="Aucun forfait trouvé"
          subtitle="Crée ton premier forfait WiFi."
        />
      ) : (
        <SectionCard>
          {sortedPlans.map((plan) => (
            <View
              key={plan.id}
              style={{
                borderWidth: 1,
                borderColor: "#2a3e5d",
                borderRadius: 10,
                padding: 10,
                gap: 5,
                marginBottom: 8,
              }}
            >
              <Text style={{ color: "#eef5ff", fontWeight: "700", fontSize: 14 }}>
                {plan.name}
              </Text>
              <Text style={{ color: "#b6c8e5", fontSize: 12 }}>
                {formatXof(plan.priceXof)} · {formatDuration(plan.durationMinutes)} ·{" "}
                {plan.status}
              </Text>
              <Text style={{ color: "#8ea4c7", fontSize: 12 }}>
                ↓{plan.downloadKbps ?? "∞"} kbps · ↑{plan.uploadKbps ?? "∞"} kbps · Quota{" "}
                {plan.dataLimitMb ?? "∞"} MB
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <ActionButton
                  kind="secondary"
                  label="Modifier"
                  onPress={() => openEdit(plan)}
                />
                {plan.status === "ACTIVE" ? (
                  <ActionButton
                    kind="danger"
                    label="Archiver"
                    onPress={() => archiveMutation.mutate(plan.id)}
                    disabled={archiveMutation.isPending}
                  />
                ) : null}
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
          <SectionTitle
            title={editingPlan ? "Modifier forfait" : "Nouveau forfait"}
            subtitle={editingPlan?.slug}
          />
          <SectionCard>
            {formError ? <ErrorBanner message={formError} /> : null}
            <InputField label="Nom" value={form.name} onChangeText={(value) => setForm((f) => ({ ...f, name: value }))} />
            <InputField
              label="Description"
              value={form.description}
              onChangeText={(value) => setForm((f) => ({ ...f, description: value }))}
            />
            <InputField
              label="Prix FCFA"
              value={form.priceXof}
              onChangeText={(value) => setForm((f) => ({ ...f, priceXof: value }))}
              keyboardType="numeric"
            />
            <InputField
              label="Durée minutes"
              value={form.durationMinutes}
              onChangeText={(value) => setForm((f) => ({ ...f, durationMinutes: value }))}
              keyboardType="numeric"
            />
            <InputField
              label="Download Kbps"
              value={form.downloadKbps}
              onChangeText={(value) => setForm((f) => ({ ...f, downloadKbps: value }))}
              keyboardType="numeric"
            />
            <InputField
              label="Upload Kbps"
              value={form.uploadKbps}
              onChangeText={(value) => setForm((f) => ({ ...f, uploadKbps: value }))}
              keyboardType="numeric"
            />
            <InputField
              label="Quota MB (0 = illimité)"
              value={form.dataLimitMb}
              onChangeText={(value) => setForm((f) => ({ ...f, dataLimitMb: value }))}
              keyboardType="numeric"
            />
            <InputField
              label="Profil hotspot"
              value={form.userProfile}
              onChangeText={(value) => setForm((f) => ({ ...f, userProfile: value }))}
            />
            <InputField
              label="Ordre d'affichage"
              value={form.displayOrder}
              onChangeText={(value) => setForm((f) => ({ ...f, displayOrder: value }))}
              keyboardType="numeric"
            />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: "#dbe8fd", fontSize: 13 }}>Forfait populaire</Text>
              <Switch
                value={form.isPopular}
                onValueChange={(value) => setForm((f) => ({ ...f, isPopular: value }))}
              />
            </View>
            <ActionButton
              label={createMutation.isPending || updateMutation.isPending ? "Sauvegarde..." : "Enregistrer"}
              onPress={() => void savePlan()}
              disabled={createMutation.isPending || updateMutation.isPending}
            />
            <ActionButton kind="secondary" label="Fermer" onPress={() => setShowEditor(false)} />
          </SectionCard>
        </ScrollView>
      </Modal>
    </Page>
  );
}

