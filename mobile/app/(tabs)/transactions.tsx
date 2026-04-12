import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { api } from "@/src/lib/api";
import { formatDateTime, formatXof } from "@/src/lib/format";
import { useAuthGuard } from "@/src/hooks/use-auth-guard";
import {
  ActionButton,
  Card,
  Divider,
  EmptyState,
  ErrorBanner,
  LoadingView,
  Page,
  Row,
  StatusBadge,
} from "@/src/components/ui";

const PAGE_SIZE = 20;

export default function TransactionsScreen() {
  const guard = useAuthGuard();
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["transactions", page],
    queryFn:  () => api.transactions.list(page, PAGE_SIZE),
    refetchInterval: 30_000,
  });

  if (!guard.isReady || guard.isBlocked) return <Page scroll={false}><LoadingView /></Page>;
  if (query.isLoading) return <Page scroll={false}><LoadingView label="Chargement des transactions..." /></Page>;
  if (query.error) return <Page><ErrorBanner message="Impossible de charger les transactions." /></Page>;

  const { data: items = [], total = 0 } = query.data ?? {};
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Page>
      <Card>
        <Text style={S.headerCount}>{total} transactions</Text>
      </Card>

      {items.length === 0 ? (
        <EmptyState title="Aucune transaction" />
      ) : (
        items.map((t) => (
          <View key={t.id} style={S.txCard}>
            <View style={S.txHeader}>
              <View style={{ flex: 1 }}>
                <Text style={S.txRef}>{t.reference}</Text>
                {t.customerName ? (
                  <Text style={S.txMeta}>{t.customerName}</Text>
                ) : null}
                {t.customerPhone ? (
                  <Text style={S.txMeta}>{t.customerPhone}</Text>
                ) : null}
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <Text style={S.txAmount}>{formatXof(t.amountXof)}</Text>
                <StatusBadge status={t.status} />
              </View>
            </View>
            {t.plan ? (
              <Text style={S.txPlan}>{t.plan.name}</Text>
            ) : null}
            <Text style={S.txDate}>{formatDateTime(t.createdAt)}</Text>
          </View>
        ))
      )}

      {totalPages > 1 && (
        <Card>
          <Row>
            <ActionButton
              flex kind="secondary" label="← Précédent"
              onPress={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            />
            <ActionButton
              flex kind="ghost"
              label={`${page} / ${totalPages}`}
              onPress={() => {}}
            />
            <ActionButton
              flex kind="secondary" label="Suivant →"
              onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            />
          </Row>
        </Card>
      )}
    </Page>
  );
}

const S = StyleSheet.create({
  headerCount: { color: "#f0f5ff", fontSize: 17, fontWeight: "700" },
  txCard:  {
    backgroundColor: "#0d1829",
    borderWidth: 1, borderColor: "#1e2f4a",
    borderRadius: 14, padding: 14, gap: 6,
  },
  txHeader:  { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  txRef:     { color: "#f0f5ff", fontWeight: "700", fontSize: 14 },
  txMeta:    { color: "#6b849f", fontSize: 12 },
  txAmount:  { color: "#a5b4fc", fontWeight: "700", fontSize: 15 },
  txPlan:    { color: "#c4d3ef", fontSize: 12 },
  txDate:    { color: "#4a617e", fontSize: 11 },
});
