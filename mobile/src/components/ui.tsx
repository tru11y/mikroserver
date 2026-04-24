import { PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

// ─── Design tokens ───────────────────────────────────────────────────────────

const C = {
  bgPage:         "#060e1c",
  bgCard:         "#0d1829",
  bgInput:        "#060e1c",
  bgMuted:        "#111f35",
  border:         "#1e2f4a",
  primary:        "#6366f1",
  primaryLight:   "#818cf8",
  primarySoft:    "#a5b4fc",
  text:           "#f0f5ff",
  textSub:        "#c4d3ef",
  textMuted:      "#6b849f",
  success:        "#4ade80",
  successBg:      "#071f10",
  successBorder:  "#174d2a",
  danger:         "#f87171",
  dangerBg:       "#1f0710",
  dangerBorder:   "#4d1728",
  warning:        "#fb923c",
  warningBg:      "#1f1007",
  warningBorder:  "#4d2c17",
} as const;

// ─── Layout ──────────────────────────────────────────────────────────────────

export function Page({
  children,
  scroll = true,
  padded = true,
}: PropsWithChildren<{ scroll?: boolean; padded?: boolean }>) {
  if (!scroll) {
    return <View style={[S.page, padded && S.pagePad]}>{children}</View>;
  }
  return (
    <ScrollView
      style={S.page}
      contentContainerStyle={[S.pageContent, padded && S.pagePad]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: object }>) {
  return <View style={[S.card, style]}>{children}</View>;
}

// Backward-compat aliases
export const SectionCard = Card;

// ─── Typography ──────────────────────────────────────────────────────────────

export function ScreenTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={S.screenTitle}>
      <Text style={S.screenTitleText}>{title}</Text>
      {subtitle ? <Text style={S.screenSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export const SectionTitle = ScreenTitle;

export function CardTitle({ children }: PropsWithChildren) {
  return <Text style={S.cardTitle}>{children}</Text>;
}

export function Label({ children }: PropsWithChildren) {
  return <Text style={S.sectionLabel}>{children}</Text>;
}

// ─── KPI grid ────────────────────────────────────────────────────────────────

export function KpiGrid({ children }: PropsWithChildren) {
  return <View style={S.kpiGrid}>{children}</View>;
}

export function KpiCard({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <View style={[S.kpiCard, accent && S.kpiCardAccent]}>
      <Text style={S.kpiLabel}>{label}</Text>
      <Text style={[S.kpiValue, accent && S.kpiValueAccent]}>{value}</Text>
      {sub ? <Text style={S.kpiSub}>{sub}</Text> : null}
    </View>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const BADGE_MAP: Record<string, { bg: string; border: string; text: string }> = {
  ONLINE:      { bg: "#071f10", border: "#174d2a", text: "#4ade80" },
  OFFLINE:     { bg: "#111f35", border: "#1e2f4a", text: "#6b849f" },
  DEGRADED:    { bg: "#1f1007", border: "#4d2c17", text: "#fb923c" },
  MAINTENANCE: { bg: "#120d20", border: "#2e1f4d", text: "#a78bfa" },
  COMPLETED:   { bg: "#071f10", border: "#174d2a", text: "#4ade80" },
  PENDING:     { bg: "#0a0d20", border: "#1f244d", text: "#818cf8" },
  PROCESSING:  { bg: "#1f1007", border: "#4d2c17", text: "#fb923c" },
  FAILED:      { bg: "#1f0710", border: "#4d1728", text: "#f87171" },
  ACTIVE:      { bg: "#071f10", border: "#174d2a", text: "#4ade80" },
  GENERATED:   { bg: "#0a0d20", border: "#1f244d", text: "#818cf8" },
  DELIVERED:   { bg: "#071f10", border: "#174d2a", text: "#4ade80" },
  EXPIRED:     { bg: "#111f35", border: "#1e2f4a", text: "#6b849f" },
  REVOKED:     { bg: "#1f0710", border: "#4d1728", text: "#f87171" },
  DELIVERY_FAILED: { bg: "#1f0710", border: "#4d1728", text: "#f87171" },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = BADGE_MAP[status] ?? { bg: "#111f35", border: "#1e2f4a", text: "#6b849f" };
  return (
    <View style={[S.badge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <Text style={[S.badgeText, { color: cfg.text }]}>{status}</Text>
    </View>
  );
}

// ─── Form helpers ────────────────────────────────────────────────────────────

export function FormSection({
  title,
  subtitle,
  children,
}: PropsWithChildren<{ title?: string; subtitle?: string }>) {
  return (
    <View style={S.formSection}>
      {title ? <Label>{title}</Label> : null}
      {subtitle ? <Text style={S.formSectionSub}>{subtitle}</Text> : null}
      <Card>{children}</Card>
    </View>
  );
}

export function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  multiline,
  keyboardType = "default",
  editable = true,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad" | "url";
  editable?: boolean;
  hint?: string;
}) {
  return (
    <View style={S.field}>
      <Text style={S.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.textMuted}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        keyboardType={keyboardType}
        editable={editable}
        autoCapitalize="none"
        autoCorrect={false}
        style={[
          S.input,
          multiline && S.inputMulti,
          !editable && S.inputReadonly,
        ]}
      />
      {hint ? <Text style={S.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

// ─── Buttons ─────────────────────────────────────────────────────────────────

type ButtonKind = "primary" | "secondary" | "danger" | "ghost";

export function ActionButton({
  label,
  onPress,
  disabled,
  kind = "primary",
  loading = false,
  flex,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  kind?: ButtonKind;
  loading?: boolean;
  flex?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        S.btn,
        kind === "primary"   && S.btnPrimary,
        kind === "secondary" && S.btnSecondary,
        kind === "danger"    && S.btnDanger,
        kind === "ghost"     && S.btnGhost,
        (disabled || loading) && S.btnDisabled,
        flex && { flex: 1 },
        pressed && { opacity: 0.8 },
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={kind === "primary" ? "#fff" : C.primarySoft}
        />
      ) : (
        <Text
          style={[
            S.btnText,
            kind !== "primary" && S.btnTextAlt,
            kind === "danger"  && S.btnTextDanger,
            kind === "ghost"   && S.btnTextGhost,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

// ─── Feedback ────────────────────────────────────────────────────────────────

export function LoadingView({ label = "Chargement..." }: { label?: string }) {
  return (
    <View style={S.center}>
      <ActivityIndicator size="large" color={C.primary} />
      <Text style={S.mutedText}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={S.empty}>
      <Text style={S.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={S.emptySubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={S.errorBanner}>
      <Text style={S.errorText}>{message}</Text>
    </View>
  );
}

export function SuccessBanner({ message }: { message: string }) {
  return (
    <View style={S.successBanner}>
      <Text style={S.successText}>{message}</Text>
    </View>
  );
}

// ─── Data display ────────────────────────────────────────────────────────────

export function KeyValue({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <View style={S.kv}>
      <Text style={S.kvLabel}>{label}</Text>
      <Text style={S.kvValue}>{value}</Text>
    </View>
  );
}

export function Row({
  children,
  style,
}: PropsWithChildren<{ style?: object }>) {
  return <View style={[S.row, style]}>{children}</View>;
}

export function Divider() {
  return <View style={S.divider} />;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  // Layout
  page:             { flex: 1, backgroundColor: C.bgPage },
  pageContent:      { paddingBottom: 36, gap: 14 },
  pagePad:          { paddingHorizontal: 16, paddingTop: 16 },
  card:             {
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },

  // Typography
  screenTitle:      { gap: 3, paddingBottom: 2 },
  screenTitleText:  { color: C.text, fontSize: 22, fontWeight: "700", letterSpacing: -0.4 },
  screenSubtitle:   { color: C.textMuted, fontSize: 13 },
  cardTitle:        { color: C.text, fontSize: 14, fontWeight: "700" },
  sectionLabel:     {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingHorizontal: 4,
  },

  // KPI
  kpiGrid:          { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiCard:          {
    flex: 1,
    minWidth: "45%",
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  kpiCardAccent:    { borderColor: "#2e3260", backgroundColor: "#090c24" },
  kpiLabel:         { color: C.textMuted, fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6 },
  kpiValue:         { color: C.text, fontSize: 24, fontWeight: "700", letterSpacing: -0.5 },
  kpiValueAccent:   { color: C.primarySoft },
  kpiSub:           { color: C.textMuted, fontSize: 11 },

  // Badge
  badge:            {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  badgeText:        { fontSize: 9, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },

  // Form
  formSection:      { gap: 6 },
  formSectionSub:   { color: C.textMuted, fontSize: 11, marginTop: -2 },
  field:            { gap: 4 },
  fieldLabel:       { color: C.textSub, fontSize: 12, fontWeight: "600" },
  fieldHint:        { color: C.textMuted, fontSize: 11, marginTop: 1 },
  input:            {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bgInput,
    color: C.text,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
  },
  inputMulti:       { minHeight: 80, textAlignVertical: "top" },
  inputReadonly:    { opacity: 0.55 },

  // Buttons
  btn:              {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
  },
  btnPrimary:       { backgroundColor: C.primary },
  btnSecondary:     { backgroundColor: C.bgMuted, borderWidth: 1, borderColor: C.border },
  btnDanger:        { backgroundColor: C.dangerBg, borderWidth: 1, borderColor: C.dangerBorder },
  btnGhost:         { backgroundColor: "transparent" },
  btnDisabled:      { opacity: 0.4 },
  btnText:          { color: "#fff", fontSize: 14, fontWeight: "700" },
  btnTextAlt:       { color: C.textSub },
  btnTextDanger:    { color: C.danger },
  btnTextGhost:     { color: C.primarySoft },

  // Feedback
  center:           { minHeight: 260, justifyContent: "center", alignItems: "center", gap: 12 },
  mutedText:        { color: C.textMuted, fontSize: 13 },
  empty:            {
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 32,
    alignItems: "center",
    gap: 6,
  },
  emptyTitle:       { color: C.text, fontSize: 15, fontWeight: "700", textAlign: "center" },
  emptySubtitle:    { color: C.textMuted, fontSize: 13, textAlign: "center" },
  errorBanner:      {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.dangerBorder,
    backgroundColor: C.dangerBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText:        { color: C.danger, fontSize: 13 },
  successBanner:    {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.successBorder,
    backgroundColor: C.successBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  successText:      { color: C.success, fontSize: 13 },

  // Data
  kv:               { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 1 },
  kvLabel:          { color: C.textMuted, fontSize: 12 },
  kvValue:          { color: C.text, fontSize: 13, fontWeight: "600" },
  row:              { flexDirection: "row", gap: 8 },
  divider:          { height: 1, backgroundColor: C.border },
});
