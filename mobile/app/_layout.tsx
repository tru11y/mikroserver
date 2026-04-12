import { Stack } from "expo-router";
import { StatusBar } from "react-native";
import { AppQueryProvider } from "@/src/providers/query-provider";
import { AuthProvider } from "@/src/providers/auth-provider";

const HEADER = {
  headerStyle:       { backgroundColor: "#0a1020" },
  headerTintColor:   "#f0f5ff",
  headerShadowVisible: false,
  contentStyle:      { backgroundColor: "#060e1c" },
} as const;

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppQueryProvider>
        <StatusBar barStyle="light-content" backgroundColor="#060e1c" />
        <Stack screenOptions={HEADER}>
          {/* Splash / entry — no header */}
          <Stack.Screen name="index"  options={{ headerShown: false }} />
          {/* Auth */}
          <Stack.Screen name="login"  options={{ headerShown: false }} />
          {/* Main app — hosts bottom tabs, no header (tabs render their own) */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          {/* Stack screens shown above tabs */}
          <Stack.Screen name="router/[id]"      options={{ title: "Détail routeur" }} />
          <Stack.Screen name="vouchers-generate" options={{ title: "Générer tickets" }} />
          <Stack.Screen name="analytics"         options={{ title: "Analytique" }} />
          <Stack.Screen name="sessions"          options={{ title: "Sessions actives" }} />
          <Stack.Screen name="plans"             options={{ title: "Forfaits" }} />
          <Stack.Screen name="resellers"         options={{ title: "Revendeurs" }} />
          <Stack.Screen name="settings"          options={{ title: "Paramètres" }} />
          {/* Legacy screens kept for backward compat */}
          <Stack.Screen name="home"         options={{ title: "Menu" }} />
          <Stack.Screen name="dashboard"    options={{ title: "Dashboard" }} />
          <Stack.Screen name="routers"      options={{ title: "Routeurs" }} />
          <Stack.Screen name="vouchers"     options={{ title: "Tickets" }} />
          <Stack.Screen name="transactions" options={{ title: "Transactions" }} />
          <Stack.Screen name="+not-found"   options={{ title: "Introuvable" }} />
        </Stack>
      </AppQueryProvider>
    </AuthProvider>
  );
}
