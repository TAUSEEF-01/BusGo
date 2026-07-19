import React, { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { useAuth } from '../store/auth';
import { Badge, Card, Chip, Empty, ErrorState, Loading, Row } from '../components/ui';
import { colors } from '../theme';
import { dateTime, money, reference, shortDate } from '../utils/format';
import type { OperatorBooking } from '../types';

type StatusFilter = 'ALL' | 'CONFIRMED' | 'SEAT_LOCKED' | 'CANCELLED' | 'COMPLETED';

function tone(status: string): 'success' | 'warn' | 'neutral' | 'danger' | 'info' {
  const value = status.toUpperCase();
  if (value === 'CONFIRMED' || value === 'COMPLETED') return 'success';
  if (value === 'SEAT_LOCKED' || value === 'INITIATED') return 'warn';
  if (value === 'CANCELLED' || value === 'REFUNDED' || value === 'EXPIRED') return 'neutral';
  if (value === 'FAILED') return 'danger';
  return 'info';
}

export default function BookingsScreen() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<OperatorBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<OperatorBooking | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await api.get(`/api/bookings/operator/${user?.id}?limit=500`);
      setBookings(response.data || []);
    } catch (reason: any) { setError(reason.message || 'Could not load bookings.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return bookings
      .filter((booking) => statusFilter === 'ALL' || booking.status.toUpperCase() === statusFilter)
      .filter((booking) => !term
        || reference(booking.id).toLowerCase().includes(term)
        || (booking.passenger_details?.[0]?.name || '').toLowerCase().includes(term)
        || (booking.origin_city || booking.boarding_point).toLowerCase().includes(term)
        || (booking.destination_city || booking.dropping_point).toLowerCase().includes(term))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [bookings, statusFilter, query]);

  const stats = useMemo(() => {
    const confirmed = bookings.filter((booking) => ['CONFIRMED', 'COMPLETED'].includes(booking.status.toUpperCase()));
    return {
      total: bookings.length,
      revenue: confirmed.reduce((sum, booking) => sum + Number(booking.total_fare), 0),
      seats: confirmed.reduce((sum, booking) => sum + booking.seat_numbers.length, 0),
    };
  }, [bookings]);

  return <View style={{ flex: 1, backgroundColor: colors.bg }}>
    <Row style={{ gap: 8, paddingHorizontal: 16, paddingTop: 12 }}>
      <View style={styles.stat}><Text style={styles.statNum}>{stats.total}</Text><Text style={styles.statLabel}>Bookings</Text></View>
      <View style={styles.stat}><Text style={styles.statNum}>{stats.seats}</Text><Text style={styles.statLabel}>Seats sold</Text></View>
      <View style={styles.stat}><Text style={[styles.statNum, { color: colors.primary }]}>{money(stats.revenue)}</Text><Text style={styles.statLabel}>Revenue</Text></View>
    </Row>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 10 }}>
      {(['ALL', 'CONFIRMED', 'SEAT_LOCKED', 'COMPLETED', 'CANCELLED'] as StatusFilter[]).map((status) => <Chip key={status} label={status === 'ALL' ? 'All' : status.replaceAll('_', ' ')} active={statusFilter === status} onPress={() => setStatusFilter(status)} />)}
    </ScrollView>
    <View style={styles.searchBox}>
      <Ionicons name="search" size={16} color={colors.faint} />
      <TextInput value={query} onChangeText={setQuery} placeholder="Search reference, passenger, or city" placeholderTextColor={colors.faint} style={{ flex: 1, color: colors.text, paddingVertical: 8, fontSize: 13 }} />
      {query ? <Pressable onPress={() => setQuery('')}><Ionicons name="close-circle" size={16} color={colors.faint} /></Pressable> : null}
    </View>

    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 30 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      {loading ? <Loading label="Loading bookings…" /> : error ? <ErrorState message={error} onRetry={() => { setLoading(true); load(); }} /> : null}
      {!loading && !error && !visible.length ? <Empty title="No bookings" subtitle="Bookings on your trips appear here." icon="briefcase-outline" /> : null}
      {visible.map((booking) => <Pressable key={booking.id} onPress={() => setDetail(booking)}>
        <Card style={{ marginBottom: 10 }}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={{ fontWeight: '900', color: colors.text }} numberOfLines={1}>{booking.passenger_details?.[0]?.name || 'Passenger'}{booking.seat_numbers.length > 1 ? ` +${booking.seat_numbers.length - 1}` : ''}</Text>
              <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 2 }}>{booking.origin_city || booking.boarding_point} → {booking.destination_city || booking.dropping_point} · {shortDate(booking.journey_date)}</Text>
              <Row style={{ gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
                {booking.seat_numbers.map((seat) => <Badge key={seat} tone="primary" text={seat} />)}
              </Row>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Badge tone={tone(booking.status)} text={booking.status.replaceAll('_', ' ')} />
              <Text style={{ fontWeight: '900', color: colors.primary }}>{money(booking.total_fare)}</Text>
            </View>
          </Row>
        </Card>
      </Pressable>)}
    </ScrollView>

    {/* Detail sheet */}
    <Modal visible={!!detail} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setDetail(null)}>
      <View style={styles.overlay}>
        <Pressable style={{ flex: 1 }} onPress={() => setDetail(null)} />
        <View style={styles.sheet}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 19, fontWeight: '900', color: colors.text }}>Booking {detail ? reference(detail.id) : ''}</Text>
            <Pressable onPress={() => setDetail(null)} style={styles.close}><Ionicons name="close" size={20} color={colors.text} /></Pressable>
          </Row>
          {detail ? <ScrollView>
            <Row style={{ gap: 6, marginBottom: 10 }}>
              <Badge tone={tone(detail.status)} text={detail.status.replaceAll('_', ' ')} />
              <Badge tone="neutral" text={shortDate(detail.journey_date)} />
            </Row>
            <Text style={{ fontWeight: '800', color: colors.text }}>{detail.origin_city || detail.boarding_point} → {detail.destination_city || detail.dropping_point}</Text>
            <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 2 }}>Board: {detail.boarding_point} · Drop: {detail.dropping_point}</Text>
            <Text style={{ fontWeight: '900', color: colors.text, marginTop: 14, marginBottom: 6 }}>Passengers</Text>
            {(detail.passenger_details || []).map((person, index) => <Row key={index} style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <View><Text style={{ fontWeight: '700', color: colors.text }}>{person.name}</Text><Text style={{ fontSize: 11, color: colors.subtext }}>Age {person.age} · {person.gender}</Text></View>
              <Badge tone="primary" text={`Seat ${person.seat}`} />
            </Row>)}
            <Row style={{ justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: 10, marginTop: 8 }}>
              <Text style={{ fontWeight: '800', color: colors.text }}>Fare</Text>
              <Text style={{ fontWeight: '900', fontSize: 17, color: colors.primary }}>{money(detail.total_fare)}</Text>
            </Row>
            <Text style={{ fontSize: 11, color: colors.faint, marginTop: 8 }}>Created {dateTime(detail.created_at)} · Ref {detail.id}</Text>
          </ScrollView> : null}
        </View>
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  stat: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 14, alignItems: 'center', paddingVertical: 10 },
  statNum: { fontWeight: '900', fontSize: 15, color: colors.text },
  statLabel: { fontSize: 10, fontWeight: '700', color: colors.subtext, marginTop: 1 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 7, marginHorizontal: 16, marginTop: 10, marginBottom: 8, paddingHorizontal: 11, backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.border, borderRadius: 12 },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', maxHeight: '80%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  close: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
});
