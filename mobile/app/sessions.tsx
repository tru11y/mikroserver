import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { api, extractErrorMessage } from "@/src/lib/api";
import { formatBytes } from "@/src/lib/format";
import { useAuthGuard } from "@/src/hooks/use-auth-guard";
import {
  ActionButton,
  Card,
  EmptyState,
  ErrorBanner,
  LoadingView,
  Page,
  Row,
  SectionTitle,
} from "@/src/components/ui";

export default function SessionsScreen() {
  const guard        = useAuthGuard();
  const queryClient  = useQueryClient();
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const [actionError, setActionError]     = useState<string | null>(null);

  const routersQuery = useQuery({
    queryKey: ["routers"],
    queryFn:  () => api.routers.list(),
  });

  const sessionsQuery = useQuery({
    queryKey:        ["sessions", filter ?? "all"],
    queryFn:         () => api.sessions.active(filter),
    refetchInterval: 10_000,
  });

  const terminateMutation = useMutation({
    mutationFn: (p: { routerId: string; mikrotikId: string }) =>
      api.sessions.terminate(p.routerId, p.mikrotikId),
    onMutate: (p) => { setActionError(null); setTerminatingId(p.mikrotikId); },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
      await queryClient.invalidateQueries({ queryKey: ["router-live"] });
    },
    onError:   (e) => setActionError(extractErrorMessage(e)),
    onSettled: () => setTerminatingId(null),
  });

  const routers  = routersQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];
  const routerName = useMemo(
    () => filter ? (routers.find((r) => r.id === filter)?.name ?? "Routeur") : "Tous",
    [filter, routers],
  );

  if (!guard.isReady || guard.isBlocked) {
    return <Page scroll={false}><LoadingView label="Chargement des sessions..." /></Page>;
  }
  if (sessionsQuery.isLoading && !sessionsQuery.data) {
    return <Page scroll={false}><LoadingView label="Chargement des sessions..." /></Page>;
  }
  if (sessionsQuery.error) {
    return <Page><ErrorBanner message="Impossible de charger les sessions actives." /></Page>;
  }

  return (
    <Page>
      <SectionTitle
        title="Sessions actives"
        subtitle={`${sessions.length} session(s) · ${routerName}`}
      />

      {actionError ? <ErrorBanner message={actionError} /> : null}

      {/* Router filter chips */}
      <Card>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[{ id: undefined, name: "Tous" }, ...routers].map((r) => {
              const active = filter === r.id;
              return (
                <View
                  key={r.id ?? "all"}
                  onTouchEnd={() => setFilter(r.id)}
                  style={[S.chip, active && S.chipActive]}
                >
                  <Text style={[S.chipText, active && S.chipTextActive]}>{r.name}</Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
        <ActionButton
          kind="secondary"
          label={sessionsQuery.isFetching ? "Actualisation..." : "Actualiser"}
          onPress={() => void sessionsQuery.refetch()}
          disabled={sessionsQuery.isFetching}
        />
      </Card>

      {sessions.length === 0 ? (
        <EmptyState title="Aucune session active" subtitle="Les clients connectés apparaîtront ici." />
      ) : (
        sessions.map((session) => (
          <View key={session.id} style={S.sessionCard}>
            <Text style={S.sessionUser}>{session.username}</Text>
            <Text style={S.sessionMeta}>{session.ipAddress} · {session.macAddress}</Text>
            <Text style={S.sessionMeta}>
              {session.routerName || "Routeur inconnu"} · Uptime {session.uptime}
            </Text>
            <Text style={S.sessionStats}>
              ↓ {formatBytes(session.bytesIn)} · ↑ {formatBytes(session.bytesOut)}
            </Text>
            <Row style={{ marginTop: 4 }}>
              <ActionButton
                flex
                kind="danger"
                label={terminatingId === session.id ? "Coupure..." : "Couper session"}
                onPress={() => terminateMutation.mutate({ routerId: session.routerId, mikrotikId: session.id })}
                disabled={terminateMutation.isPending}
              />
            </Row>
          </View>
        ))
      )}
    </Page>
  );
}

const S = StyleSheet.create({
  chip:          { borderRadius: 99, borderWidth: 1, borderColor: "#1e2f4a", backgroundColor: "#0d1829", paddingHorizontal: 12, paddingVertical: 7 },
  chipActive:    { borderColor: "#6366f1", backgroundColor: "#111f35" },
  chipText:      { color: "#6b849f", fontSize: 13, fontWeight: "600" },
  chipTextActive:{ color: "#a5b4fc", fontSize: 13, fontWeight: "700" },
  sessionCard:   { backgroundColor: "#0d1829", borderWidth: 1, borderColor: "#1e2f4a", borderRadius: 14, padding: 14, gap: 4 },
  sessionUser:   { color: "#f0f5ff", fontWeight: "700", fontSize: 14 },
  sessionMeta:   { color: "#c4d3ef", fontSize: 12 },
  sessionStats:  { color: "#6b849f", fontSize: 12 },
});
