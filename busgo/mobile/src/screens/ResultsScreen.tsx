import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { Badge, Button, Card, Empty, ErrorState, Loading, OperatorLogo, Row, TripTimeline } from '../components/ui';
import { colors, radius } from '../theme';
import { busDisplayName, durationBetween, money, shortDate, shortTime } from '../utils/format';
import { DirectTrip, Itinerary, ScreenProps } from '../nav';

const AMENITY_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  ac: { icon: 'snow-outline', label: 'AC' },
  wifi: { icon: 'wifi-outline', label: 'WiFi' },
  usb: { icon: 'flash-outline', label: 'USB' },
};

function operatorRating(name?: string): string {
  const normalized = (name || '').toLowerCase();
  if (normalized.includes('greenline')) return '4.5';
  if (normalized.includes('shohagh')) return '4.2';
  if (normalized.includes('hanif')) return '4.0';
  return '4.3';
}

export default function ResultsScreen({ route, navigation }: ScreenProps<'Results'>) {
  const { origin, destination, date } = route.params;
  const [trips, setTrips] = useState<DirectTrip[]>([]);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [direct, transit] = await Promise.all([
        api.get(`/api/operators/trips/?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&date=${date}T00:00:00`),
        api.get(`/api/transit/search?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&journey_date=${date}`),
      ]);
      const directTrips = ((direct.data || []) as DirectTrip[])
        .filter((trip) => String((trip as any).status || 'SCHEDULED').toUpperCase() === 'SCHEDULED')
        .sort((a, b) => new Date(a.departure_datetime).getTime() - new Date(b.departure_datetime).getTime());
      const transitTrips = ((transit.data?.itineraries || []) as Itinerary[]).filter((item) => item.leg_count > 1);
      setTrips(directTrips);
      setItineraries(transitTrips);
    } catch (reason: any) {
      setError(reason.message || 'Could not search buses.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [origin, destination, date]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 30 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
    {/* Route summary header */}
    <View style={styles.headerBar}>
      <Row style={{ gap: 8 }}>
        <Text style={styles.routeTitle} numberOfLines={1}>{origin}</Text>
        <Ionicons name="arrow-forward" size={17} color="#fca5a5" />
        <Text style={styles.routeTitle} numberOfLines={1}>{destination}</Text>
      </Row>
      <Row style={{ gap: 6, marginTop: 5 }}>
        <Ionicons name="calendar-outline" size={13} color="#94a3b8" />
        <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '600' }}>{shortDate(date)} · {trips.length + itineraries.length} options</Text>
      </Row>
    </View>

    <View style={{ padding: 16 }}>
      {loading ? <Loading label="Searching buses and connections…" /> : error ? <ErrorState title="Search unavailable" message={error} onRetry={() => { setLoading(true); load(); }} /> : null}
      {!loading && !error && !trips.length && !itineraries.length ? <Empty title="No buses found" subtitle="Try another date or route. Operators may not have published future schedules yet." icon="search-outline" /> : null}

      {!loading && !error && itineraries.length > 0 ? <>
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
                <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 1 }}>{leg.operator_name || `Bus ${index + 1}`}{leg.bus_registration_no ? ` · ${leg.bus_registration_no}` : ''}</Text>
                <Text style={{ fontSize: 12, color: colors.faint, marginTop: 1 }}>{shortTime(leg.departure_datetime)} – {shortTime(leg.arrival_datetime)}</Text>
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

      {!loading && !error && trips.length > 0 ? <>
        <Text style={styles.section}>Direct buses</Text>
        {trips.map((trip, index) => {
          const id = (trip.trip_id || trip.id) as string;
          const seatsLeft = trip.available_seats;
          const amenities = (trip.amenities || []).map((a) => AMENITY_META[a.toLowerCase()]).filter(Boolean);
          return <Card key={`${id}-${index}`} style={{ marginBottom: 12 }}>
            {/* Operator header */}
            <Row style={{ gap: 11, marginBottom: 13 }}>
              <OperatorLogo name={trip.operator_name || 'Bus operator'} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', fontSize: 15, color: colors.text }} numberOfLines={1}>{trip.operator_name || 'Bus operator'}</Text>
                <Row style={{ gap: 4, marginTop: 2 }}>
                  <Ionicons name="bus-outline" size={12} color={colors.primary} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }} numberOfLines={1}>{busDisplayName(trip)}</Text>
                </Row>
                <Row style={{ gap: 8, marginTop: 3 }}>
                  {trip.bus_type ? <Badge tone="neutral" text={trip.bus_type} /> : null}
                  <Row style={{ gap: 3 }}><Ionicons name="star" size={12} color={colors.accent} /><Text style={{ fontSize: 12, fontWeight: '700', color: colors.subtext }}>{operatorRating(trip.operator_name)}</Text></Row>
                </Row>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontWeight: '900', fontSize: 19, color: colors.primary }}>{money(trip.fare_amount)}</Text>
                <Text style={{ fontSize: 10, color: colors.faint }}>per seat</Text>
              </View>
            </Row>

            <TripTimeline
              depTime={shortTime(trip.departure_datetime)} depCity={trip.origin_city || origin}
              arrTime={shortTime(trip.arrival_datetime)} arrCity={trip.destination_city || destination}
              centerLabel={durationBetween(trip.departure_datetime, trip.arrival_datetime) || 'Direct'}
            />

            <Row style={{ justifyContent: 'space-between', marginTop: 13, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.borderSoft }}>
              <Row style={{ gap: 10 }}>
                {amenities.length ? amenities.map((amenity) => <Row key={amenity.label} style={{ gap: 3 }}><Ionicons name={amenity.icon} size={13} color={colors.subtext} /><Text style={{ fontSize: 11, color: colors.subtext }}>{amenity.label}</Text></Row>)
                  : <Text style={{ fontSize: 11, color: colors.faint }}>Standard amenities</Text>}
              </Row>
              {typeof seatsLeft === 'number' ? <Row style={{ gap: 4 }}>
                <Ionicons name="people-outline" size={13} color={seatsLeft <= 5 ? colors.danger : seatsLeft <= 12 ? colors.warn : colors.success} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: seatsLeft <= 5 ? colors.danger : seatsLeft <= 12 ? colors.warn : colors.success }}>{seatsLeft} seats left</Text>
              </Row> : null}
            </Row>

            <Button title="Select seats" icon="grid-outline" onPress={() => navigation.navigate('Seats', { trip, origin, destination, date })} style={{ marginTop: 13 }} />
          </Card>;
        })}
      </> : null}
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  headerBar: { backgroundColor: colors.dark, paddingHorizontal: 20, paddingVertical: 16 },
  routeTitle: { fontSize: 19, fontWeight: '900', color: '#fff', maxWidth: '42%' },
  section: { fontWeight: '900', fontSize: 16, color: colors.text, marginBottom: 10, marginTop: 8 },
  legBubble: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  legBubbleText: { color: colors.primary, fontWeight: '900', fontSize: 12 },
  transfer: { flexDirection: 'row', gap: 5, alignItems: 'center', backgroundColor: colors.warnSoft, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginVertical: 9, marginLeft: 36 },
  totalRow: { justifyContent: 'space-between', marginTop: 12, borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: 12 },
});
