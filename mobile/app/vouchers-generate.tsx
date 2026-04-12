import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api, extractErrorMessage, type GeneratedVoucher } from "@/src/lib/api";
import { formatDuration, formatXof } from "@/src/lib/format";
import { saveAndSharePdf } from "@/src/lib/pdf";
import { useAuthGuard } from "@/src/hooks/use-auth-guard";
import {
  ActionButton,
  Card,
  EmptyState,
  ErrorBanner,
  InputField,
  LoadingView,
  Page,
  Row,
  SectionTitle,
  SuccessBanner,
} from "@/src/components/ui";

function parseCount(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export default function VouchersGenerateScreen() {
  const guard   = useAuthGuard();
  const [planId,       setPlanId]       = useState("");
  const [routerId,     setRouterId]     = useState("");
  const [countInput,   setCountInput]   = useState("10");
  const [businessName, setBusinessName] = useState("MikroServer WiFi");
  const [generated,    setGenerated]    = useState<GeneratedVoucher[]>([]);
  const [actionError,  setActionError]  = useState<string | null>(null);
  const [actionInfo,   setActionInfo]   = useState<string | null>(null);

  const plansQuery   = useQuery({ queryKey: ["plans"],   queryFn: () => api.plans.list(false) });
  const routersQuery = useQuery({ queryKey: ["routers"], queryFn: () => api.routers.list() });

  const generateMutation = useMutation({
    mutationFn: (p: { planId: string; routerId: string; count: number }) => api.vouchers.generateBulk(p),
    onMutate:  () => { setActionError(null); setActionInfo(null); },
    onSuccess: (result) => { setGenerated(result); setActionInfo(`${result.length} ticket(s) généré(s).`); },
    onError:   (e) => setActionError(extractErrorMessage(e)),
  });

  const exportMutation = useMutation({
    mutationFn: () => api.vouchers.downloadPdf(generated.map((v) => v.id), businessName.trim() || undefined),
    onMutate:   () => setActionError(null),
    onSuccess:  async (buffer) => {
      const result = await saveAndSharePdf(buffer, "tickets");
      setActionInfo(result.shared ? "PDF prêt et partage lancé." : `PDF généré: ${result.uri}`);
    },
    onError: (e) => setActionError(extractErrorMessage(e)),
  });

  const activePlans   = useMemo(() => (plansQuery.data   ?? []).filter((p) => p.status === "ACTIVE"), [plansQuery.data]);
  const onlineRouters = useMemo(() => (routersQuery.data ?? []).filter((r) => r.status === "ONLINE"), [routersQuery.data]);

  const count      = parseCount(countInput);
  const canGenerate = Boolean(planId && routerId && count >= 1 && count <= 500);

  async function generate() {
    if (!canGenerate) { setActionError("Plan, routeur et quantité valide (1-500) sont obligatoires."); return; }
    await generateMutation.mutateAsync({ planId, routerId, count });
  }

  if (!guard.isReady || guard.isBlocked) {
    return <Page scroll={false}><LoadingView label="Chargement..." /></Page>;
  }
  if (plansQuery.isLoading || routersQuery.isLoading) {
    return <Page scroll={false}><LoadingView label="Chargement des données..." /></Page>;
  }
  if (plansQuery.error || routersQuery.error) {
    return <Page><ErrorBanner message="Impossible de charger les données." /></Page>;
  }

  return (
    <Page>
      <SectionTitle title="Générer des tickets" subtitle="Lots manuels + export PDF" />

      {actionError ? <ErrorBanner message={actionError} /> : null}
      {actionInfo  ? <SuccessBanner message={actionInfo} /> : null}

      {/* ── Forfait ─────────────────────────────────── */}
      <Card>
        <Text style={S.cardLabel}>Forfait · {activePlans.length} actifs</Text>
        {activePlans.length === 0 ? (
          <EmptyState title="Aucun forfait actif" subtitle="Crée d'abord un forfait." />
        ) : (
          <View style={{ gap: 8, marginTop: 8 }}>
            {activePlans.map((plan) => (
              <Pressable key={plan.id} onPress={() => setPlanId(plan.id)}
                style={[S.selectItem, plan.id === planId && S.selectItemActive]}>
                <Text style={[S.selectTitle, plan.id === planId && S.selectTitleActive]}>{plan.name}</Text>
                <Text style={S.selectMeta}>{formatXof(plan.priceXof)} · {formatDuration(plan.durationMinutes)}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </Card>

      {/* ── Routeur ─────────────────────────────────── */}
      <Card>
        <Text style={S.cardLabel}>Routeur cible · {onlineRouters.length} en ligne</Text>
        {onlineRouters.length === 0 ? (
          <EmptyState title="Aucun routeur en ligne" subtitle="Connecte un routeur avant la génération." />
        ) : (
          <View style={{ gap: 8, marginTop: 8 }}>
            {onlineRouters.map((router) => (
              <Pressable key={router.id} onPress={() => setRouterId(router.id)}
                style={[S.selectItem, router.id === routerId && S.selectItemActive]}>
                <Text style={[S.selectTitle, router.id === routerId && S.selectTitleActive]}>{router.name}</Text>
                <Text style={S.selectMeta}>
                  {router.wireguardIp}:{router.apiPort}{router.location ? ` · ${router.location}` : ""}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </Card>

      {/* ── Paramètres ─────────────────────────────── */}
      <Card>
        <InputField label="Quantité (1–500)" value={countInput} onChangeText={setCountInput} keyboardType="numeric" />
        <InputField label="Nom sur le PDF" value={businessName} onChangeText={setBusinessName} />
        <ActionButton
          label={generateMutation.isPending ? `Génération (${count})...` : `Générer ${count || 0} ticket(s)`}
          onPress={() => void generate()}
          disabled={!canGenerate || generateMutation.isPending}
          loading={generateMutation.isPending}
        />
      </Card>

      {/* ── Résultat ────────────────────────────────── */}
      {generated.length > 0 && (
        <Card>
          <Text style={S.cardLabel}>{generated.length} ticket(s) créés</Text>
          <Row style={{ marginTop: 8 }}>
            <ActionButton flex label={exportMutation.isPending ? "Export..." : "Télécharger PDF"}
              onPress={() => exportMutation.mutate()} disabled={exportMutation.isPending} />
            <ActionButton flex kind="secondary" label="Imprimer"
              onPress={() => exportMutation.mutate()} disabled={exportMutation.isPending} />
          </Row>
          <View style={{ gap: 8, marginTop: 8 }}>
            {generated.slice(0, 10).map((v) => (
              <View key={v.id} style={S.voucherRow}>
                <Text style={S.voucherCode}>{v.code}</Text>
                <Text style={S.voucherPw}>Mot de passe: {v.passwordPlain}</Text>
                <Text style={S.voucherMeta}>{v.plan.name} · {formatXof(v.plan.priceXof)} · {formatDuration(v.plan.durationMinutes)}</Text>
              </View>
            ))}
            {generated.length > 10 && (
              <Text style={S.voucherMore}>+ {generated.length - 10} ticket(s) dans le PDF.</Text>
            )}
          </View>
        </Card>
      )}
    </Page>
  );
}

const S = StyleSheet.create({
  cardLabel:       { color: "#6b849f", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  selectItem:      { borderWidth: 1, borderColor: "#1e2f4a", backgroundColor: "#0d1829", borderRadius: 10, padding: 12, gap: 3 },
  selectItemActive:{ borderColor: "#6366f1", backgroundColor: "#111f35" },
  selectTitle:     { color: "#c4d3ef", fontSize: 14, fontWeight: "700" },
  selectTitleActive: { color: "#a5b4fc" },
  selectMeta:      { color: "#6b849f", fontSize: 12 },
  voucherRow:      { borderWidth: 1, borderColor: "#1e2f4a", borderRadius: 10, padding: 12, gap: 3 },
  voucherCode:     { color: "#f0f5ff", fontSize: 15, fontWeight: "700", fontFamily: "monospace" },
  voucherPw:       { color: "#c4d3ef", fontSize: 12 },
  voucherMeta:     { color: "#6b849f", fontSize: 12 },
  voucherMore:     { color: "#6b849f", fontSize: 12 },
});
