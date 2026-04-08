import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";
import { api, extractErrorMessage } from "@/src/lib/api";
import { formatBytes } from "@/src/lib/format";
import { useAuthGuard } from "@/src/hooks/use-auth-guard";
import {
  ActionButton,
  EmptyState,
  ErrorBanner,
  LoadingView,
  Page,
  SectionCard,
  SectionTitle,
} from "@/src/components/ui";

export default function SessionsScreen() {
  const guard = useAuthGuard();
  const queryClient = useQueryClient();
  const [routerFilter, setRouterFilter] = useState<string | undefined>(undefined);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const routersQuery = useQuery({
    queryKey: ["routers"],
    queryFn: () => api.routers.list(),
  });

  const sessionsQuery = useQuery({
    queryKey: ["sessions", routerFilter ?? "all"],
    queryFn: () => api.sessions.active(routerFilter),
    refetchInterval: 10_000,
  });

  const terminateMutation = useMutation({
    mutationFn: (payload: { routerId: string; mikrotikId: string }) =>
      api.sessions.terminate(payload.routerId, payload.mikrotikId),
    onMutate: (payload) => {
      setActionError(null);
      setTerminatingId(payload.mikrotikId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
      await queryClient.invalidateQueries({ queryKey: ["router-live"] });
    },
    onError: (error) => {
      setActionError(extractErrorMessage(error));
    },
    onSettled: () => {
      setTerminatingId(null);
    },
  });

  const routers = routersQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];
  const routerName = useMemo(() => {
    if (!routerFilter) {
      return "Tous les routeurs";
    }
    return routers.find((router) => router.id === routerFilter)?.name ?? "Routeur";
  }, [routerFilter, routers]);

  if (!guard.isReady || guard.isBlocked) {
    return (
      <Page scroll={false}>
        <LoadingView label="Chargement des sessions..." />
      </Page>
    );
  }

  if (sessionsQuery.isLoading && !sessionsQuery.data) {
    return (
      <Page scroll={false}>
        <LoadingView label="Chargement des sessions..." />
      </Page>
    );
  }

  if (sessionsQuery.error) {
    return (
      <Page>
        <ErrorBanner message="Impossible de charger les sessions actives." />
      </Page>
    );
  }

  return (
    <Page>
      <SectionTitle
        title="Sessions actives"
        subtitle={`${sessions.length} session(s) · ${routerName}`}
      />

      {actionError ? <ErrorBanner message={actionError} /> : null}

      <SectionCard>
        <SectionTitle title="Filtrer par routeur" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <ActionButton
              kind={routerFilter ? "secondary" : "primary"}
              label="Tous"
              onPress={() => setRouterFilter(undefined)}
            />
            {routers.map((router) => (
              <ActionButton
                key={router.id}
                kind={routerFilter === router.id ? "primary" : "secondary"}
                label={router.name}
                onPress={() => setRouterFilter(router.id)}
              />
            ))}
          </View>
        </ScrollView>
        <ActionButton
          kind="secondary"
          label={sessionsQuery.isFetching ? "Actualisation..." : "Actualiser"}
          onPress={() => void sessionsQuery.refetch()}
          disabled={sessionsQuery.isFetching}
        />
      </SectionCard>

      {sessions.length === 0 ? (
        <EmptyState
          title="Aucune session active"
          subtitle="Les clients connectés apparaîtront ici."
        />
      ) : (
        <SectionCard>
          {sessions.map((session) => (
            <View
              key={session.id}
              style={{
                borderWidth: 1,
                borderColor: "#2b4060",
                borderRadius: 10,
                padding: 10,
                marginBottom: 8,
                gap: 4,
              }}
            >
              <Text style={{ color: "#edf5ff", fontWeight: "700", fontSize: 14 }}>
                {session.username}
              </Text>
              <Text style={{ color: "#c3d5f4", fontSize: 12 }}>
                {session.ipAddress} · {session.macAddress}
              </Text>
              <Text style={{ color: "#9fb3d3", fontSize: 12 }}>
                {session.routerName || "Routeur inconnu"} · Uptime {session.uptime}
              </Text>
              <Text style={{ color: "#8ea3c6", fontSize: 12 }}>
                ↓ {formatBytes(session.bytesIn)} · ↑ {formatBytes(session.bytesOut)}
              </Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                <ActionButton
                  kind="danger"
                  label={terminatingId === session.id ? "Coupure..." : "Couper session"}
                  onPress={() =>
                    terminateMutation.mutate({
                      routerId: session.routerId,
                      mikrotikId: session.id,
                    })
                  }
                  disabled={terminateMutation.isPending}
                />
              </View>
            </View>
          ))}
        </SectionCard>
      )}
    </Page>
  );
}
