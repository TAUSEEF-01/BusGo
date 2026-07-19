import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api/client';
import { useAuth } from '../store/auth';
import { Badge, Card, Loading, Row } from '../components/ui';
import { colors } from '../theme';
import { money, shortTime } from '../utils/format';
import type { OperatorStackParamList } from '../../App';
import type { OperatorBooking, Trip } from '../types';

type Nav = NativeStackNavigationProp<OperatorStackParamList>;

export default function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [counts, setCounts] = useState({ buses: 0, routes: 0, trips: 0, upcoming: 0 });
  const [bookings, setBookings] = useState<OperatorBooking[]>([]);
  const [todayTrips, setTodayTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [profileR, busesR, routesR, tripsR, bookingsR] = await Promise.allSettled([
      api.get(`/api/operators/operators/${user.id}`),
      api.get(`/api/operators/operators/${user.id}/buses`),
      api.get(`/api/operators/operators/${user.id}/routes`),
      api.get(`/api/operators/trips/?operator_id=${user.id}`),
      api.get(`/api/bookings/operator/${user.id}?limit=500`),
    ]);
    if (profileR.status === 'fulfilled') setProfile(profileR.value.data);
    const trips: Trip[] = tripsR.status === 'fulfilled' ? (tripsR.value.data || []) : [];
    const now = Date.now();
    const todayKey = new Date().toDateString();
    setTodayTrips(trips.filter((trip) => trip.status === 'SCHEDULED' && new Date(trip.departure_datetime).toDateString() === todayKey)
      .sort((a, b) => new Date(a.departure_datetime).getTime() - new Date(b.departure_datetime).getTime()));
    setCounts({
      buses: busesR.status === 'fulfilled' ? (busesR.value.data || []).length : 0,
      routes: routesR.status === 'fulfilled' ? (routesR.value.data || []).length : 0,
      trips: trips.length,
      upcoming: trips.filter((trip) => trip.status === 'SCHEDULED' && new Date(trip.departure_datetime).getTime() > now).length,
    });
    setBookings(bookingsR.status === 'fulfilled' ? (bookingsR.value.data || []) : []);
    setLoading(false); setRefreshing(false);
  }, [user]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const confirmed = bookings.filter((booking) => ['CONFIRMED', 'COMPLETED'].includes(booking.status.toUpperCase()));
  const revenue = confirmed.reduce((sum, booking) => sum + Number(booking.total_fare), 0);
  const seatsSold = confirmed.reduce((sum, booking) => sum + booking.seat_numbers.length, 0);

  return <View style={{ flex: 1, backgroundColor: colors.bg }}>
    {isFocused ? <StatusBar style="light" /> : null}
    <ScrollView contentContainerStyle={{ paddingBottom: 30 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.heroCircle} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Row style={{ gap: 9 }}>
            <View style={styles.logoBox}><Ionicons name="bus" size={20} color="#fff" /></View>
            <View>
              <Text style={styles.logoText}>BusGo <Text style={{ color: colors.primary }}>Operator</Text></Text>
              <Text style={{ color: '#94a3b8', fontSize: 12 }}>{profile?.name || user?.full_name || 'Operator'}</Text>
            </View>
          </Row>
          {profile?.is_verified ? <Badge tone="success" text="Verified" /> : null}
        </Row>
        <Text style={styles.heroTitle}>Today's operation</Text>
        <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>{todayTrips.length ? `${todayTrips.length} departure${todayTrips.length > 1 ? 's' : ''} scheduled today` : 'No departures scheduled today'}</Text>
      </View>

      {/* Stat tiles */}
      <View style={{ marginTop: -34, paddingHorizontal: 16 }}>
        <Row style={{ gap: 10 }}>
          <StatTile icon="cash-outline" label="Revenue" value={money(revenue)} highlight />
          <StatTile icon="people-outline" label="Seats sold" value={String(seatsSold)} />
        </Row>
        <Row style={{ gap: 10, marginTop: 10 }}>
          <StatTile icon="bus-outline" label="Buses" value={String(counts.buses)} onPress={() => navigation.navigate('Buses')} />
          <StatTile icon="map-outline" label="Routes" value={String(counts.routes)} onPress={() => navigation.navigate('Routes')} />
          <StatTile icon="calendar-outline" label="Upcoming" value={String(counts.upcoming)} />
        </Row>
      </View>

      {/* Today's departures */}
      <View style={{ paddingHorizontal: 16, marginTop: 18 }}>
        <Text style={styles.sectionTitle}>Today's departures</Text>
        {loading ? <Loading /> : !todayTrips.length ? <Card><Text style={{ color: colors.faint, fontSize: 13 }}>Nothing departs today. Schedule trips from the Trips tab.</Text></Card>
          : todayTrips.slice(0, 5).map((trip) => <Card key={trip.id} style={{ marginBottom: 10 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', color: colors.text }}>{trip.origin_city} → {trip.destination_city}</Text>
                <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 2 }}>{trip.bus_registration_no || 'Bus'} · {money(trip.fare_amount)}/seat</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontWeight: '900', fontSize: 16, color: colors.primary }}>{shortTime(trip.departure_datetime)}</Text>
                <Text style={{ fontSize: 11, color: colors.success, fontWeight: '700' }}>{trip.available_seats ?? '—'} seats left</Text>
              </View>
            </Row>
          </Card>)}
      </View>

      {/* Quick actions */}
      <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
        <Text style={styles.sectionTitle}>Quick actions</Text>
        <Row style={{ gap: 10, flexWrap: 'wrap' }}>
          <ActionTile icon="pricetags-outline" label="Deals" onPress={() => navigation.navigate('Deals')} />
          <ActionTile icon="git-branch-outline" label="Transit routes" onPress={() => navigation.navigate('TransitRoutes')} />
          <ActionTile icon="rocket-outline" label="Fill seats" onPress={() => navigation.navigate('FillSeats')} />
          <ActionTile icon="megaphone-outline" label="Notify" onPress={() => navigation.navigate('Notify')} />
        </Row>
      </View>
    </ScrollView>
  </View>;
}

function StatTile({ icon, label, value, highlight, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; highlight?: boolean; onPress?: () => void }) {
  const body = <View style={[styles.stat, highlight && { backgroundColor: colors.primary, borderColor: colors.primaryDark }]}>
    <Ionicons name={icon} size={17} color={highlight ? '#fecaca' : colors.primary} />
    <Text style={{ fontWeight: '900', fontSize: 17, color: highlight ? '#fff' : colors.text, marginTop: 5 }} numberOfLines={1}>{value}</Text>
    <Text style={{ fontSize: 11, color: highlight ? '#fecaca' : colors.subtext, marginTop: 1 }}>{label}</Text>
  </View>;
  return onPress ? <Pressable style={{ flex: 1 }} onPress={onPress}>{body}</Pressable> : <View style={{ flex: 1 }}>{body}</View>;
}

function ActionTile({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.action}>
    <View style={styles.actionIcon}><Ionicons name={icon} size={19} color={colors.primary} /></View>
    <Text style={{ fontWeight: '800', fontSize: 12, color: colors.text }}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.dark, padding: 20, paddingTop: 58, paddingBottom: 60, overflow: 'hidden' },
  heroCircle: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(220,38,38,0.15)', top: -80, right: -70 },
  logoBox: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontWeight: '900', fontSize: 17 },
  heroTitle: { color: '#fff', fontWeight: '900', fontSize: 24, marginTop: 18 },
  sectionTitle: { fontWeight: '900', fontSize: 15, color: colors.text, marginBottom: 9 },
  stat: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 12 },
  action: { width: '47%', flexGrow: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  actionIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
