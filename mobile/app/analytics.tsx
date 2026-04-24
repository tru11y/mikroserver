import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { api } from "@/src/lib/api";
import { formatXof } from "@/src/lib/format";
import { useAuthGuard } from "@/src/hooks/use-auth-guard";
import {
  Card,
  EmptyState,
  ErrorBanner,
  KpiCard,
  KpiGrid,
  LoadingView,
  Page,
  SectionTitle,
} from "@/src/components/ui";

const T = {
  text:    "#f0f5ff",
  sub:     "#c4d3ef",
  muted:   "#6b849f",
  border:  "#1e2f4a",
  card:    "#0d1829",
  primary: "#6366f1",
  bar:     "#111f35",
  barFill: "#6366f1",
} as const;

export default function AnalyticsScreen() {
  const guard = useAuthGuard();

  const metricsQuery = useQuery({
    queryKey: ["analytics", "dashboard"],
    queryFn: () => api.metrics.dashboard(),
  });

  const chartQuery = useQuery({
    queryKey: ["analytics", "chart", 30],
    queryFn: () => api.metrics.revenueChart(30),
  });

  const maxRevenue = useMemo(
    () => Math.max(...(chartQuery.data?.map((p) => p.revenueXof) ?? [0]), 1),
    [chartQuery.data],
  );

  if (!guard.isReady || guard.isBlocked) {
    return <Page scroll={false}><LoadingView label="Chargement analytique..." /></Page>;
  }
  if (metricsQuery.isLoading || chartQuery.isLoading) {
    return <Page scroll={false}><LoadingView label="Chargement des données..." /></Page>;
  }
  if (metricsQuery.error || chartQuery.error || !metricsQuery.data) {
    return <Page><ErrorBanner message="Impossible de charger les statistiques." /></Page>;
  }

  const m      = metricsQuery.data;
  const points = chartQuery.data ?? [];

  return (
    <Page>
      <SectionTitle title="Analytique" subtitle="30 derniers jours" />

      {/* ── KPIs ─────────────────────────────────────── */}
      <KpiGrid>
        <KpiCard
          label="Revenus ce mois"
          value={formatXof(m.revenue.thisMonth)}
          accent
        />
        <KpiCard
          label="Transactions"
          value={m.transactions.thisMonth}
          accent
        />
        <KpiCard
          label="Clients uniques"
          value={m.customers.uniqueThisMonth}
        />
        <KpiCard
          label={`Routeurs en ligne`}
          value={`${m.routers.online}/${m.routers.total}`}
        />
      </KpiGrid>

      {/* ── Taux de succès ───────────────────────────── */}
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View style={{ gap: 4 }}>
            <Text style={{ color: T.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Taux de succès
            </Text>
            <Text style={{ color: T.text, fontSize: 22, fontWeight: "700" }}>
              {m.transactions.successRate.toFixed(1)} %
            </Text>
          </View>
          <View style={{ gap: 4, alignItems: "flex-end" }}>
            <Text style={{ color: T.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
              En attente
            </Text>
            <Text style={{ color: "#fbbf24", fontSize: 22, fontWeight: "700" }}>
              {m.transactions.pending}
            </Text>
          </View>
          <View style={{ gap: 4, alignItems: "flex-end" }}>
            <Text style={{ color: T.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Erreurs livraison
            </Text>
            <Text style={{ color: "#f87171", fontSize: 22, fontWeight: "700" }}>
              {m.vouchers.deliveryFailures}
            </Text>
          </View>
        </View>
      </Card>

      {/* ── Graphe revenus ──────────────────────────── */}
      <Card>
        <Text style={{ color: T.sub, fontSize: 13, fontWeight: "700", marginBottom: 12 }}>
          Revenus journaliers · 30 jours
        </Text>
        {points.length === 0 ? (
          <EmptyState title="Aucune donnée de revenus disponible" />
        ) : (
          <View style={{ gap: 8 }}>
            {points.map((point) => {
              const barPercent = Math.min(100, Math.round((point.revenueXof / maxRevenue) * 100));
              return (
                <View key={point.date} style={{ gap: 3 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: T.sub, fontSize: 11 }}>
                      {new Date(point.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                    </Text>
                    <Text style={{ color: T.muted, fontSize: 11 }}>
                      {formatXof(point.revenueXof)} · {point.transactions} tx
                    </Text>
                  </View>
                  <View style={{ backgroundColor: T.bar, height: 5, borderRadius: 99, overflow: "hidden" }}>
                    <View style={{ width: `${barPercent}%`, height: "100%", backgroundColor: T.barFill }} />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Card>
    </Page>
  );
}
