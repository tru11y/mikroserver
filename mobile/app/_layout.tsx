import { Stack } from "expo-router";
import { StatusBar } from "react-native";
import { AppQueryProvider } from "@/src/providers/query-provider";
import { AuthProvider } from "@/src/providers/auth-provider";

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppQueryProvider>
        <StatusBar barStyle="light-content" />
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: "#0d1420",
            },
            headerTintColor: "#eff6ff",
            headerShadowVisible: false,
            contentStyle: {
              backgroundColor: "#0b1018",
            },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="home" options={{ title: "MikroServer" }} />
          <Stack.Screen name="dashboard" options={{ title: "Dashboard" }} />
          <Stack.Screen name="analytics" options={{ title: "Analytique" }} />
          <Stack.Screen name="plans" options={{ title: "Forfaits" }} />
          <Stack.Screen name="resellers" options={{ title: "Revendeurs" }} />
          <Stack.Screen name="routers" options={{ title: "Routeurs" }} />
          <Stack.Screen name="router/[id]" options={{ title: "Routeur détail" }} />
          <Stack.Screen name="sessions" options={{ title: "Sessions actives" }} />
          <Stack.Screen name="transactions" options={{ title: "Transactions" }} />
          <Stack.Screen name="vouchers" options={{ title: "Vouchers" }} />
          <Stack.Screen name="vouchers-generate" options={{ title: "Générer tickets" }} />
          <Stack.Screen name="settings" options={{ title: "Paramètres" }} />
          <Stack.Screen name="+not-found" options={{ title: "Introuvable" }} />
        </Stack>
      </AppQueryProvider>
    </AuthProvider>
  );
}
