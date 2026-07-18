import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { Badge, Button, Card, Chip, Empty, ErrorState, Loading, Row } from '../components/ui';
import { TripCard } from '../components/TripCard';
import { applyTripFilters, DEFAULT_TRIP_FILTERS, TripFilterBar, TripFilterState } from '../components/TripFilters';
import { colors } from '../theme';
import { money, shortDate, shortTime } from '../utils/format';
import { DirectTrip, Itinerary, ScreenProps } from '../nav';

type JourneyKind = 'all' | 'direct' | 'connecting';

export default function ResultsScreen({ route, navigation }: ScreenProps<'Results'>) {
  const { origin, destination, date, returnDate, isReturnLeg, outbound } = route.params;
  const [trips, setTrips] = useState<DirectTrip[]>([]);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [kind, setKind] = useState<JourneyKind>('all');
  const [filters, setFilters] = useState<TripFilterState>(DEFAULT_TRIP_FILTERS);

  const load = useCallback(async () => {
    setError('');
    try {
      const [direct, transit] = await Promise.all([
        api.get(`/api/operators/trips/?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&date=${date}T00:00:00`),
        // A return leg is always booked as a direct trip in the same checkout.
        isReturnLeg ? Promise.resolve({ data: { itineraries: [] } }) : api.get(`/api/transit/search?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&journey_date=${date}`),
      ]);
      const directTrips = ((direct.data || []) as DirectTrip[])
        .filter((trip) => String((trip as any).status || 'SCHEDULED').toUpperCase() === 'SCHEDULED');
      const transitTrips = ((transit.data?.itineraries || []) as Itinerary[]).filter((item) => item.leg_count > 1);
      setTrips(directTrips);
      setItineraries(transitTrips);
    } catch (reason: any) {
      setError(reason.message || 'Could not search buses.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [origin, destination, date, isReturnLeg]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const filteredTrips = useMemo(() => applyTripFilters(trips, filters), [trips, filters]);
  const showDirect = kind !== 'connecting';
  const showConnecting = kind !== 'direct' && !isReturnLeg;
  const visibleCount = (showDirect ? filteredTrips.length : 0) + (showConnecting ? itineraries.length : 0);

  return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 30 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
    {/* Route summary header */}
    <View style={styles.headerBar}>
      {isReturnLeg ? <Row style={{ gap: 6, marginBottom: 6 }}><View style={styles.stepBubble}><Text style={{ color: '#fff', fontWeight: '900', fontSize: 11 }}>2</Text></View><Text style={{ color: '#fca5a5', fontSize: 12, fontWeight: '800' }}>Select your RETURN bus</Text></Row> : null}
      <Row style={{ gap: 8 }}>
        <Text style={styles.routeTitle} numberOfLines={1}>{origin}</Text>
        <Ionicons name="arrow-forward" size={17} color="#fca5a5" />
        <Text style={styles.routeTitle} numberOfLines={1}>{destination}</Text>
      </Row>
      <Row style={{ gap: 6, marginTop: 5 }}>
        <Ionicons name="calendar-outline" size={13} color="#94a3b8" />
        <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '600' }}>{shortDate(date)} · {visibleCount} options{returnDate && !isReturnLeg ? ` · returns ${shortDate(returnDate)}` : ''}</Text>
      </Row>
      {isReturnLeg && outbound ? <Row style={{ gap: 6, marginTop: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, alignSelf: 'flex-start' }}>
        <Ionicons name="checkmark-circle" size={14} color="#4ade80" />
        <Text style={{ color: '#e2e8f0', fontSize: 11, fontWeight: '700' }}>Outbound: {outbound.trip.operator_name} · seats {outbound.seats.join(', ')} · {money(outbound.total)}</Text>
      </Row> : null}
    </View>

    {/* Journey-type + filters */}
    <View style={{ paddingTop: 12, gap: 8 }}>
      {!isReturnLeg ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingHorizontal: 16 }}>
        {(['all', 'direct', 'connecting'] as JourneyKind[]).map((item) => <Chip key={item} label={item === 'all' ? 'All journeys' : item === 'direct' ? 'Direct only' : 'Connecting only'} active={kind === item} onPress={() => setKind(item)} />)}
      </ScrollView> : null}
      <TripFilterBar trips={trips} filters={filters} onChange={setFilters} />
    </View>

    <View style={{ padding: 16 }}>
      {loading ? <Loading label="Searching buses and connections…" /> : error ? <ErrorState title="Search unavailable" message={error} onRetry={() => { setLoading(true); load(); }} /> : null}
      {!loading && !error && !visibleCount ? <Empty title="No buses found" subtitle="Try another date, route, or fewer filters." icon="search-outline" /> : null}

      {!loading && !error && showConnecting && itineraries.length > 0 ? <>
        <Text style={styles.section}>Connecting journeys</Text>
        {itineraries.map((item) => <Card key={item.itinerary_id} style={{ marginBottom: 12 }}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <Badge tone={item.source === 'operator' ? 'primary' : 'info'} text={item.source === 'operator' ? 'Operator-guaranteed' : 'BusGo connection'} />
            <Row style={{ gap: 4 }}><Ionicons name="time-outline" size={13} color={colors.subtext} /><Text style={{ fontSize: 12, fontWeight: '700', color: colors.subtext }}>{Math.floor(item.total_duration_minutes / 60)}h {item.total_duration_minutes % 60}m</Text></Row>
          </Row>
          {item.legs.map((leg, index) => <View key={leg.trip_id}>
            <Row style={{ alignItems: 'flex-start', gap: 10 }}>
              <View style={styles.legBubble}><Text style={styles.legBubbleText}>{index + 1}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', color: colors.text }}>{leg.origin_city} → {leg.destination_city}</Text>
                <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 1 }}>{leg.operator_name || `Bus ${index + 1}`}{leg.bus_registration_no ? ` · ${leg.bus_registration_no}` : ''}{leg.bus_type ? ` · ${leg.bus_type}` : ''}</Text>
                <Text style={{ fontSize: 12, color: colors.faint, marginTop: 1 }}>{shortTime(leg.departure_datetime)} – {shortTime(leg.arrival_datetime)} · {leg.available_seats} seats left</Text>
              </View>
              <Text style={{ fontWeight: '800', color: colors.text }}>{money(leg.fare_amount)}</Text>
            </Row>
            {index < item.legs.length - 1 && item.transfers[index] ? <View style={styles.transfer}><Ionicons name="swap-horizontal" size={13} color={colors.warn} /><Text style={{ fontSize: 11, color: colors.warn, fontWeight: '700' }}>Change at {item.transfers[index].city} · {item.transfers[index].wait_minutes} min wait</Text></View> : null}
          </View>)}
          <Row style={styles.totalRow}>
            <View>
              <Row style={{ gap: 6 }}>
                {item.operator_discount_amount > 0 ? <Text style={{ color: colors.faint, textDecorationLine: 'line-through' }}>{money(item.total_fare)}</Text> : null}
                <Text style={{ fontWeight: '900', fontSize: 19, color: colors.primary }}>{money(item.final_fare)}</Text>
              </Row>
              <Text style={{ fontSize: 11, color: colors.subtext }}>per passenger · {item.leg_count} buses</Text>
            </View>
            <Button title="Select" icon="arrow-forward" onPress={() => navigation.navigate('TransitSeats', { itinerary: item, origin, destination, date })} style={{ paddingHorizontal: 20 }} />
          </Row>
        </Card>)}
      </> : null}

      {!loading && !error && showDirect && filteredTrips.length > 0 ? <>
        <Text style={styles.section}>Direct buses</Text>
        {filteredTrips.map((trip, index) => <TripCard
          key={`${trip.trip_id || trip.id}-${index}`}
          trip={{ ...trip, origin_city: trip.origin_city || origin, destination_city: trip.destination_city || destination }}
          selectLabel={isReturnLeg ? 'Select return seats' : 'Select seats'}
          onSelect={() => navigation.navigate('Seats', { trip, origin, destination, date, returnDate: isReturnLeg ? undefined : returnDate, isReturnLeg, outbound })}
        />)}
      </> : null}
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  headerBar: { backgroundColor: colors.dark, paddingHorizontal: 20, paddingVertical: 16 },
  routeTitle: { fontSize: 19, fontWeight: '900', color: '#fff', maxWidth: '42%' },
  stepBubble: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  section: { fontWeight: '900', fontSize: 16, color: colors.text, marginBottom: 10, marginTop: 8 },
  legBubble: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  legBubbleText: { color: colors.primary, fontWeight: '900', fontSize: 12 },
  transfer: { flexDirection: 'row', gap: 5, alignItems: 'center', backgroundColor: colors.warnSoft, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginVertical: 9, marginLeft: 36 },
  totalRow: { justifyContent: 'space-between', marginTop: 12, borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: 12 },
});
