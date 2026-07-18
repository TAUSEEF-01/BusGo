import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api/client';
import { Chip, Empty, ErrorState, Loading, Row } from '../components/ui';
import { TripCard } from '../components/TripCard';
import { applyTripFilters, DEFAULT_TRIP_FILTERS, TripFilterBar, TripFilterState } from '../components/TripFilters';
import { colors } from '../theme';
import { busDisplayName, localDateValue, shortDate } from '../utils/format';
import type { DirectTrip, RootStackParamList } from '../nav';

type Nav = NativeStackNavigationProp<RootStackParamList>;

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

  return <View style={{ flex: 1, backgroundColor: colors.bg }}>
    {/* Search + route pickers */}
    <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 10 }}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={colors.faint} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search operator, bus, origin, destination" placeholderTextColor={colors.faint} style={{ flex: 1, color: colors.text, paddingVertical: 8, fontSize: 13 }} />
        {search ? <Pressable onPress={() => setSearch('')}><Ionicons name="close-circle" size={16} color={colors.faint} /></Pressable> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingHorizontal: 16, marginTop: 2 }}>
        <Chip icon="radio-button-on" label={origin || 'All origins'} active={!!origin} onPress={() => setOrigin('')} />
        {origins.filter((city) => city !== origin).slice(0, 8).map((city) => <Chip key={`o-${city}`} label={city} onPress={() => setOrigin(city)} />)}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingHorizontal: 16, marginTop: 8 }}>
        <Chip icon="location" label={destination || 'All destinations'} active={!!destination} onPress={() => setDestination('')} />
        {destinations.filter((city) => city !== destination).slice(0, 8).map((city) => <Chip key={`d-${city}`} label={city} onPress={() => setDestination(city)} />)}
        <Chip icon="calendar-outline" label={dateFilter ? shortDate(dateFilter) : 'Any date'} active={!!dateFilter} onPress={() => dateFilter ? setDateFilter('') : setShowDate(true)} />
      </ScrollView>
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

    {showDate && <DateTimePicker value={dateFilter ? new Date(`${dateFilter}T00:00:00`) : new Date()} minimumDate={new Date()} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(_, selected) => { setShowDate(false); if (selected) setDateFilter(localDateValue(selected)); }} />}
  </View>;
}

const styles = StyleSheet.create({
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 7, marginHorizontal: 16, marginVertical: 10, paddingHorizontal: 11, backgroundColor: colors.bg, borderWidth: 1.5, borderColor: colors.border, borderRadius: 12 },
  dateHeader: { gap: 7, backgroundColor: '#fff', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingHorizontal: 16, paddingVertical: 9, marginTop: 12, marginBottom: 8 },
  busCount: { backgroundColor: '#f1f5f9', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
});
