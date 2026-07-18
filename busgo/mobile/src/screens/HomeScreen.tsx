import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api/client';
import { useAuth } from '../store/auth';
import { Button, Card, ErrorState, Loading, Row } from '../components/ui';
import { colors, radius } from '../theme';
import { localDateValue, shortDate } from '../utils/format';
import type { RootStackParamList } from '../nav';

type Nav = NativeStackNavigationProp<RootStackParamList>;

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

  const quickDates = useMemo(() => Array.from({ length: 5 }, (_, offset) => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    value.setDate(value.getDate() + offset);
    return { value, label: offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : value.toLocaleDateString(undefined, { weekday: 'short' }) };
  }), []);

  const search = () => {
    if (!origin || !destination) return Alert.alert('Select your route', 'Choose both departure and destination cities.');
    if (origin === destination) return Alert.alert('Choose different cities', 'Departure and destination cannot be the same.');
    navigation.navigate('Results', { origin, destination, date: localDateValue(date) });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.greeting}>Hello, {user?.full_name?.split(' ')[0] || 'traveller'}</Text>
          <Text style={styles.heroTitle}>Where are you going?</Text>
          <Text style={styles.heroText}>Compare direct buses and protected connecting journeys.</Text>
        </View>

        <Card style={{ marginTop: -26, marginHorizontal: 4 }}>
          {loadingCities ? <Loading label="Loading destinations…" /> : cityError ? <ErrorState message={cityError} onRetry={loadCities} /> : (
            <>
              <CityField icon="location-outline" label="From" value={origin} onPress={() => setCityTarget('origin')} />
              <Row style={{ justifyContent: 'center', marginVertical: -2, zIndex: 2 }}>
                <Pressable accessibilityLabel="Swap cities" onPress={() => { setOrigin(destination); setDestination(origin); }} style={styles.swap}>
                  <Ionicons name="swap-vertical" size={18} color={colors.primary} />
                </Pressable>
              </Row>
              <CityField icon="flag-outline" label="To" value={destination} onPress={() => setCityTarget('destination')} />

              <Text style={styles.label}>Journey date</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {quickDates.map(({ value, label }) => {
                  const active = localDateValue(date) === localDateValue(value);
                  return <Pressable key={localDateValue(value)} onPress={() => setDate(value)} style={[styles.dateChip, active && styles.dateChipActive]}>
                    <Text style={[styles.dateLabel, active && { color: '#fff' }]}>{label}</Text>
                    <Text style={{ fontSize: 10, color: active ? '#ffe4e6' : colors.faint }}>{value.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</Text>
                  </Pressable>;
                })}
                <Pressable onPress={() => setShowDate(true)} style={styles.dateChip}>
                  <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                  <Text style={{ fontSize: 10, color: colors.subtext }}>Other</Text>
                </Pressable>
              </ScrollView>
              <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 9 }}>Selected: {shortDate(localDateValue(date))}</Text>
              <Button title="Search buses" icon="search" onPress={search} style={{ marginTop: 16 }} />
            </>
          )}
        </Card>

        <Card style={{ marginTop: 16, marginHorizontal: 4 }}>
          <Row style={{ gap: 10 }}><Ionicons name="git-branch-outline" size={23} color={colors.info} /><View style={{ flex: 1 }}><Text style={{ fontWeight: '800', color: colors.text }}>Connecting journeys</Text><Text style={{ color: colors.subtext, fontSize: 13, lineHeight: 19, marginTop: 4 }}>Change buses at an intermediate city with one booking and one payment. You receive a ticket for every bus.</Text></View></Row>
        </Card>
      </ScrollView>

      <CityPicker visible={!!cityTarget} cities={cities} title={cityTarget === 'origin' ? 'Leaving from' : 'Going to'} excluded={cityTarget === 'origin' ? destination : origin} onClose={() => setCityTarget(null)} onSelect={(city) => { cityTarget === 'origin' ? setOrigin(city) : setDestination(city); setCityTarget(null); }} />
      {showDate && <DateTimePicker value={date} minimumDate={new Date()} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(_, selected) => { setShowDate(false); if (selected) setDate(selected); }} />}
    </View>
  );
}

function CityField({ icon, label, value, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.cityField}><Ionicons name={icon} size={22} color={colors.primary} /><View><Text style={{ fontSize: 11, color: colors.faint, fontWeight: '700' }}>{label}</Text><Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{value || 'Select city'}</Text></View></Pressable>;
}

function CityPicker({ visible, cities, title, excluded, onClose, onSelect }: { visible: boolean; cities: string[]; title: string; excluded: string; onClose: () => void; onSelect: (city: string) => void }) {
  const [query, setQuery] = useState('');
  const filtered = cities.filter((city) => city !== excluded && city.toLowerCase().includes(query.toLowerCase()));
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={styles.modalOverlay}><View style={styles.modalSheet}><Row style={{ justifyContent: 'space-between', marginBottom: 14 }}><Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }}>{title}</Text><Pressable onPress={onClose}><Ionicons name="close" size={26} color={colors.text} /></Pressable></Row><View style={styles.searchBox}><Ionicons name="search" size={18} color={colors.faint} /><TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Search city" placeholderTextColor={colors.faint} style={{ flex: 1, color: colors.text, paddingVertical: 10 }} /></View><ScrollView keyboardShouldPersistTaps="handled">{filtered.map((city) => <Pressable key={city} onPress={() => { setQuery(''); onSelect(city); }} style={styles.cityOption}><Ionicons name="location-outline" size={19} color={colors.primary} /><Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{city}</Text></Pressable>)}</ScrollView></View></View></Modal>;
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.dark, borderRadius: radius.xl, padding: 20, paddingBottom: 44 }, greeting: { color: '#fda4af', fontWeight: '700', fontSize: 13 }, heroTitle: { color: '#fff', fontWeight: '900', fontSize: 24, marginTop: 3 }, heroText: { color: '#94a3b8', fontSize: 12, marginTop: 5 },
  cityField: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: '#fff' }, swap: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 16, marginBottom: 8 }, dateChip: { minWidth: 68, height: 55, paddingHorizontal: 10, borderRadius: radius.md, backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, dateChipActive: { backgroundColor: colors.primary, borderColor: colors.primaryDark }, dateLabel: { fontWeight: '700', fontSize: 12, color: colors.text },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,.45)', justifyContent: 'flex-end' }, modalSheet: { backgroundColor: '#fff', maxHeight: '78%', minHeight: '55%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }, searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, marginBottom: 10 }, cityOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
});
