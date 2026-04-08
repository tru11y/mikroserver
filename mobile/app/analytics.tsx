import { useMemo } from "react";
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

  const maxRevenue = useMemo(() => {
    return Math.max(...(chartQuery.data?.map((item) => item.revenueXof) ?? [0]), 1);
  }, [chartQuery.data]);

  if (!guard.isReady || guard.isBlocked) {
    return (
      <Page scroll={false}>
        <LoadingView label="Chargement analytique..." />
      </Page>
    );
  }

  if (metricsQuery.isLoading || chartQuery.isLoading) {
    return (
      <Page scroll={false}>
        <LoadingView label="Chargement des données..." />
      </Page>
    );
  }

  if (metricsQuery.error || chartQuery.error) {
    return (
      <Page>
        <ErrorBanner message="Impossible de charger les statistiques." />
      </Page>
    );
  }

  const metrics = metricsQuery.data;
  if (!metrics) {
    return (
      <Page>
        <ErrorBanner message="Données analytiques indisponibles." />
      </Page>
    );
  }
  const points = chartQuery.data ?? [];

  return (
    <Page>
      <SectionTitle
        title="Analytique"
        subtitle="Données consolidées des 30 derniers jours."
      />

      <SectionCard>
        <KeyValue label="Revenus du mois" value={formatXof(metrics.revenue.thisMonth)} />
        <KeyValue label="Transactions du mois" value={metrics.transactions.thisMonth} />
        <KeyValue label="Clients uniques du mois" value={metrics.customers.uniqueThisMonth} />
        <KeyValue label="Routeurs online" value={`${metrics.routers.online}/${metrics.routers.total}`} />
      </SectionCard>

      <SectionCard>
        <SectionTitle title="Revenus journaliers (30j)" />
        {points.length === 0 ? (
          <EmptyState title="Aucune donnée de revenus disponible" />
        ) : (
          <View style={{ gap: 10 }}>
            {points.map((point) => {
              const barPercent = Math.min(100, Math.round((point.revenueXof / maxRevenue) * 100));
              return (
                <View key={point.date} style={{ gap: 4 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: "#eaf2ff", fontSize: 12, fontWeight: "700" }}>
                      {new Date(point.date).toLocaleDateString("fr-FR")}
                    </Text>
                    <Text style={{ color: "#9fb2d2", fontSize: 12 }}>
                      {formatXof(point.revenueXof)} · {point.transactions} tx
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: "#1b2b46",
                      height: 6,
                      borderRadius: 99,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        width: `${barPercent}%`,
                        height: "100%",
                        backgroundColor: "#79c7ff",
                      }}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </SectionCard>

      <SectionCard>
        <Text style={{ color: "#93a7c8", fontSize: 12 }}>
          Dernière mise à jour locale: {formatDateTime(new Date().toISOString())}
        </Text>
      </SectionCard>
    </Page>
  );
}
