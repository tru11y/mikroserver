import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { api, extractErrorMessage, type Plan, type PlanPayload } from "@/src/lib/api";
import { formatDuration, formatXof } from "@/src/lib/format";
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

type PlanForm = {
  name: string; description: string;
  priceXof: string; durationMinutes: string;
  downloadKbps: string; uploadKbps: string; dataLimitMb: string;
  userProfile: string; displayOrder: string; isPopular: boolean;
};

const EMPTY: PlanForm = {
  name: "", description: "", priceXof: "500", durationMinutes: "60",
  downloadKbps: "2048", uploadKbps: "1024", dataLimitMb: "0",
  userProfile: "default", displayOrder: "0", isPopular: false,
};

function toPayload(f: PlanForm): PlanPayload {
  const p: PlanPayload = {
    name: f.name.trim(), description: f.description.trim() || undefined,
    priceXof: Number(f.priceXof || 0), durationMinutes: Number(f.durationMinutes || 0),
    userProfile: f.userProfile.trim() || undefined,
    displayOrder: Number(f.displayOrder || 0), isPopular: f.isPopular,
  };
  const dl = Number(f.downloadKbps || 0);
  const ul = Number(f.uploadKbps   || 0);
  const dm = Number(f.dataLimitMb  || 0);
  if (dl > 0) p.downloadKbps = dl;
  if (ul > 0) p.uploadKbps   = ul;
  if (dm > 0) p.dataLimitMb  = dm;
  return p;
}

function fromPlan(plan: Plan): PlanForm {
  return {
    name: plan.name, description: plan.description ?? "",
    priceXof: String(plan.priceXof), durationMinutes: String(plan.durationMinutes),
    downloadKbps: String(plan.downloadKbps ?? 0), uploadKbps: String(plan.uploadKbps ?? 0),
    dataLimitMb:  String(plan.dataLimitMb  ?? 0), userProfile: plan.userProfile ?? "default",
    displayOrder: String(plan.displayOrder ?? 0), isPopular: Boolean(plan.isPopular),
  };
}

export default function PlansScreen() {
  const guard = useAuthGuard();
  const qc    = useQueryClient();
  const [includeArchived, setIncludeArchived] = useState(false);
  const [showEditor,  setShowEditor]  = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form,      setForm]      = useState<PlanForm>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);

  const patch = (p: Partial<PlanForm>) => setForm((f) => ({ ...f, ...p }));

  const plansQuery = useQuery({
    queryKey: ["plans", includeArchived],
    queryFn:  () => api.plans.list(includeArchived),
  });

  const createMut = useMutation({
    mutationFn: (p: PlanPayload) => api.plans.create(p),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["plans"] });
      setShowEditor(false); setEditingPlan(null); setForm(EMPTY); setFormError(null);
    },
    onError: (e) => setFormError(extractErrorMessage(e)),
  });

  const updateMut = useMutation({
    mutationFn: (p: { id: string; data: Partial<PlanPayload> }) => api.plans.update(p.id, p.data),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["plans"] });
      setShowEditor(false); setEditingPlan(null); setForm(EMPTY); setFormError(null);
    },
    onError: (e) => setFormError(extractErrorMessage(e)),
  });

  const archiveMut = useMutation({
    mutationFn: (id: string) => api.plans.archive(id),
    onSuccess: async () => qc.invalidateQueries({ queryKey: ["plans"] }),
  });

  const plans = plansQuery.data ?? [];
  const sorted = useMemo(() => [...plans].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)), [plans]);

  function openCreate() { setEditingPlan(null); setForm(EMPTY); setFormError(null); setShowEditor(true); }
  function openEdit(plan: Plan) { setEditingPlan(plan); setForm(fromPlan(plan)); setFormError(null); setShowEditor(true); }

  async function save() {
    const payload = toPayload(form);
    if (!payload.name || payload.priceXof <= 0 || payload.durationMinutes <= 0) {
      setFormError("Nom, prix et durée sont obligatoires."); return;
    }
    if (editingPlan) { await updateMut.mutateAsync({ id: editingPlan.id, data: payload }); return; }
    await createMut.mutateAsync(payload);
  }

  if (!guard.isReady || guard.isBlocked) {
    return <Page scroll={false}><LoadingView label="Chargement des forfaits..." /></Page>;
  }
  if (plansQuery.isLoading) {
    return <Page scroll={false}><LoadingView label="Chargement des forfaits..." /></Page>;
  }
  if (plansQuery.error) {
    return <Page><ErrorBanner message="Impossible de charger les forfaits." /></Page>;
  }

  const saving = createMut.isPending || updateMut.isPending;

  return (
    <>
      <Page>
        <Card>
          <View style={S.summaryRow}>
            <View>
              <Text style={S.summaryCount}>{plans.length} forfaits</Text>
              <Text style={S.summaryMeta}>{plans.filter((p) => p.status === "ACTIVE").length} actifs</Text>
            </View>
            <ActionButton label="Nouveau" onPress={openCreate} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
            <Text style={S.summaryMeta}>Inclure les archivés</Text>
            <Switch value={includeArchived} onValueChange={setIncludeArchived} thumbColor="#6366f1" trackColor={{ true: "#4338ca", false: "#1e2f4a" }} />
          </View>
        </Card>

        {sorted.length === 0 ? (
          <EmptyState title="Aucun forfait trouvé" subtitle="Crée ton premier forfait WiFi." />
        ) : (
          sorted.map((plan) => (
            <View key={plan.id} style={S.planCard}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={S.planName}>{plan.name}{plan.isPopular ? "  ⭐" : ""}</Text>
                  <Text style={S.planPrice}>{formatXof(plan.priceXof)} · {formatDuration(plan.durationMinutes)}</Text>
                  <Text style={S.planMeta}>
                    ↓ {plan.downloadKbps ?? "∞"} kbps · ↑ {plan.uploadKbps ?? "∞"} kbps
                    {plan.dataLimitMb ? ` · ${plan.dataLimitMb} MB` : ""}
                  </Text>
                </View>
                <StatusBadge status={plan.status} />
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                <ActionButton flex kind="ghost" label="Modifier" onPress={() => openEdit(plan)} />
                {plan.status === "ACTIVE" && (
                  <ActionButton flex kind="danger" label="Archiver"
                    onPress={() => archiveMut.mutate(plan.id)}
                    disabled={archiveMut.isPending} />
                )}
              </View>
            </View>
          ))
        )}
      </Page>

      <Modal visible={showEditor} animationType="slide" onRequestClose={() => setShowEditor(false)}>
        <ScrollView
          style={S.modal}
          contentContainerStyle={S.modalContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={S.modalHeader}>
            <Text style={S.modalTitle}>{editingPlan ? `Modifier · ${editingPlan.name}` : "Nouveau forfait"}</Text>
            <Pressable onPress={() => setShowEditor(false)} style={S.closeBtn} hitSlop={10}>
              <Text style={S.closeBtnText}>✕</Text>
            </Pressable>
          </View>
          {formError ? <ErrorBanner message={formError} /> : null}

          <FormSection title="Identification">
            <InputField label="Nom *" value={form.name} onChangeText={(v) => patch({ name: v })} placeholder="30 min WiFi" />
            <InputField label="Description" value={form.description} onChangeText={(v) => patch({ description: v })} placeholder="Optionnel" multiline />
          </FormSection>

          <FormSection title="Tarification">
            <InputField label="Prix FCFA *" value={form.priceXof} onChangeText={(v) => patch({ priceXof: v })} keyboardType="numeric" placeholder="500" />
            <InputField label="Durée minutes *" value={form.durationMinutes} onChangeText={(v) => patch({ durationMinutes: v })} keyboardType="numeric" placeholder="60" />
          </FormSection>

          <FormSection title="Limites réseau">
            <InputField label="Download Kbps" value={form.downloadKbps} onChangeText={(v) => patch({ downloadKbps: v })} keyboardType="numeric" hint="0 = illimité" />
            <InputField label="Upload Kbps" value={form.uploadKbps} onChangeText={(v) => patch({ uploadKbps: v })} keyboardType="numeric" hint="0 = illimité" />
            <InputField label="Quota MB" value={form.dataLimitMb} onChangeText={(v) => patch({ dataLimitMb: v })} keyboardType="numeric" hint="0 = illimité" />
          </FormSection>

          <FormSection title="Configuration">
            <InputField label="Profil hotspot" value={form.userProfile} onChangeText={(v) => patch({ userProfile: v })} placeholder="default" />
            <InputField label="Ordre affichage" value={form.displayOrder} onChangeText={(v) => patch({ displayOrder: v })} keyboardType="numeric" />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={S.switchLabel}>Forfait populaire ⭐</Text>
              <Switch value={form.isPopular} onValueChange={(v) => patch({ isPopular: v })} thumbColor="#6366f1" trackColor={{ true: "#4338ca", false: "#1e2f4a" }} />
            </View>
          </FormSection>

          <ActionButton label={saving ? "Enregistrement..." : "Enregistrer"} onPress={() => void save()} disabled={saving} loading={saving} />
          <ActionButton kind="ghost" label="Annuler" onPress={() => setShowEditor(false)} />
        </ScrollView>
      </Modal>
    </>
  );
}

const S = StyleSheet.create({
  summaryRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryCount:  { color: "#f0f5ff", fontSize: 17, fontWeight: "700" },
  summaryMeta:   { color: "#6b849f", fontSize: 12 },
  planCard:      { backgroundColor: "#0d1829", borderWidth: 1, borderColor: "#1e2f4a", borderRadius: 14, padding: 14, gap: 6 },
  planName:      { color: "#f0f5ff", fontWeight: "700", fontSize: 15 },
  planPrice:     { color: "#a5b4fc", fontSize: 14, fontWeight: "600" },
  planMeta:      { color: "#6b849f", fontSize: 12 },
  switchLabel:   { color: "#c4d3ef", fontSize: 13 },
  modal:         { flex: 1, backgroundColor: "#060e1c" },
  modalContent:  { padding: 16, paddingBottom: 40, gap: 14 },
  modalHeader:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle:    { color: "#f0f5ff", fontSize: 18, fontWeight: "700", flex: 1 },
  closeBtn:      { padding: 4 },
  closeBtnText:  { color: "#6b849f", fontSize: 20 },
});
