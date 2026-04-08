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

type PageProps = PropsWithChildren<{
  scroll?: boolean;
  padded?: boolean;
}>;

export function Page({ children, scroll = true, padded = true }: PageProps) {
  if (!scroll) {
    return <View style={[styles.page, padded && styles.pagePadding]}>{children}</View>;
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.pageContent, padded && styles.pagePadding]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function SectionCard({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

export function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionTitleText}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

type InputFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad" | "url";
};

export function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  multiline,
  keyboardType = "default",
}: InputFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8a96ad"
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, multiline && styles.inputMultiline]}
      />
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  kind?: "primary" | "secondary" | "danger";
};

export function ActionButton({ label, onPress, disabled, kind = "primary" }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        kind === "primary" && styles.buttonPrimary,
        kind === "secondary" && styles.buttonSecondary,
        kind === "danger" && styles.buttonDanger,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          kind === "primary" && styles.buttonPrimaryText,
          kind === "secondary" && styles.buttonSecondaryText,
          kind === "danger" && styles.buttonDangerText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function LoadingView({ label = "Chargement..." }: { label?: string }) {
  return (
    <View style={styles.centeredBlock}>
      <ActivityIndicator size="large" color="#8bc8ff" />
      <Text style={styles.mutedText}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.emptyBlock}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function KeyValue({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <View style={styles.keyValue}>
      <Text style={styles.keyValueLabel}>{label}</Text>
      <Text style={styles.keyValueValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#0b1018",
  },
  pageContent: {
    paddingBottom: 24,
    gap: 12,
  },
  pagePadding: {
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  card: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#243248",
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  sectionTitle: {
    gap: 3,
  },
  sectionTitleText: {
    color: "#ecf3ff",
    fontSize: 18,
    fontWeight: "700",
  },
  sectionSubtitle: {
    color: "#a4b2ca",
    fontSize: 13,
  },
  field: {
    gap: 5,
  },
  fieldLabel: {
    color: "#d6e4fc",
    fontSize: 12,
    fontWeight: "600",
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2f4668",
    backgroundColor: "#0a1422",
    color: "#f2f7ff",
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
  },
  inputMultiline: {
    minHeight: 76,
    textAlignVertical: "top",
  },
  button: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: {
    backgroundColor: "#c8f7e1",
  },
  buttonSecondary: {
    backgroundColor: "#1c2b45",
    borderWidth: 1,
    borderColor: "#2f4668",
  },
  buttonDanger: {
    backgroundColor: "#441f2a",
    borderWidth: 1,
    borderColor: "#813448",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  buttonPrimaryText: {
    color: "#082617",
  },
  buttonSecondaryText: {
    color: "#d8e7ff",
  },
  buttonDangerText: {
    color: "#ffc7d5",
  },
  centeredBlock: {
    minHeight: 220,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  mutedText: {
    color: "#a9b8d2",
    fontSize: 13,
  },
  emptyBlock: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#243248",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  emptyTitle: {
    color: "#ecf3ff",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  emptySubtitle: {
    color: "#a4b2ca",
    fontSize: 13,
    textAlign: "center",
  },
  errorBanner: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#7d3346",
    backgroundColor: "#3c1f29",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    color: "#ffc9d4",
    fontSize: 13,
  },
  keyValue: {
    gap: 2,
  },
  keyValueLabel: {
    color: "#90a3c0",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  keyValueValue: {
    color: "#e6f0ff",
    fontSize: 14,
    fontWeight: "600",
  },
});

