import React, { useCallback, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api/client';
import { Empty, ErrorState, Loading, Row } from '../components/ui';
import { TripCard } from '../components/TripCard';
import { applyTripFilters, DEFAULT_TRIP_FILTERS, TripFilterBar, TripFilterState } from '../components/TripFilters';
import { colors } from '../theme';
import { busDisplayName, localDateValue, shortDate } from '../utils/format';
import type { DirectTrip, RootStackParamList } from '../nav';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type SheetKind = 'origin' | 'destination' | null;

const dateKeyOf = (datetime: string) => {
  const date = new Date(datetime);
  return Number.isNaN(date.getTime()) ? datetime : localDateValue(date);
};

/**
 * P1.3: the website's all-routes browsing experience — every published trip,
 * grouped by journey date then origin → destination, with search, filters,
 * and sorting. Filter state lives in this tab, so returning from a seat
 * screen preserves it.
 */
export default function RoutesScreen() {
  const navigation = useNavigation<Nav>();
  const [trips, setTrips] = useState<DirectTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [showDate, setShowDate] = useState(false);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [filters, setFilters] = useState<TripFilterState>(DEFAULT_TRIP_FILTERS);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await api.get(`/api/operators/trips/?_t=${Date.now()}`);
      const now = Date.now();
      const nextTrips = ((response.data || []) as any[])
        .filter((trip) => String(trip.status || 'SCHEDULED').toUpperCase() === 'SCHEDULED' && trip.departure_datetime && new Date(trip.departure_datetime).getTime() > now)
        .map((trip) => ({ ...trip, trip_id: trip.trip_id || trip.id })) as DirectTrip[];
      setTrips(nextTrips);
    } catch (reason: any) { setError(reason.message || 'Could not load routes.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  // Load once per focus session, but do not clobber the user's scroll/filters
  // when they come back from the seat screen.
  useFocusEffect(useCallback(() => { if (!loaded) { setLoaded(true); load(); } }, [loaded, load]));

  const origins = useMemo(() => [...new Set(trips.map((trip) => trip.origin_city))].sort(), [trips]);
  const destinations = useMemo(() => [...new Set(trips.map((trip) => trip.destination_city))].sort(), [trips]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = trips
      .filter((trip) => !term
        || (trip.operator_name || '').toLowerCase().includes(term)
        || busDisplayName(trip).toLowerCase().includes(term)
        || trip.origin_city.toLowerCase().includes(term)
        || trip.destination_city.toLowerCase().includes(term))
      .filter((trip) => !origin || trip.origin_city === origin)
      .filter((trip) => !destination || trip.destination_city === destination)
      .filter((trip) => !dateFilter || dateKeyOf(trip.departure_datetime) === dateFilter);
    return applyTripFilters(base, filters);
  }, [trips, search, origin, destination, dateFilter, filters]);

  // Group by date, then by route; groups sort chronologically, cards keep the
  // selected in-group order from applyTripFilters.
  const groups = useMemo(() => {
    const byDate = new Map<string, Map<string, DirectTrip[]>>();
    for (const trip of filtered) {
      const dateKey = dateKeyOf(trip.departure_datetime);
      const routeKey = `${trip.origin_city} → ${trip.destination_city}`;
      if (!byDate.has(dateKey)) byDate.set(dateKey, new Map());
      const routes = byDate.get(dateKey)!;
      routes.set(routeKey, [...(routes.get(routeKey) || []), trip]);
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateKey, routes]) => ({
        dateKey,
        routes: [...routes.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([routeKey, routeTrips]) => ({ routeKey, trips: routeTrips })),
      }));
  }, [filtered]);

  const sheetOptions = sheet === 'origin' ? origins : destinations;
  const sheetValue = sheet === 'origin' ? origin : destination;
  const applySheet = (value: string) => {
    if (sheet === 'origin') setOrigin(value);
    if (sheet === 'destination') setDestination(value);
    setSheet(null);
  };

  return <View style={{ flex: 1, backgroundColor: colors.bg }}>
    {/* Search + route/date selectors */}
    <View style={styles.headerPanel}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={colors.faint} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search operator, bus, origin, destination" placeholderTextColor={colors.faint} style={{ flex: 1, color: colors.text, paddingVertical: 8, fontSize: 13 }} />
        {search ? <Pressable onPress={() => setSearch('')}><Ionicons name="close-circle" size={16} color={colors.faint} /></Pressable> : null}
      </View>
      <Row style={{ gap: 8, marginHorizontal: 16 }}>
        <SelectorField icon="radio-button-on" label="FROM" value={origin || 'All cities'} muted={!origin} onPress={() => setSheet('origin')} style={{ flex: 1 }} />
        <SelectorField icon="location" label="TO" value={destination || 'All cities'} muted={!destination} onPress={() => setSheet('destination')} style={{ flex: 1 }} />
        <SelectorField
          icon="calendar" label="DATE" value={dateFilter ? shortDate(dateFilter) : 'Any'} muted={!dateFilter}
          onPress={() => setShowDate(true)}
          onClear={dateFilter ? () => setDateFilter('') : undefined}
          style={{ flex: 0.9 }}
        />
      </Row>
    </View>

    <ScrollView contentContainerStyle={{ paddingVertical: 12, paddingBottom: 30 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      <TripFilterBar trips={trips} filters={filters} onChange={setFilters} />
      <Text style={{ paddingHorizontal: 16, marginTop: 12, marginBottom: 2, fontSize: 12, color: colors.subtext }}><Text style={{ fontWeight: '900', color: colors.text, fontSize: 14 }}>{filtered.length}</Text> trips found</Text>

      {loading ? <Loading label="Loading published routes…" /> : error ? <ErrorState message={error} onRetry={() => { setLoading(true); load(); }} /> : null}
      {!loading && !error && !filtered.length ? <Empty title="No trips match" subtitle="Try clearing the search, route, or date filters." icon="map-outline" /> : null}

      {!loading && !error ? groups.map((group) => <View key={group.dateKey}>
        <Row style={styles.dateHeader}>
          <Ionicons name="calendar" size={14} color={colors.primary} />
          <Text style={{ fontWeight: '900', fontSize: 14, color: colors.text }}>{new Date(`${group.dateKey}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</Text>
          <Text style={{ fontSize: 11, color: colors.faint, fontWeight: '700', marginLeft: 'auto' }}>{group.routes.reduce((sum, route) => sum + route.trips.length, 0)} trips</Text>
        </Row>
        {group.routes.map((route) => <View key={route.routeKey} style={{ paddingHorizontal: 16 }}>
          <Row style={{ gap: 6, marginBottom: 8, marginTop: 4 }}>
            <Ionicons name="map-outline" size={14} color={colors.primary} />
            <Text style={{ fontWeight: '800', color: colors.text }}>{route.routeKey}</Text>
            <View style={styles.busCount}><Text style={{ fontSize: 10, fontWeight: '800', color: colors.subtext }}>{route.trips.length} {route.trips.length === 1 ? 'bus' : 'buses'}</Text></View>
          </Row>
          {route.trips.map((trip) => <TripCard
            key={String(trip.trip_id)}
            trip={trip}
            onSelect={() => navigation.navigate('Seats', { trip, origin: trip.origin_city, destination: trip.destination_city, date: dateKeyOf(trip.departure_datetime) })}
          />)}
        </View>)}
      </View>) : null}
    </ScrollView>

    {/* City sheet */}
    <Modal visible={!!sheet} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setSheet(null)}>
      <View style={styles.modalOverlay}>
        <Pressable style={{ flex: 1 }} onPress={() => setSheet(null)} />
        <View style={styles.modalSheet}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 19, fontWeight: '900', color: colors.text }}>{sheet === 'origin' ? 'Leaving from' : 'Going to'}</Text>
            <Pressable onPress={() => setSheet(null)} style={styles.modalClose}><Ionicons name="close" size={20} color={colors.text} /></Pressable>
          </Row>
          <ScrollView>
            <Pressable onPress={() => applySheet('')} style={styles.cityOption}>
              <View style={[styles.cityOptionIcon, { backgroundColor: '#f1f5f9' }]}><Ionicons name="apps-outline" size={16} color={colors.subtext} /></View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 }}>All cities</Text>
              {!sheetValue ? <Ionicons name="checkmark-circle" size={19} color={colors.primary} /> : null}
            </Pressable>
            {sheetOptions.map((city) => <Pressable key={city} onPress={() => applySheet(city)} style={styles.cityOption}>
              <View style={styles.cityOptionIcon}><Ionicons name="location-outline" size={16} color={colors.primary} /></View>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, flex: 1 }}>{city}</Text>
              {sheetValue === city ? <Ionicons name="checkmark-circle" size={19} color={colors.primary} /> : null}
            </Pressable>)}
          </ScrollView>
        </View>
      </View>
    </Modal>

    {showDate && <DateTimePicker value={dateFilter ? new Date(`${dateFilter}T00:00:00`) : new Date()} minimumDate={new Date()} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(_, selected) => { setShowDate(false); if (selected) setDateFilter(localDateValue(selected)); }} />}
  </View>;
}

function SelectorField({ icon, label, value, muted, onPress, onClear, style }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; value: string; muted?: boolean;
  onPress: () => void; onClear?: () => void; style?: object;
}) {
  return <Pressable onPress={onPress} style={[styles.selector, style]}>
    <Row style={{ gap: 4 }}>
      <Ionicons name={icon} size={11} color={colors.primary} />
      <Text style={styles.selectorLabel}>{label}</Text>
    </Row>
    <Row style={{ justifyContent: 'space-between', marginTop: 2 }}>
      <Text style={[styles.selectorValue, muted && { color: colors.faint, fontWeight: '700' }]} numberOfLines={1}>{value}</Text>
      {onClear
        ? <Pressable hitSlop={8} onPress={onClear}><Ionicons name="close-circle" size={15} color={colors.faint} /></Pressable>
        : <Ionicons name="chevron-down" size={13} color={colors.faint} />}
    </Row>
  </Pressable>;
}

const styles = StyleSheet.create({
  headerPanel: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 12 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 7, marginHorizontal: 16, marginVertical: 10, paddingHorizontal: 11, backgroundColor: colors.bg, borderWidth: 1.5, borderColor: colors.border, borderRadius: 12 },
  selector: { backgroundColor: colors.bg, borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  selectorLabel: { fontSize: 9, fontWeight: '900', color: colors.faint, letterSpacing: 0.8 },
  selectorValue: { fontSize: 13, fontWeight: '800', color: colors.text, flex: 1, marginRight: 4 },
  dateHeader: { gap: 7, backgroundColor: '#fff', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 9, marginTop: 12, marginBottom: 8 },
  busCount: { backgroundColor: '#f1f5f9', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', maxHeight: '70%', minHeight: '40%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18 },
  modalClose: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  cityOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  cityOptionIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
