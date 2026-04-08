import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { api } from "@/src/lib/api";
import { formatDateTime, formatXof } from "@/src/lib/format";
import { useAuthGuard } from "@/src/hooks/use-auth-guard";
import {
  EmptyState,
  ErrorBanner,
  KeyValue,
  LoadingView,
  Page,
  SectionCard,
  SectionTitle,
} from "@/src/components/ui";

export default function DashboardScreen() {
  const guard = useAuthGuard();
  const metricsQuery = useQuery({
    queryKey: ["metrics", "dashboard"],
    queryFn: () => api.metrics.dashboard(),
    refetchInterval: 30_000,
  });
  const txQuery = useQuery({
    queryKey: ["transactions", "recent"],
    queryFn: async () => {
      const result = await api.transactions.list(1, 5);
      return result.data;
    },
    refetchInterval: 30_000,
  });

  if (!guard.isReady || guard.isBlocked) {
    return (
      <Page scroll={false}>
        <LoadingView label="Chargement du dashboard..." />
      </Page>
    );
  }

  if (metricsQuery.isLoading) {
    return (
      <Page scroll={false}>
        <LoadingView label="Chargement des indicateurs..." />
      </Page>
    );
  }

  if (metricsQuery.error) {
    return (
      <Page>
        <ErrorBanner message="Impossible de charger le dashboard." />
      </Page>
    );
  }

  const metrics = metricsQuery.data;
  if (!metrics) {
    return (
      <Page>
        <ErrorBanner message="Données dashboard indisponibles." />
      </Page>
    );
  }
  const recentTransactions = txQuery.data ?? [];

  return (
    <Page>
      <SectionTitle
        title="Dashboard"
        subtitle="Vue globale des performances en temps réel."
      />

      <SectionCard>
        <KeyValue label="Revenus aujourd'hui" value={formatXof(metrics.revenue.today)} />
        <KeyValue label="Revenus ce mois" value={formatXof(metrics.revenue.thisMonth)} />
        <KeyValue label="Revenus 30 jours" value={formatXof(metrics.revenue.last30Days)} />
        <KeyValue
          label="Taux de succès transactions"
          value={`${metrics.transactions.successRate}%`}
        />
      </SectionCard>

      <SectionCard>
        <KeyValue label="Routeurs online" value={`${metrics.routers.online}/${metrics.routers.total}`} />
        <KeyValue label="Transactions en attente" value={metrics.transactions.pending} />
        <KeyValue label="Vouchers livrés aujourd'hui" value={metrics.vouchers.activeToday} />
        <KeyValue label="Clients uniques ce mois" value={metrics.customers.uniqueThisMonth} />
      </SectionCard>

      <SectionCard>
        <SectionTitle title="Transactions récentes" />
        {recentTransactions.length === 0 ? (
          <EmptyState title="Aucune transaction récente" />
        ) : (
          <View style={{ gap: 10 }}>
            {recentTransactions.map((transaction) => (
              <View
                key={transaction.id}
                style={{
                  borderWidth: 1,
                  borderColor: "#2a3c58",
                  borderRadius: 10,
                  padding: 10,
                  gap: 3,
                }}
              >
                <Text style={{ color: "#eff5ff", fontWeight: "700", fontSize: 13 }}>
                  {transaction.reference}
                </Text>
                <Text style={{ color: "#d4e3ff", fontSize: 13 }}>
                  {transaction.plan?.name ?? "Forfait inconnu"} ·{" "}
                  {formatXof(transaction.amountXof)}
                </Text>
                <Text style={{ color: "#9ab0d3", fontSize: 12 }}>
                  {transaction.status} · {formatDateTime(transaction.createdAt)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </SectionCard>
    </Page>
  );
}
