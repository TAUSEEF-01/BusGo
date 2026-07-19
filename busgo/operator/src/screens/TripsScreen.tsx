import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { useAuth } from '../store/auth';
import { Badge, Button, Card, Chip, Empty, ErrorState, Input, Loading, Row } from '../components/ui';
import { colors } from '../theme';
import { money, shortDate, shortTime } from '../utils/format';
import type { Bus, OperatorBooking, RouteDef, Seat, Trip } from '../types';

type StatusFilter = 'ALL' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

export default function TripsScreen() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [routes, setRoutes] = useState<RouteDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('SCHEDULED');

  // Schedule form
  const [formOpen, setFormOpen] = useState(false);
  const [busId, setBusId] = useState('');
  const [routeId, setRouteId] = useState('');
  const [departure, setDeparture] = useState(new Date(Date.now() + 24 * 3600 * 1000));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [fare, setFare] = useState('1000');
  const [saving, setSaving] = useState(false);

  // Seat/passenger inspector
  const [inspecting, setInspecting] = useState<Trip | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [tripBookings, setTripBookings] = useState<OperatorBooking[]>([]);
  const [inspectLoading, setInspectLoading] = useState(false);

  const load = useCallback(async () => {
    setError('');
    const [tripsR, busesR, routesR] = await Promise.allSettled([
      api.get(`/api/operators/trips/?operator_id=${user?.id}`),
      api.get(`/api/operators/operators/${user?.id}/buses`),
      api.get(`/api/operators/operators/${user?.id}/routes`),
    ]);
    if (tripsR.status === 'fulfilled') setTrips(tripsR.value.data || []);
    else setError((tripsR.reason as any)?.message || 'Could not load trips.');
    if (busesR.status === 'fulfilled') setBuses(busesR.value.data || []);
    if (routesR.status === 'fulfilled') setRoutes(routesR.value.data || []);
    setLoading(false); setRefreshing(false);
  }, [user]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const visible = useMemo(() => trips
    .filter((trip) => statusFilter === 'ALL' || trip.status === statusFilter)
    .sort((a, b) => new Date(b.departure_datetime).getTime() - new Date(a.departure_datetime).getTime()), [trips, statusFilter]);

  const schedule = async () => {
    if (!busId) return Alert.alert('Trip', 'Pick a bus.');
    if (!routeId) return Alert.alert('Trip', 'Pick a route.');
    const fareAmount = Number(fare);
    if (!fareAmount || fareAmount < 50) return Alert.alert('Trip', 'Enter a valid fare (৳50+).');
    if (departure.getTime() < Date.now()) return Alert.alert('Trip', 'Departure must be in the future.');
    const bus = buses.find((item) => item.id === busId)!;
    const route = routes.find((item) => item.id === routeId)!;
    // Same double-booking guard as the web portal.
    const dateKey = departure.toISOString().split('T')[0];
    const conflict = trips.find((trip) => trip.bus_id === busId && trip.status !== 'CANCELLED' && trip.route_id !== routeId && trip.departure_datetime.split('T')[0] === dateKey);
    if (conflict) return Alert.alert('Bus already scheduled', `${bus.registration_no} already runs another route on ${dateKey}.`);
    const arrival = new Date(departure);
    const hours = Math.floor(route.estimated_duration_hours);
    arrival.setHours(arrival.getHours() + hours);
    arrival.setMinutes(arrival.getMinutes() + Math.round((route.estimated_duration_hours - hours) * 60));
    setSaving(true);
    try {
      await api.post('/api/operators/trips/', {
        operator_id: user?.id, bus_id: busId, route_id: routeId,
        departure_datetime: departure.toISOString(), arrival_datetime: arrival.toISOString(),
        fare_amount: fareAmount, available_seats: bus.total_seats, allow_transit: !!bus.allow_transit,
      });
      setFormOpen(false);
      setLoading(true); await load();
    } catch (reason: any) { Alert.alert('Could not schedule trip', reason.message); }
    finally { setSaving(false); }
  };

  const removeTrip = (trip: Trip) => Alert.alert('Delete trip?', `${trip.origin_city} → ${trip.destination_city} on ${shortDate(trip.departure_datetime)} will be removed.`, [
    { text: 'Keep', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      try { await api.del(`/api/operators/trips/${trip.id}`); setLoading(true); await load(); }
      catch (reason: any) { Alert.alert('Could not delete', reason.message); }
    } },
  ]);

  const inspect = async (trip: Trip) => {
    setInspecting(trip); setInspectLoading(true); setSeats([]); setTripBookings([]);
    const [seatsR, bookingsR] = await Promise.allSettled([
      api.get(`/api/inventory/trips/${trip.id}/seats`),
      api.get(`/api/bookings/trip/${trip.id}`),
    ]);
    if (seatsR.status === 'fulfilled' && Array.isArray(seatsR.value.data)) setSeats(seatsR.value.data);
    if (bookingsR.status === 'fulfilled') setTripBookings(bookingsR.value.data || []);
    setInspectLoading(false);
  };

  const booked = seats.filter((seat) => seat.status === 'BOOKED').length;
  const locked = seats.filter((seat) => seat.status === 'LOCKED').length;
  const free = seats.filter((seat) => seat.status === 'AVAILABLE').length;

  return <View style={{ flex: 1, backgroundColor: colors.bg }}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 12 }}>
      {(['SCHEDULED', 'COMPLETED', 'CANCELLED', 'ALL'] as StatusFilter[]).map((status) => <Chip key={status} label={status === 'ALL' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()} active={statusFilter === status} onPress={() => setStatusFilter(status)} />)}
    </ScrollView>

    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 90 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      {loading ? <Loading label="Loading trips…" /> : error ? <ErrorState message={error} onRetry={() => { setLoading(true); load(); }} /> : null}
      {!loading && !error && !visible.length ? <Empty title="No trips here" subtitle="Schedule a trip with the + button." icon="bus-outline" /> : null}
      {visible.map((trip) => <Card key={trip.id} style={{ marginBottom: 10 }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={{ fontWeight: '900', color: colors.text }}>{trip.origin_city} → {trip.destination_city}</Text>
            <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 2 }}>{shortDate(trip.departure_datetime)} · {shortTime(trip.departure_datetime)} – {shortTime(trip.arrival_datetime)}</Text>
            <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 1 }}>{trip.bus_registration_no || 'Bus'}{trip.bus_type ? ` · ${trip.bus_type}` : ''} · {money(trip.fare_amount)}/seat</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 5 }}>
            <Badge tone={trip.status === 'SCHEDULED' ? 'success' : trip.status === 'CANCELLED' ? 'danger' : 'neutral'} text={trip.status} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.success }}>{trip.available_seats ?? '—'} seats left</Text>
          </View>
        </Row>
        <Row style={{ gap: 8, marginTop: 10, borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: 10 }}>
          <Button title="Seats & passengers" variant="outline" icon="grid-outline" onPress={() => inspect(trip)} style={{ flex: 1, minHeight: 40, paddingVertical: 8 }} />
          {trip.status === 'SCHEDULED' ? <Pressable onPress={() => removeTrip(trip)} style={styles.deleteBtn}><Ionicons name="trash-outline" size={17} color={colors.danger} /></Pressable> : null}
        </Row>
      </Card>)}
    </ScrollView>

    <Pressable onPress={() => setFormOpen(true)} style={styles.fab}><Ionicons name="add" size={26} color="#fff" /></Pressable>

    {/* Schedule sheet */}
    <Modal visible={formOpen} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setFormOpen(false)}>
      <View style={styles.overlay}>
        <Pressable style={{ flex: 1 }} onPress={() => setFormOpen(false)} />
        <View style={styles.sheet}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 14 }}>
            <Text style={{ fontSize: 19, fontWeight: '900', color: colors.text }}>Schedule a trip</Text>
            <Pressable onPress={() => setFormOpen(false)} style={styles.close}><Ionicons name="close" size={20} color={colors.text} /></Pressable>
          </Row>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Bus</Text>
            <View style={{ gap: 6, marginBottom: 12 }}>
              {buses.filter((bus) => bus.is_active).map((bus) => <Pressable key={bus.id} onPress={() => setBusId(bus.id)} style={[styles.option, busId === bus.id && styles.optionActive]}>
                <Text style={{ fontWeight: '800', color: busId === bus.id ? colors.primary : colors.text }}>{bus.registration_no}</Text>
                <Text style={{ fontSize: 11, color: colors.subtext }}>{bus.bus_type} · {bus.total_seats} seats</Text>
              </Pressable>)}
              {!buses.filter((bus) => bus.is_active).length ? <Text style={{ color: colors.faint, fontSize: 12 }}>No active buses — add one under Manage → Buses.</Text> : null}
            </View>
            <Text style={styles.label}>Route</Text>
            <View style={{ gap: 6, marginBottom: 12 }}>
              {routes.map((route) => <Pressable key={route.id} onPress={() => setRouteId(route.id)} style={[styles.option, routeId === route.id && styles.optionActive]}>
                <Text style={{ fontWeight: '800', color: routeId === route.id ? colors.primary : colors.text }}>{route.origin_city} → {route.destination_city}</Text>
                <Text style={{ fontSize: 11, color: colors.subtext }}>{route.distance_km} km · ~{route.estimated_duration_hours}h</Text>
              </Pressable>)}
              {!routes.length ? <Text style={{ color: colors.faint, fontSize: 12 }}>No routes — add one under Manage → Routes.</Text> : null}
            </View>
            <Row style={{ gap: 10, marginBottom: 12 }}>
              <Pressable onPress={() => setShowDatePicker(true)} style={[styles.option, { flex: 1 }]}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.faint }}>DATE</Text>
                <Text style={{ fontWeight: '800', color: colors.text }}>{shortDate(departure.toISOString())}</Text>
              </Pressable>
              <Pressable onPress={() => setShowTimePicker(true)} style={[styles.option, { flex: 1 }]}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.faint }}>DEPARTURE TIME</Text>
                <Text style={{ fontWeight: '800', color: colors.text }}>{shortTime(departure.toISOString())}</Text>
              </Pressable>
            </Row>
            <Input label="Fare per seat (৳)" value={fare} onChangeText={(value) => setFare(value.replace(/\D/g, ''))} keyboardType="number-pad" />
            <Button title="Schedule trip" icon="checkmark" onPress={schedule} loading={saving} />
          </ScrollView>
        </View>
      </View>
    </Modal>

    {/* Seat inspector sheet */}
    <Modal visible={!!inspecting} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setInspecting(null)}>
      <View style={styles.overlay}>
        <Pressable style={{ flex: 1 }} onPress={() => setInspecting(null)} />
        <View style={styles.sheet}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <View>
              <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text }}>{inspecting?.origin_city} → {inspecting?.destination_city}</Text>
              <Text style={{ fontSize: 12, color: colors.subtext }}>{inspecting ? `${shortDate(inspecting.departure_datetime)} · ${shortTime(inspecting.departure_datetime)}` : ''}</Text>
            </View>
            <Pressable onPress={() => setInspecting(null)} style={styles.close}><Ionicons name="close" size={20} color={colors.text} /></Pressable>
          </Row>
          {inspectLoading ? <Loading label="Loading live seats…" /> : <ScrollView>
            <Row style={{ gap: 8, marginBottom: 12 }}>
              <View style={[styles.occTile, { backgroundColor: colors.successSoft }]}><Text style={styles.occNum}>{booked}</Text><Text style={styles.occLabel}>Booked</Text></View>
              <View style={[styles.occTile, { backgroundColor: colors.warnSoft }]}><Text style={styles.occNum}>{locked}</Text><Text style={styles.occLabel}>Locked</Text></View>
              <View style={[styles.occTile, { backgroundColor: '#f1f5f9' }]}><Text style={styles.occNum}>{free}</Text><Text style={styles.occLabel}>Available</Text></View>
            </Row>
            <View style={styles.seatWrap}>
              {seats.map((seat) => <View key={seat.seat_number} style={[styles.seat, seat.status === 'BOOKED' ? { backgroundColor: colors.success, borderColor: colors.success } : seat.status === 'LOCKED' ? { backgroundColor: colors.accent, borderColor: colors.accent } : null]}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: seat.status === 'AVAILABLE' ? colors.subtext : '#fff' }}>{seat.seat_number}</Text>
              </View>)}
            </View>
            <Text style={{ fontWeight: '900', color: colors.text, marginTop: 14, marginBottom: 8 }}>Passengers ({tripBookings.filter((booking) => booking.status === 'CONFIRMED').length} bookings)</Text>
            {tripBookings.filter((booking) => ['CONFIRMED', 'COMPLETED'].includes(booking.status)).map((booking) => <View key={booking.id} style={styles.passengerRow}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '800', color: colors.text, flex: 1 }} numberOfLines={1}>{booking.passenger_details?.[0]?.name || 'Passenger'}</Text>
                <Badge tone="success" text={booking.seat_numbers.join(', ')} />
              </Row>
              <Text style={{ fontSize: 11, color: colors.subtext, marginTop: 2 }}>{booking.boarding_point} → {booking.dropping_point} · {money(booking.total_fare)}</Text>
            </View>)}
            {!tripBookings.filter((booking) => ['CONFIRMED', 'COMPLETED'].includes(booking.status)).length ? <Text style={{ color: colors.faint, fontSize: 12, marginBottom: 12 }}>No confirmed bookings yet.</Text> : null}
          </ScrollView>}
        </View>
      </View>
    </Modal>

    {showDatePicker && <DateTimePicker value={departure} minimumDate={new Date()} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(_, selected) => { setShowDatePicker(false); if (selected) { const next = new Date(departure); next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate()); setDeparture(next); } }} />}
    {showTimePicker && <DateTimePicker value={departure} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(_, selected) => { setShowTimePicker(false); if (selected) { const next = new Date(departure); next.setHours(selected.getHours(), selected.getMinutes(), 0, 0); setDeparture(next); } }} />}
  </View>;
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', right: 18, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', maxHeight: '88%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  close: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6 },
  option: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#fff' },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  deleteBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  occTile: { flex: 1, borderRadius: 12, alignItems: 'center', paddingVertical: 10 },
  occNum: { fontWeight: '900', fontSize: 17, color: colors.text },
  occLabel: { fontSize: 10, fontWeight: '700', color: colors.subtext },
  seatWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, backgroundColor: '#f8fafc', borderRadius: 14, borderWidth: 1, borderColor: colors.borderSoft, padding: 10 },
  seat: { width: 34, height: 30, borderRadius: 7, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  passengerRow: { backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1, borderColor: colors.borderSoft, padding: 10, marginBottom: 7 },
});
