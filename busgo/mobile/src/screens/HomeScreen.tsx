import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api/client';
import { useAuth } from '../store/auth';
import { Button, Card, ErrorState, Loading, Row } from '../components/ui';
import { colors, radius, shadowLifted } from '../theme';
import { localDateValue, shortDate } from '../utils/format';
import type { RootStackParamList } from '../nav';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type RecentSearch = { origin: string; destination: string; savedAt: number };

const RECENT_KEY = 'busgo.recent-searches';
const MAX_RECENT = 4;

const PERKS: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }[] = [
  { icon: 'shield-checkmark', title: 'Secure payments', text: 'bKash, Nagad & cards' },
  { icon: 'qr-code', title: 'Instant e-tickets', text: 'QR straight to your phone' },
  { icon: 'git-branch', title: 'Connecting trips', text: 'One booking, many buses' },
];

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const [cities, setCities] = useState<string[]>([]);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState(new Date());
  const [cityTarget, setCityTarget] = useState<'origin' | 'destination' | null>(null);
  const [showDate, setShowDate] = useState(false);
  const [loadingCities, setLoadingCities] = useState(true);
  const [cityError, setCityError] = useState('');
  const [recent, setRecent] = useState<RecentSearch[]>([]);

  const loadCities = useCallback(async () => {
    setLoadingCities(true);
    setCityError('');
    try {
      const response = await api.get<{ success: boolean; data: string[] }>('/api/search/cities');
      const list = [...new Set(response.data || [])].sort((a, b) => a.localeCompare(b));
      if (!list.length) throw new Error('No active routes are available yet.');
      setCities(list);
      setOrigin((current) => current || list[0]);
      setDestination((current) => current || list.find((city) => city !== list[0]) || '');
    } catch (error: any) {
      setCityError(error.message || 'Could not load destinations.');
    } finally {
      setLoadingCities(false);
    }
  }, []);

  useEffect(() => { loadCities(); }, [loadCities]);
  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem(RECENT_KEY).then((raw) => { if (raw) try { setRecent(JSON.parse(raw)); } catch { /* corrupt cache */ } });
  }, []));

  const quickDates = useMemo(() => Array.from({ length: 5 }, (_, offset) => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    value.setDate(value.getDate() + offset);
    return { value, label: offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : value.toLocaleDateString(undefined, { weekday: 'short' }) };
  }), []);

  const rememberSearch = async (from: string, to: string) => {
    const next = [{ origin: from, destination: to, savedAt: Date.now() },
      ...recent.filter((item) => !(item.origin === from && item.destination === to))].slice(0, MAX_RECENT);
    setRecent(next);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
  };

  const search = (from = origin, to = destination) => {
    if (!from || !to) return Alert.alert('Select your route', 'Choose both departure and destination cities.');
    if (from === to) return Alert.alert('Choose different cities', 'Departure and destination cannot be the same.');
    rememberSearch(from, to);
    navigation.navigate('Results', { origin: from, destination: to, date: localDateValue(date) });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroCircleA} />
          <View style={styles.heroCircleB} />
          <Row style={{ gap: 9, marginBottom: 18 }}>
            <View style={styles.logoBox}><Ionicons name="bus" size={20} color="#fff" /></View>
            <Text style={styles.logoText}>BusGo</Text>
          </Row>
          <Text style={styles.greeting}>Hello, {user?.full_name?.split(' ')[0] || 'traveller'} 👋</Text>
          <Text style={styles.heroTitle}>Where are you{'\n'}going today?</Text>
        </View>

        {/* Search card overlapping the hero */}
        <Card style={[{ marginTop: -46, marginHorizontal: 16, borderRadius: radius.xl, padding: 18 }, shadowLifted]}>
          {loadingCities ? <Loading label="Loading destinations…" /> : cityError ? <ErrorState message={cityError} onRetry={loadCities} /> : (
            <>
              <CityField icon="radio-button-on" label="FROM" value={origin} onPress={() => setCityTarget('origin')} />
              <Row style={{ justifyContent: 'flex-end', marginVertical: -14, zIndex: 2, paddingRight: 18 }}>
                <Pressable accessibilityLabel="Swap cities" onPress={() => { setOrigin(destination); setDestination(origin); }} style={styles.swap}>
                  <Ionicons name="swap-vertical" size={19} color="#fff" />
                </Pressable>
              </Row>
              <CityField icon="location" label="TO" value={destination} onPress={() => setCityTarget('destination')} />

              <Text style={styles.label}>Journey date</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {quickDates.map(({ value, label }) => {
                  const active = localDateValue(date) === localDateValue(value);
                  return <Pressable key={localDateValue(value)} onPress={() => setDate(value)} style={[styles.dateChip, active && styles.dateChipActive]}>
                    <Text style={[styles.dateLabel, active && { color: '#fff' }]}>{label}</Text>
                    <Text style={{ fontSize: 10, color: active ? '#fecaca' : colors.faint }}>{value.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</Text>
                  </Pressable>;
                })}
                <Pressable onPress={() => setShowDate(true)} style={styles.dateChip}>
                  <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                  <Text style={{ fontSize: 10, color: colors.subtext }}>Other</Text>
                </Pressable>
              </ScrollView>
              <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 9 }}>Selected: {shortDate(localDateValue(date))}</Text>
              <Button title="Search buses" icon="search" onPress={() => search()} style={{ marginTop: 16 }} />
            </>
          )}
        </Card>

        {/* Recent searches */}
        {recent.length > 0 ? (
          <View style={{ marginTop: 18, paddingHorizontal: 16 }}>
            <Text style={styles.sectionTitle}>Recent searches</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {recent.map((item) => (
                <Pressable key={`${item.origin}-${item.destination}`} onPress={() => { setOrigin(item.origin); setDestination(item.destination); search(item.origin, item.destination); }} style={styles.recentChip}>
                  <Ionicons name="time-outline" size={14} color={colors.primary} />
                  <Text style={{ fontWeight: '700', fontSize: 12, color: colors.text }}>{item.origin}</Text>
                  <Ionicons name="arrow-forward" size={11} color={colors.faint} />
                  <Text style={{ fontWeight: '700', fontSize: 12, color: colors.text }}>{item.destination}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Perks */}
        <View style={{ marginTop: 18, paddingHorizontal: 16 }}>
          <Text style={styles.sectionTitle}>Travel with confidence</Text>
          <Row style={{ gap: 10, alignItems: 'stretch' }}>
            {PERKS.map((perk) => (
              <View key={perk.title} style={styles.perk}>
                <View style={styles.perkIcon}><Ionicons name={perk.icon} size={18} color={colors.primary} /></View>
                <Text style={{ fontWeight: '800', fontSize: 12, color: colors.text, marginTop: 8 }}>{perk.title}</Text>
                <Text style={{ fontSize: 10, color: colors.subtext, marginTop: 2, lineHeight: 14 }}>{perk.text}</Text>
              </View>
            ))}
          </Row>
        </View>

        {/* Connecting journeys banner */}
        <Card style={{ marginTop: 14, marginHorizontal: 16, backgroundColor: colors.dark, borderColor: colors.dark }}>
          <Row style={{ gap: 12 }}>
            <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(220,38,38,0.22)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="git-branch-outline" size={22} color="#fca5a5" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', color: '#fff' }}>Connecting journeys</Text>
              <Text style={{ color: '#94a3b8', fontSize: 12, lineHeight: 18, marginTop: 3 }}>Change buses at an intermediate city with one booking and one payment — a ticket for every bus.</Text>
            </View>
          </Row>
        </Card>
      </ScrollView>

      <CityPicker visible={!!cityTarget} cities={cities} title={cityTarget === 'origin' ? 'Leaving from' : 'Going to'} excluded={cityTarget === 'origin' ? destination : origin} onClose={() => setCityTarget(null)} onSelect={(city) => { cityTarget === 'origin' ? setOrigin(city) : setDestination(city); setCityTarget(null); }} />
      {showDate && <DateTimePicker value={date} minimumDate={new Date()} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(_, selected) => { setShowDate(false); if (selected) setDate(selected); }} />}
    </View>
  );
}

function CityField({ icon, label, value, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.cityField}>
    <View style={styles.cityIcon}><Ionicons name={icon} size={17} color={colors.primary} /></View>
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 10, color: colors.faint, fontWeight: '800', letterSpacing: 0.8 }}>{label}</Text>
      <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }} numberOfLines={1}>{value || 'Select city'}</Text>
    </View>
    <Ionicons name="chevron-down" size={17} color={colors.faint} />
  </Pressable>;
}

function CityPicker({ visible, cities, title, excluded, onClose, onSelect }: { visible: boolean; cities: string[]; title: string; excluded: string; onClose: () => void; onSelect: (city: string) => void }) {
  const [query, setQuery] = useState('');
  const filtered = cities.filter((city) => city !== excluded && city.toLowerCase().includes(query.toLowerCase()));
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={styles.modalOverlay}><View style={styles.modalSheet}><Row style={{ justifyContent: 'space-between', marginBottom: 14 }}><Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }}>{title}</Text><Pressable onPress={onClose} style={styles.modalClose}><Ionicons name="close" size={20} color={colors.text} /></Pressable></Row><View style={styles.searchBox}><Ionicons name="search" size={18} color={colors.faint} /><TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Search city" placeholderTextColor={colors.faint} style={{ flex: 1, color: colors.text, paddingVertical: 10 }} /></View><ScrollView keyboardShouldPersistTaps="handled">{filtered.map((city) => <Pressable key={city} onPress={() => { setQuery(''); onSelect(city); }} style={styles.cityOption}><View style={styles.cityOptionIcon}><Ionicons name="location-outline" size={17} color={colors.primary} /></View><Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{city}</Text></Pressable>)}</ScrollView></View></View></Modal>;
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.dark, padding: 20, paddingTop: 58, paddingBottom: 72, overflow: 'hidden' },
  heroCircleA: { position: 'absolute', width: 210, height: 210, borderRadius: 105, backgroundColor: 'rgba(220,38,38,0.18)', top: -70, right: -60 },
  heroCircleB: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(220,38,38,0.10)', bottom: -30, left: -40 },
  logoBox: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontWeight: '900', fontSize: 19, letterSpacing: 0.3 },
  greeting: { color: '#fca5a5', fontWeight: '700', fontSize: 13 },
  heroTitle: { color: '#fff', fontWeight: '900', fontSize: 28, marginTop: 4, lineHeight: 34 },
  sectionTitle: { fontWeight: '900', fontSize: 15, color: colors.text, marginBottom: 9 },
  cityField: { flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff' },
  cityIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  swap: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 16, marginBottom: 8 },
  dateChip: { minWidth: 68, height: 55, paddingHorizontal: 10, borderRadius: radius.md, backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  dateChipActive: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
  dateLabel: { fontWeight: '700', fontSize: 12, color: colors.text },
  recentChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  perk: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 12 },
  perkIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', maxHeight: '78%', minHeight: '55%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalClose: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, marginBottom: 10 },
  cityOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  cityOptionIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
