import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow } from '../theme';

export function Button({ title, onPress, disabled, loading, variant = 'primary', style, icon }: {
  title: string; onPress: () => void; disabled?: boolean; loading?: boolean;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger'; style?: ViewStyle; icon?: keyof typeof Ionicons.glyphMap;
}) {
  const primary = variant === 'primary';
  const danger = variant === 'danger';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        primary && { backgroundColor: pressed ? colors.primaryDark : colors.primary },
        danger && { backgroundColor: pressed ? '#b91c1c' : colors.danger },
        variant === 'outline' && styles.btnOutline,
        variant === 'ghost' && { backgroundColor: 'transparent' },
        (disabled || loading) && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={primary || danger ? '#fff' : colors.primary} /> : (
        <Row style={{ gap: 7, justifyContent: 'center' }}>
          {icon ? <Ionicons name={icon} size={18} color={primary || danger ? '#fff' : colors.primary} /> : null}
          <Text style={[styles.btnText, { color: primary || danger ? '#fff' : colors.primary }]}>{title}</Text>
        </Row>
      )}
    </Pressable>
  );
}

export function Input(props: TextInputProps & { label?: string; error?: string }) {
  const { label, error, style, ...rest } = props;
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput placeholderTextColor={colors.faint} style={[styles.input, error ? { borderColor: colors.danger } : null, style]} {...rest} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Badge({ text, tone = 'info' }: { text: string; tone?: 'info' | 'success' | 'warn' | 'primary' | 'neutral' | 'danger' }) {
  const map = {
    info: { bg: colors.infoSoft, fg: colors.info }, success: { bg: colors.successSoft, fg: colors.success },
    warn: { bg: colors.warnSoft, fg: colors.warn }, primary: { bg: colors.primarySoft, fg: colors.primary },
    neutral: { bg: '#f1f5f9', fg: colors.subtext }, danger: { bg: '#fee2e2', fg: colors.danger },
  } as const;
  const value = map[tone];
  return <View style={{ backgroundColor: value.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' }}><Text style={{ color: value.fg, fontSize: 11, fontWeight: '700' }}>{text}</Text></View>;
}

export function Empty({ title, subtitle }: { title: string; subtitle?: string }) {
  return <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 }}>
    <Ionicons name="bus-outline" size={42} color={colors.faint} />
    <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text, marginTop: 10, marginBottom: 4 }}>{title}</Text>
    {subtitle ? <Text style={{ color: colors.subtext, textAlign: 'center', fontSize: 13 }}>{subtitle}</Text> : null}
  </View>;
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 }}>
    <Ionicons name="cloud-offline-outline" size={40} color={colors.danger} />
    <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text, marginTop: 10 }}>{title}</Text>
    <Text style={{ color: colors.subtext, textAlign: 'center', fontSize: 13, marginTop: 5, lineHeight: 19 }}>{message}</Text>
    {onRetry ? <Button title="Try again" variant="outline" onPress={onRetry} style={{ marginTop: 16, paddingHorizontal: 28 }} /> : null}
  </View>;
}

export function Loading({ label }: { label?: string }) {
  return <View style={{ alignItems: 'center', paddingVertical: 40 }}><ActivityIndicator size="large" color={colors.primary} />{label ? <Text style={{ marginTop: 10, color: colors.subtext }}>{label}</Text> : null}</View>;
}

export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>{children}</View>;
}

export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}><Text style={{ fontWeight: '900', fontSize: 16, color: colors.text }}>{title}</Text>{action}</Row>;
}

const styles = StyleSheet.create({
  btn: { minHeight: 48, borderRadius: radius.md, paddingVertical: 13, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  btnOutline: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: 'transparent' },
  btnText: { fontWeight: '800', fontSize: 15 },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text, backgroundColor: '#fff' },
  error: { color: colors.danger, fontSize: 12, marginTop: 4 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16, ...shadow },
});
