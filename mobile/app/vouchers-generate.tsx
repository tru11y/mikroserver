import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Pressable, Text, View } from "react-native";
import { api, extractErrorMessage, type GeneratedVoucher } from "@/src/lib/api";
import { formatDuration, formatXof } from "@/src/lib/format";
import { saveAndSharePdf } from "@/src/lib/pdf";
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

function parseCount(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.round(parsed);
}

export default function VouchersGenerateScreen() {
  const guard = useAuthGuard();
  const [planId, setPlanId] = useState("");
  const [routerId, setRouterId] = useState("");
  const [countInput, setCountInput] = useState("10");
  const [businessName, setBusinessName] = useState("MikroServer WiFi");
  const [generated, setGenerated] = useState<GeneratedVoucher[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionInfo, setActionInfo] = useState<string | null>(null);

  const plansQuery = useQuery({
    queryKey: ["plans"],
    queryFn: () => api.plans.list(false),
  });

  const routersQuery = useQuery({
    queryKey: ["routers"],
    queryFn: () => api.routers.list(),
  });

  const generateMutation = useMutation({
    mutationFn: (payload: { planId: string; routerId: string; count: number }) =>
      api.vouchers.generateBulk(payload),
    onMutate: () => {
      setActionError(null);
      setActionInfo(null);
    },
    onSuccess: (result) => {
      setGenerated(result);
      setActionInfo(`${result.length} ticket(s) généré(s) avec succès.`);
    },
    onError: (error) => {
      setActionError(extractErrorMessage(error));
    },
  });

  const exportMutation = useMutation({
    mutationFn: () =>
      api.vouchers.downloadPdf(
        generated.map((voucher) => voucher.id),
        businessName.trim() || undefined,
      ),
    onMutate: () => {
      setActionError(null);
    },
    onSuccess: async (buffer) => {
      const result = await saveAndSharePdf(buffer, "tickets");
      setActionInfo(
        result.shared
          ? "PDF prêt et partage lancé."
          : `PDF généré localement: ${result.uri}`,
      );
    },
    onError: (error) => {
      setActionError(extractErrorMessage(error));
    },
  });

  const activePlans = useMemo(
    () => (plansQuery.data ?? []).filter((plan) => plan.status === "ACTIVE"),
    [plansQuery.data],
  );
  const onlineRouters = useMemo(
    () => (routersQuery.data ?? []).filter((router) => router.status === "ONLINE"),
    [routersQuery.data],
  );

  const count = parseCount(countInput);
  const canGenerate = Boolean(planId && routerId && count >= 1 && count <= 500);

  async function generate() {
    if (!canGenerate) {
      setActionError("Plan, routeur et quantité valide (1-500) sont obligatoires.");
      return;
    }

    await generateMutation.mutateAsync({
      planId,
      routerId,
      count,
    });
  }

  if (!guard.isReady || guard.isBlocked) {
    return (
      <Page scroll={false}>
        <LoadingView label="Chargement de la génération..." />
      </Page>
    );
  }

  if (plansQuery.isLoading || routersQuery.isLoading) {
    return (
      <Page scroll={false}>
        <LoadingView label="Chargement des plans et routeurs..." />
      </Page>
    );
  }

  if (plansQuery.error || routersQuery.error) {
    return (
      <Page>
        <ErrorBanner message="Impossible de charger les données de génération." />
      </Page>
    );
  }

  return (
    <Page>
      <SectionTitle
        title="Générer des tickets"
        subtitle="Création manuelle de lots + export PDF natif"
      />

      {actionError ? <ErrorBanner message={actionError} /> : null}
      {actionInfo ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: "#2f704d",
            backgroundColor: "#143625",
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Text style={{ color: "#9ff0c8", fontSize: 13 }}>{actionInfo}</Text>
        </View>
      ) : null}

      <SectionCard>
        <SectionTitle title="Forfait cible" subtitle={`${activePlans.length} forfait(s) actifs`} />
        {activePlans.length === 0 ? (
          <EmptyState title="Aucun forfait actif" subtitle="Crée d'abord un forfait dans la section forfaits." />
        ) : (
          <View style={{ gap: 8 }}>
            {activePlans.map((plan) => {
              const selected = plan.id === planId;
              return (
                <Pressable
                  key={plan.id}
                  onPress={() => setPlanId(plan.id)}
                  style={{
                    borderWidth: 1,
                    borderColor: selected ? "#4f79b7" : "#2d4466",
                    backgroundColor: selected ? "#1b2d49" : "#101a2c",
                    borderRadius: 10,
                    padding: 10,
                    gap: 3,
                  }}
                >
                  <Text style={{ color: "#ecf4ff", fontSize: 14, fontWeight: "700" }}>
                    {plan.name}
                  </Text>
                  <Text style={{ color: "#acc2e3", fontSize: 12 }}>
                    {formatXof(plan.priceXof)} · {formatDuration(plan.durationMinutes)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </SectionCard>

      <SectionCard>
        <SectionTitle title="Routeur cible" subtitle={`${onlineRouters.length} routeur(s) en ligne`} />
        {onlineRouters.length === 0 ? (
          <EmptyState
            title="Aucun routeur en ligne"
            subtitle="Connecte un routeur avant la génération."
          />
        ) : (
          <View style={{ gap: 8 }}>
            {onlineRouters.map((router) => {
              const selected = router.id === routerId;
              return (
                <Pressable
                  key={router.id}
                  onPress={() => setRouterId(router.id)}
                  style={{
                    borderWidth: 1,
                    borderColor: selected ? "#4f79b7" : "#2d4466",
                    backgroundColor: selected ? "#1b2d49" : "#101a2c",
                    borderRadius: 10,
                    padding: 10,
                    gap: 3,
                  }}
                >
                  <Text style={{ color: "#ecf4ff", fontSize: 14, fontWeight: "700" }}>
                    {router.name}
                  </Text>
                  <Text style={{ color: "#acc2e3", fontSize: 12 }}>
                    {router.wireguardIp}:{router.apiPort} · {router.location || "Sans localisation"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </SectionCard>

      <SectionCard>
        <InputField
          label="Quantité (1 à 500)"
          value={countInput}
          onChangeText={setCountInput}
          keyboardType="numeric"
        />
        <InputField
          label="Nom affiché sur le PDF"
          value={businessName}
          onChangeText={setBusinessName}
        />
        <ActionButton
          label={
            generateMutation.isPending
              ? `Génération en cours (${count || 0})...`
              : `Générer ${count || 0} ticket(s)`
          }
          onPress={() => void generate()}
          disabled={!canGenerate || generateMutation.isPending}
        />
      </SectionCard>

      {generated.length > 0 ? (
        <SectionCard>
          <SectionTitle
            title="Résultat génération"
            subtitle={`${generated.length} ticket(s) créés`}
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <ActionButton
              label={exportMutation.isPending ? "Export..." : "Télécharger PDF"}
              onPress={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
            />
            <ActionButton
              kind="secondary"
              label={exportMutation.isPending ? "Préparation..." : "Imprimer"}
              onPress={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
            />
          </View>

          <View style={{ gap: 8 }}>
            {generated.slice(0, 10).map((voucher) => (
              <View
                key={voucher.id}
                style={{
                  borderWidth: 1,
                  borderColor: "#2a3f5e",
                  borderRadius: 10,
                  padding: 10,
                  gap: 3,
                }}
              >
                <Text style={{ color: "#eef5ff", fontSize: 15, fontWeight: "700" }}>
                  {voucher.code}
                </Text>
                <Text style={{ color: "#c0d2ef", fontSize: 12 }}>
                  Mot de passe: {voucher.passwordPlain}
                </Text>
                <Text style={{ color: "#94aacd", fontSize: 12 }}>
                  {voucher.plan.name} · {formatXof(voucher.plan.priceXof)} ·{" "}
                  {formatDuration(voucher.plan.durationMinutes)}
                </Text>
                <Text style={{ color: "#86a0c4", fontSize: 12 }}>Statut: {voucher.status}</Text>
              </View>
            ))}
          </View>

          {generated.length > 10 ? (
            <Text style={{ color: "#95abcc", fontSize: 12 }}>
              + {generated.length - 10} ticket(s) supplémentaires inclus dans le PDF.
            </Text>
          ) : null}
        </SectionCard>
      ) : null}
    </Page>
  );
}
