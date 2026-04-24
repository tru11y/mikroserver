import { useQuery } from "@tanstack/react-query";
import { Text, View, StyleSheet } from "react-native";
import { api } from "@/src/lib/api";
import { formatDateTime, formatXof } from "@/src/lib/format";
import { useAuthGuard } from "@/src/hooks/use-auth-guard";
import {
  Card,
  CardTitle,
  Divider,
  EmptyState,
  ErrorBanner,
  KpiCard,
  KpiGrid,
  LoadingView,
  Page,
  StatusBadge,
} from "@/src/components/ui";

export default function DashboardScreen() {
  const guard = useAuthGuard();

  const metricsQuery = useQuery({
    queryKey: ["metrics", "dashboard"],
    queryFn:  () => api.metrics.dashboard(),
    refetchInterval: 30_000,
  });

  const txQuery = useQuery({
    queryKey: ["transactions", "recent"],
    queryFn:  async () => (await api.transactions.list(1, 5)).data,
    refetchInterval: 30_000,
  });

  if (!guard.isReady || guard.isBlocked) {
    return <Page scroll={false}><LoadingView /></Page>;
  }

  if (metricsQuery.isLoading) {
    return <Page scroll={false}><LoadingView label="Chargement des indicateurs..." /></Page>;
  }

  if (metricsQuery.error || !metricsQuery.data) {
    return (
      <Page>
        <ErrorBanner message="Impossible de charger le dashboard." />
      </Page>
    );
  }

  const m  = metricsQuery.data;
  const tx = txQuery.data ?? [];

  return (
    <Page>
      {/* Revenue KPIs */}
      <KpiGrid>
        <KpiCard
          label="Revenus aujourd'hui"
          value={formatXof(m.revenue.today)}
          accent
        />
        <KpiCard
          label="Revenus ce mois"
          value={formatXof(m.revenue.thisMonth)}
          accent
        />
        <KpiCard
          label="Routeurs en ligne"
          value={`${m.routers.online}/${m.routers.total}`}
          sub={m.routers.offline > 0 ? `${m.routers.offline} hors ligne` : "Tous opérationnels"}
        />
        <KpiCard
          label="Taux de succès"
          value={`${m.transactions.successRate}%`}
          sub="Transactions"
        />
      </KpiGrid>

      {/* Secondary KPIs */}
      <Card>
        <CardTitle>Activité du jour</CardTitle>
        <Divider />
        <Row label="Transactions en attente" value={m.transactions.pending} />
        <Row label="Tickets livrés aujourd'hui" value={m.vouchers.activeToday} />
        <Row label="Clients uniques aujourd'hui" value={m.customers.uniqueToday} />
        <Row label="Clients ce mois" value={m.customers.uniqueThisMonth} />
        {m.vouchers.deliveryFailures > 0 && (
          <Row label="Échecs de livraison" value={m.vouchers.deliveryFailures} danger />
        )}
      </Card>

      {/* Recent transactions */}
      <Card>
        <CardTitle>Transactions récentes</CardTitle>
        <Divider />
        {tx.length === 0 ? (
          <EmptyState title="Aucune transaction récente" />
        ) : (
          tx.map((t) => (
            <View key={t.id} style={S.txRow}>
              <View style={S.txLeft}>
                <Text style={S.txRef}>{t.reference}</Text>
                <Text style={S.txPlan}>{t.plan?.name ?? "Forfait inconnu"}</Text>
                <Text style={S.txDate}>{formatDateTime(t.createdAt)}</Text>
              </View>
              <View style={S.txRight}>
                <Text style={S.txAmount}>{formatXof(t.amountXof)}</Text>
                <StatusBadge status={t.status} />
              </View>
            </View>
          ))
        )}
      </Card>
    </Page>
  );
}

// ─── Inline KV row with optional danger colour ────────────────────────────────

function Row({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string | number;
  danger?: boolean;
}) {
  return (
    <View style={S.kvRow}>
      <Text style={S.kvLabel}>{label}</Text>
      <Text style={[S.kvValue, danger && S.kvDanger]}>{value}</Text>
    </View>
  );
}

const S = StyleSheet.create({
  txRow:    { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  txLeft:   { flex: 1, gap: 2 },
  txRight:  { alignItems: "flex-end", gap: 4 },
  txRef:    { color: "#f0f5ff", fontSize: 12, fontWeight: "700" },
  txPlan:   { color: "#c4d3ef", fontSize: 12 },
  txDate:   { color: "#6b849f", fontSize: 11 },
  txAmount: { color: "#a5b4fc", fontSize: 14, fontWeight: "700" },
  kvRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  kvLabel:  { color: "#6b849f", fontSize: 13 },
  kvValue:  { color: "#f0f5ff", fontSize: 13, fontWeight: "600" },
  kvDanger: { color: "#f87171" },
});
