import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { Badge, Button, Card, Empty, ErrorState, Loading, Row } from '../components/ui';
import { colors } from '../theme';
import { money, shortDate, shortTime } from '../utils/format';
import { DirectTrip, Itinerary, ScreenProps } from '../nav';

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

  return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 30 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
    <Text style={styles.routeTitle}>{origin} → {destination}</Text>
    <Text style={{ color: colors.subtext, marginBottom: 14 }}>{shortDate(date)} · {trips.length + itineraries.length} options</Text>
    {loading ? <Loading label="Searching buses and connections…" /> : error ? <ErrorState title="Search unavailable" message={error} onRetry={() => { setLoading(true); load(); }} /> : null}
    {!loading && !error && !trips.length && !itineraries.length ? <Empty title="No buses found" subtitle="Try another date or route. Operators may not have published future schedules yet." /> : null}

    {!loading && !error && itineraries.length > 0 ? <>
      <Text style={styles.section}>Connecting journeys</Text>
      {itineraries.map((item) => <Card key={item.itinerary_id} style={{ marginBottom: 12 }}>
        <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}><Badge tone={item.source === 'operator' ? 'primary' : 'info'} text={item.source === 'operator' ? 'Operator-guaranteed' : 'BusGo connection'} /><Text style={{ fontSize: 11, color: colors.subtext }}>{Math.floor(item.total_duration_minutes / 60)}h {item.total_duration_minutes % 60}m</Text></Row>
        {item.legs.map((leg, index) => <View key={leg.trip_id}>
          <Row style={{ alignItems: 'flex-start', gap: 9 }}><Ionicons name="bus-outline" size={19} color={colors.primary} /><View style={{ flex: 1 }}><Text style={{ fontWeight: '800', color: colors.text }}>{leg.origin_city} → {leg.destination_city}</Text><Text style={{ fontSize: 12, color: colors.subtext }}>{leg.operator_name || leg.bus_registration_no || `Bus ${index + 1}`} · {shortTime(leg.departure_datetime)}–{shortTime(leg.arrival_datetime)}</Text></View><Text style={{ fontWeight: '700', color: colors.text }}>{money(leg.fare_amount)}</Text></Row>
          {index < item.legs.length - 1 && item.transfers[index] ? <View style={styles.transfer}><Ionicons name="time-outline" size={14} color={colors.warn} /><Text style={{ fontSize: 11, color: colors.warn, fontWeight: '700' }}>Change at {item.transfers[index].city} · {item.transfers[index].wait_minutes} min</Text></View> : null}
        </View>)}
        <Row style={styles.totalRow}><View><Row style={{ gap: 6 }}>{item.operator_discount_amount > 0 ? <Text style={{ color: colors.faint, textDecorationLine: 'line-through' }}>{money(item.total_fare)}</Text> : null}<Text style={{ fontWeight: '900', fontSize: 18, color: colors.primary }}>{money(item.final_fare)}</Text></Row><Text style={{ fontSize: 11, color: colors.subtext }}>per passenger · {item.leg_count} buses</Text></View><Button title="Select" onPress={() => navigation.navigate('TransitSeats', { itinerary: item, origin, destination, date })} style={{ paddingHorizontal: 20 }} /></Row>
      </Card>)}
    </> : null}

    {!loading && !error && trips.length > 0 ? <>
      <Text style={styles.section}>Direct buses</Text>
      {trips.map((trip, index) => { const id = (trip.trip_id || trip.id) as string; return <Card key={`${id}-${index}`} style={{ marginBottom: 12 }}><Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}><View style={{ flex: 1, marginRight: 10 }}><Text style={{ fontWeight: '800', fontSize: 15, color: colors.text }}>{trip.operator_name || 'Bus operator'}</Text><Text style={{ fontSize: 13, color: colors.subtext, marginTop: 3 }}>{shortTime(trip.departure_datetime)} → {shortTime(trip.arrival_datetime)}{trip.bus_type ? ` · ${trip.bus_type}` : ''}</Text>{typeof trip.available_seats === 'number' ? <Text style={{ fontSize: 11, color: trip.available_seats < 6 ? colors.warn : colors.success, marginTop: 3 }}>{trip.available_seats} seats available</Text> : null}</View><View style={{ alignItems: 'flex-end' }}><Text style={{ fontWeight: '900', fontSize: 18, color: colors.primary }}>{money(trip.fare_amount)}</Text><Text style={{ fontSize: 10, color: colors.faint }}>per seat</Text></View></Row><Button title="Choose seats" variant="outline" onPress={() => navigation.navigate('Seats', { trip, origin, destination, date })} style={{ marginTop: 12 }} /></Card>; })}
    </> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({ routeTitle: { fontSize: 22, fontWeight: '900', color: colors.text }, section: { fontWeight: '900', fontSize: 16, color: colors.text, marginBottom: 10, marginTop: 8 }, transfer: { flexDirection: 'row', gap: 5, alignItems: 'center', backgroundColor: colors.warnSoft, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginVertical: 9, marginLeft: 28 }, totalRow: { justifyContent: 'space-between', marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 } });
