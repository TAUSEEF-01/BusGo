import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api/client';
import { Badge, Card, Empty, ErrorState, Loading, Row } from '../components/ui';
import { Booking, Ticket } from '../types/api';
import { colors } from '../theme';
import { money, reference, shortDate } from '../utils/format';
import type { RootStackParamList } from '../nav';
import { useAuth } from '../store/auth';
import { GuestAccess } from '../components/GuestAccess';

type Segment = 'bookings' | 'tickets';
type Nav = NativeStackNavigationProp<RootStackParamList>;

function tone(status: string): 'success' | 'info' | 'warn' | 'neutral' | 'danger' {
  const value = status.toUpperCase();
  if (value === 'CONFIRMED' || value === 'ACTIVE') return 'success';
  if (value === 'SEAT_LOCKED' || value === 'PAYMENT_PENDING') return 'warn';
  if (value === 'CANCELLED' || value === 'EXPIRED' || value === 'REFUNDED') return 'neutral';
  if (value === 'FAILED') return 'danger';
  return 'info';
}

export default function TripsScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const [segment, setSegment] = useState<Segment>('bookings');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    if (!user) { setBookings([]); setTickets([]); setLoading(false); setRefreshing(false); return; }
    try {
      const [bookingResponse, ticketResponse] = await Promise.all([api.get('/api/bookings/my?limit=100'), api.get('/api/tickets/my')]);
      setBookings(bookingResponse.data || []); setTickets(ticketResponse.data || []);
    } catch (reason: any) { setError(reason.message || 'Could not load your trips.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const bookingGroups = useMemo(() => {
    const groups = new Map<string, Booking[]>();
    bookings.forEach((booking) => { const key = booking.journey_id || booking.id; groups.set(key, [...(groups.get(key) || []), booking]); });
    return [...groups.entries()].map(([key, legs]) => ({ key, journeyId: legs[0].journey_id, legs: legs.sort((a, b) => Number(a.leg_number || 0) - Number(b.leg_number || 0)), first: legs[0] }));
  }, [bookings]);

  if (!user) return <GuestAccess title="Your trips need an account" message="Anyone can browse routes and seats. Log in to view your bookings and e-tickets." />;

  return <View style={{ flex: 1, backgroundColor: colors.bg }}>
    <View style={styles.segment}>{(['bookings', 'tickets'] as Segment[]).map((item) => <Pressable key={item} onPress={() => setSegment(item)} style={[styles.segmentButton, segment === item && styles.segmentActive]}><Text style={{ fontWeight: '800', fontSize: 13, color: segment === item ? '#fff' : colors.subtext }}>{item === 'bookings' ? `Bookings (${bookingGroups.length})` : `Tickets (${tickets.length})`}</Text></Pressable>)}</View>
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      {loading ? <Loading label="Loading your trips…" /> : error ? <ErrorState message={error} onRetry={() => { setLoading(true); load(); }} /> : null}
      {!loading && !error && segment === 'bookings' && !bookingGroups.length ? <Empty title="No bookings yet" subtitle="Search a route on Home and book your first journey." /> : null}
      {!loading && !error && segment === 'bookings' ? bookingGroups.map((group) => {
        const first = group.first; const last = group.legs[group.legs.length - 1]; const total = group.legs.reduce((sum, leg) => sum + Number(leg.total_fare), 0);
        return <Pressable key={group.key} onPress={() => navigation.navigate('BookingDetail', { bookingId: first.id, journeyId: group.journeyId })}><Card style={{ marginBottom: 12 }}><Row style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 7 }}><View style={{ flex: 1, marginRight: 8 }}><Text style={{ fontWeight: '900', color: colors.text }}>{first.origin_city || first.boarding_point} → {last.destination_city || last.dropping_point}</Text><Text style={{ fontSize: 12, color: colors.subtext, marginTop: 2 }}>{shortDate(first.journey_date)} · {group.legs.length > 1 ? `${group.legs.length} buses` : first.operator_name || 'Bus operator'}</Text></View><Badge tone={tone(first.status)} text={first.status.replaceAll('_', ' ')} /></Row><Row style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>{group.legs.map((leg, index) => <Badge key={leg.id} tone="neutral" text={`${group.legs.length > 1 ? `Bus ${index + 1}: ` : ''}${leg.seat_numbers.join(', ')}`} />)}</Row><Row style={{ justifyContent: 'space-between' }}><Text style={{ fontSize: 11, color: colors.faint }}>Ref {reference(group.key)}</Text><Row style={{ gap: 8 }}><Text style={{ fontWeight: '900', color: colors.primary }}>{money(total)}</Text><Ionicons name="chevron-forward" size={18} color={colors.faint} /></Row></Row></Card></Pressable>;
      }) : null}
      {!loading && !error && segment === 'tickets' && !tickets.length ? <Empty title="No tickets yet" subtitle="Tickets appear after a successful payment." /> : null}
      {!loading && !error && segment === 'tickets' ? tickets.map((ticket) => <Pressable key={ticket.id} onPress={() => navigation.navigate('TicketDetail', { ticketId: ticket.id })}><Card style={{ marginBottom: 12 }}><Row style={{ justifyContent: 'space-between', marginBottom: 7 }}><Row style={{ gap: 8 }}><Ionicons name="qr-code-outline" size={21} color={colors.primary} /><Text style={{ fontWeight: '900', color: colors.text }}>Ticket {reference(ticket.id)}</Text></Row><Badge tone={tone(ticket.status)} text={ticket.status} /></Row><Text style={{ fontSize: 12, color: colors.subtext }}>Seats {ticket.seat_numbers.join(', ')} · issued {shortDate(ticket.issued_at)}</Text><Row style={{ justifyContent: 'flex-end', marginTop: 8 }}><Ionicons name="chevron-forward" size={18} color={colors.faint} /></Row></Card></Pressable>) : null}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({ segment: { flexDirection: 'row', margin: 16, marginBottom: 0, backgroundColor: '#e2e8f0', borderRadius: 12, padding: 4, gap: 4 }, segmentButton: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' }, segmentActive: { backgroundColor: colors.primary } });
