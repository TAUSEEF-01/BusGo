import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, TextInput, TextInputProps, TextStyle, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, shadowBrand } from '../theme';

export function Button({ title, onPress, disabled, loading, variant = 'primary', style, icon }: {
  title: string; onPress: () => void; disabled?: boolean; loading?: boolean;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger'; style?: StyleProp<ViewStyle>; icon?: keyof typeof Ionicons.glyphMap;
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
        primary && { backgroundColor: pressed ? colors.primaryDark : colors.primary, ...(!disabled && !loading ? shadowBrand : null) },
        danger && { backgroundColor: pressed ? '#b91c1c' : colors.danger },
        variant === 'outline' && styles.btnOutline,
        variant === 'ghost' && { backgroundColor: 'transparent' },
        (disabled || loading) && { opacity: 0.5 },
        pressed && !disabled && !loading ? { transform: [{ scale: 0.98 }] } : null,
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

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Badge({ text, tone = 'info' }: { text: string; tone?: 'info' | 'success' | 'warn' | 'primary' | 'neutral' | 'danger' }) {
  const map = {
    info: { bg: colors.infoSoft, fg: colors.info }, success: { bg: colors.successSoft, fg: colors.success },
    warn: { bg: colors.warnSoft, fg: colors.warn }, primary: { bg: colors.primarySoft, fg: colors.primary },
    neutral: { bg: '#f1f5f9', fg: colors.subtext }, danger: { bg: colors.dangerSoft, fg: colors.danger },
  } as const;
  const value = map[tone];
  return <View style={{ backgroundColor: value.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' }}><Text style={{ color: value.fg, fontSize: 11, fontWeight: '700' }}>{text}</Text></View>;
}

/**
 * Operator initials avatar — mirrors the web app's getOperatorLogo so the two
 * clients brand the same operators identically.
 */
export function OperatorLogo({ name, size = 42 }: { name: string; size?: number }) {
  const normalized = (name || '').toLowerCase();
  let text: string;
  let bg = colors.primaryDark;
  let fg = '#fff';
  let border: string | undefined;
  let fontStyle: TextStyle = {};
  if (normalized.includes('greenline') || normalized.includes('green line')) {
    text = 'GP'; bg = colors.dark;
  } else if (normalized.includes('shohagh')) {
    text = 'S'; bg = '#dc2626'; fontStyle = { fontSize: size * 0.42 };
  } else if (normalized.includes('hanif')) {
    text = 'HF'; bg = '#451a03'; fg = '#fbbf24'; border = 'rgba(245,158,11,0.25)';
  } else {
    text = (name || 'B').split(' ').map((word) => word[0]).join('').toUpperCase().slice(0, 2) || 'B';
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size * 0.3, backgroundColor: bg,
      alignItems: 'center', justifyContent: 'center', ...shadow,
      ...(border ? { borderWidth: 1, borderColor: border } : null),
    }}>
      <Text style={[{ color: fg, fontWeight: '900', fontSize: size * 0.33, letterSpacing: 0.5 }, fontStyle]}>{text}</Text>
    </View>
  );
}

/**
 * Departure → arrival visual: times and cities at either end, a track with a
 * bus glyph in the middle — the mobile version of the web card's trip timeline.
 */
export function TripTimeline({ depTime, depCity, arrTime, arrCity, depSub, arrSub, centerLabel }: {
  depTime: string; depCity: string; arrTime: string; arrCity: string;
  depSub?: string | null; arrSub?: string | null; centerLabel?: string;
}) {
  return (
    <Row style={{ gap: 10, alignItems: 'flex-start' }}>
      <View style={{ minWidth: 86 }}>
        <Text style={timelineStyles.time}>{depTime}</Text>
        <Text style={timelineStyles.city} numberOfLines={1}>{depCity}</Text>
        {depSub ? <Text style={timelineStyles.sub} numberOfLines={1}>{depSub}</Text> : null}
      </View>
      <View style={{ flex: 1, alignItems: 'center', paddingTop: 4 }}>
        {centerLabel ? <Text style={timelineStyles.center}>{centerLabel}</Text> : null}
        <Row style={{ alignSelf: 'stretch', gap: 2 }}>
          <View style={timelineStyles.dot} />
          <View style={timelineStyles.track}>
            <View style={timelineStyles.busWrap}><Ionicons name="bus" size={13} color={colors.primary} /></View>
          </View>
          <View style={timelineStyles.dot} />
        </Row>
      </View>
      <View style={{ minWidth: 86, alignItems: 'flex-end' }}>
        <Text style={timelineStyles.time}>{arrTime}</Text>
        <Text style={timelineStyles.city} numberOfLines={1}>{arrCity}</Text>
        {arrSub ? <Text style={[timelineStyles.sub, { textAlign: 'right' }]} numberOfLines={1}>{arrSub}</Text> : null}
      </View>
    </Row>
  );
}

/** Small pill chip — used for dates, filters, seats, amenities. */
export function Chip({ label, icon, active, onPress, style }: {
  label: string; icon?: keyof typeof Ionicons.glyphMap; active?: boolean; onPress?: () => void; style?: StyleProp<ViewStyle>;
}) {
  const body = (
    <Row style={[{
      gap: 5, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999,
      backgroundColor: active ? colors.primary : '#fff',
      borderWidth: 1.5, borderColor: active ? colors.primaryDark : colors.border,
    }, style]}>
      {icon ? <Ionicons name={icon} size={13} color={active ? '#fff' : colors.subtext} /> : null}
      <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#fff' : colors.text }}>{label}</Text>
    </Row>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: colors.borderSoft, marginVertical: 12 }, style]} />;
}

/** Dashed ticket divider with the classic punched notches on both sides. */
export function TicketDivider({ notchColor = colors.bg }: { notchColor?: string }) {
  return (
    <View style={{ marginVertical: 14, height: 20, justifyContent: 'center' }}>
      <View style={{ borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border }} />
      <View style={{ position: 'absolute', left: -26, width: 20, height: 20, borderRadius: 10, backgroundColor: notchColor }} />
      <View style={{ position: 'absolute', right: -26, width: 20, height: 20, borderRadius: 10, backgroundColor: notchColor }} />
    </View>
  );
}

export function Empty({ title, subtitle, icon = 'bus-outline' }: { title: string; subtitle?: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 }}>
    <View style={{ width: 74, height: 74, borderRadius: 24, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
      <Ionicons name={icon} size={36} color={colors.faint} />
    </View>
    <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text, marginTop: 10, marginBottom: 4 }}>{title}</Text>
    {subtitle ? <Text style={{ color: colors.subtext, textAlign: 'center', fontSize: 13, lineHeight: 19 }}>{subtitle}</Text> : null}
  </View>;
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 }}>
    <View style={{ width: 66, height: 66, borderRadius: 22, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="cloud-offline-outline" size={32} color={colors.danger} />
    </View>
    <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text, marginTop: 12 }}>{title}</Text>
    <Text style={{ color: colors.subtext, textAlign: 'center', fontSize: 13, marginTop: 5, lineHeight: 19 }}>{message}</Text>
    {onRetry ? <Button title="Try again" variant="outline" onPress={onRetry} style={{ marginTop: 16, paddingHorizontal: 28 }} /> : null}
  </View>;
}

export function Loading({ label }: { label?: string }) {
  return <View style={{ alignItems: 'center', paddingVertical: 40 }}><ActivityIndicator size="large" color={colors.primary} />{label ? <Text style={{ marginTop: 10, color: colors.subtext }}>{label}</Text> : null}</View>;
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>{children}</View>;
}

export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}><Text style={{ fontWeight: '900', fontSize: 16, color: colors.text }}>{title}</Text>{action}</Row>;
}

const timelineStyles = StyleSheet.create({
  time: { fontWeight: '900', fontSize: 17, color: colors.text },
  city: { fontWeight: '700', fontSize: 12, color: colors.subtext, marginTop: 1 },
  sub: { fontSize: 10, color: colors.faint, marginTop: 1 },
  center: { fontSize: 10, fontWeight: '700', color: colors.faint, marginBottom: 3 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary, alignSelf: 'center' },
  track: { flex: 1, height: 1.5, backgroundColor: colors.primaryBorder, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  busWrap: { position: 'absolute', top: -9, backgroundColor: '#fff', paddingHorizontal: 3 },
});

const styles = StyleSheet.create({
  btn: { minHeight: 48, borderRadius: radius.md, paddingVertical: 13, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  btnOutline: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: 'transparent' },
  btnText: { fontWeight: '800', fontSize: 15 },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text, backgroundColor: '#fff' },
  error: { color: colors.danger, fontSize: 12, marginTop: 4 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16, ...shadow },
});
