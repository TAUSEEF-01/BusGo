import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api/client';
import { Badge, Card, Empty, ErrorState, Loading, OperatorLogo, Row, TripTimeline } from '../components/ui';
import { Booking, Journey, Ticket } from '../types/api';
import { colors } from '../theme';
import { busDisplayName, durationBetween, money, reference, shortDate, shortTime } from '../utils/format';
import type { RootStackParamList } from '../nav';
import { useAuth } from '../store/auth';
import { GuestAccess } from '../components/GuestAccess';

type Segment = 'bookings' | 'tickets';
type Bucket = 'upcoming' | 'completed' | 'cancelled';
type Nav = NativeStackNavigationProp<RootStackParamList>;

const BUCKETS: { id: Bucket; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'upcoming', label: 'Upcoming', icon: 'time-outline' },
  { id: 'completed', label: 'Completed', icon: 'checkmark-done-outline' },
  { id: 'cancelled', label: 'Cancelled', icon: 'close-circle-outline' },
];

const AMENITY_LABEL: Record<string, string> = { ac: 'AC', wifi: 'WiFi', usb: 'USB' };

interface TripItem {
  key: string;
  journeyId?: string | null;
  bookingId: string;
  isTransit: boolean;
  bucket: Bucket;
  backendStatus: string;
  operatorLabel: string;
  origin: string;
  destination: string;
  departureAt: number;
  booking?: Booking;
  journey?: Journey;
  total: number;
}

function tone(status: string): 'success' | 'info' | 'warn' | 'neutral' | 'danger' {
  const value = status.toUpperCase();
  if (value === 'CONFIRMED' || value === 'ACTIVE' || value === 'COMPLETED') return 'success';
  if (value === 'SEAT_LOCKED' || value === 'PAYMENT_PENDING' || value === 'INITIATED') return 'warn';
  if (value === 'CANCELLED' || value === 'EXPIRED' || value === 'REFUNDED') return 'neutral';
  if (value === 'FAILED') return 'danger';
  return 'info';
}

function bucketOf(status: string, departureAt: number): Bucket {
  const value = status.toUpperCase();
  if (value === 'CANCELLED' || value === 'REFUNDED' || value === 'EXPIRED' || value === 'FAILED') return 'cancelled';
  if (value === 'COMPLETED') return 'completed';
  if (value === 'CONFIRMED' && departureAt && departureAt < Date.now()) return 'completed';
  return 'upcoming';
}

function departureMillis(dateStr?: string | null, fallbackDate?: string | null, fallbackTime?: string | null): number {
  if (dateStr) { const t = new Date(dateStr).getTime(); if (!Number.isNaN(t)) return t; }
  if (fallbackDate) {
    const t = new Date(`${fallbackDate}T${(fallbackTime || '00:00:00').slice(0, 8)}`).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

const paymentLabel = (status: string) => {
  const value = status.toUpperCase();
  if (value === 'CONFIRMED' || value === 'COMPLETED') return { text: 'Paid', color: colors.success };
  if (value === 'SEAT_LOCKED' || value === 'INITIATED') return { text: 'Payment pending', color: colors.warn };
  return null;
};

export default function TripsScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const [segment, setSegment] = useState<Segment>('bookings');
  const [bucket, setBucket] = useState<Bucket>('upcoming');
  const [query, setQuery] = useState('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    if (!user) { setBookings([]); setJourneys([]); setTickets([]); setLoading(false); setRefreshing(false); return; }
    try {
      const [bookingResponse, journeyResponse, ticketResponse] = await Promise.all([
        api.get('/api/bookings/my?limit=100'),
        api.get('/api/bookings/journeys/my').catch(() => ({ data: [] })),
        api.get('/api/tickets/my'),
      ]);
      setBookings(bookingResponse.data || []);
      setJourneys(journeyResponse.data || []);
      setTickets(ticketResponse.data || []);
    } catch (reason: any) { setError(reason.message || 'Could not load your trips.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const items = useMemo<TripItem[]>(() => {
    const output: TripItem[] = [];
    // Journeys are authoritative for their own legs.
    for (const journey of journeys) {
      const firstLeg = journey.legs[0];
      const departureAt = departureMillis(firstLeg?.departure_datetime, firstLeg?.journey_date, firstLeg?.departure_time);
      output.push({
        key: journey.journey_id,
        journeyId: journey.journey_id,
        bookingId: firstLeg?.booking_id || journey.journey_id,
        isTransit: true,
        bucket: bucketOf(journey.status, departureAt),
        backendStatus: journey.status,
        operatorLabel: [...new Set(journey.legs.map((leg) => leg.operator_name).filter(Boolean))].join(' '),
        origin: journey.origin,
        destination: journey.destination,
        departureAt,
        journey,
        total: journey.final_fare,
      });
    }
    for (const booking of bookings) {
      if (booking.journey_id) continue; // rendered through its journey
      const departureAt = departureMillis(booking.departure_datetime, booking.journey_date, booking.departure_time);
      output.push({
        key: booking.id,
        journeyId: null,
        bookingId: booking.id,
        isTransit: false,
        bucket: bucketOf(booking.status, departureAt),
        backendStatus: booking.status,
        operatorLabel: booking.operator_name || 'Bus operator',
        origin: booking.origin_city || booking.boarding_point,
        destination: booking.destination_city || booking.dropping_point,
        departureAt,
        booking,
        total: Number(booking.total_fare) - Number(booking.discount_amount || 0),
      });
    }
    return output;
  }, [bookings, journeys]);

  const counts = useMemo(() => ({
    upcoming: items.filter((item) => item.bucket === 'upcoming').length,
    completed: items.filter((item) => item.bucket === 'completed').length,
    cancelled: items.filter((item) => item.bucket === 'cancelled').length,
  }), [items]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items
      .filter((item) => item.bucket === bucket)
      .filter((item) => !term
        || item.operatorLabel.toLowerCase().includes(term)
        || reference(item.key).toLowerCase().includes(term)
        || item.origin.toLowerCase().includes(term)
        || item.destination.toLowerCase().includes(term))
      // Future trips chronologically; past trips latest-first.
      .sort((a, b) => bucket === 'upcoming' ? a.departureAt - b.departureAt : b.departureAt - a.departureAt);
  }, [items, bucket, query]);

  const ticketCountFor = (item: TripItem) => {
    const ids = item.isTransit ? (item.journey?.legs || []).map((leg) => leg.booking_id) : [item.bookingId];
    return tickets.filter((ticket) => ids.includes(ticket.booking_id)).length;
  };

  if (!user) return <GuestAccess title="Your trips need an account" message="Anyone can browse routes and seats. Log in to view your bookings and e-tickets." />;

  return <View style={{ flex: 1, backgroundColor: colors.bg }}>
    <View style={styles.segment}>{(['bookings', 'tickets'] as Segment[]).map((item) => <Pressable key={item} onPress={() => setSegment(item)} style={[styles.segmentButton, segment === item && styles.segmentActive]}>
      <Ionicons name={item === 'bookings' ? 'briefcase-outline' : 'qr-code-outline'} size={14} color={segment === item ? '#fff' : colors.subtext} />
      <Text style={{ fontWeight: '800', fontSize: 13, color: segment === item ? '#fff' : colors.subtext }}>{item === 'bookings' ? `Bookings (${items.length})` : `Tickets (${tickets.length})`}</Text>
    </Pressable>)}</View>

    {segment === 'bookings' ? <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, gap: 8 }}>
        {BUCKETS.map((item) => <Pressable key={item.id} onPress={() => setBucket(item.id)} style={[styles.bucketChip, bucket === item.id && styles.bucketChipActive]}>
          <Ionicons name={item.icon} size={13} color={bucket === item.id ? '#fff' : colors.subtext} />
          <Text style={{ fontSize: 12, fontWeight: '800', color: bucket === item.id ? '#fff' : colors.text }}>{item.label}</Text>
          <View style={[styles.countBubble, bucket === item.id && { backgroundColor: 'rgba(255,255,255,0.25)' }]}><Text style={{ fontSize: 10, fontWeight: '800', color: bucket === item.id ? '#fff' : colors.subtext }}>{counts[item.id]}</Text></View>
        </Pressable>)}
      </ScrollView>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={colors.faint} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search operator, city, or reference" placeholderTextColor={colors.faint} style={{ flex: 1, color: colors.text, paddingVertical: 8, fontSize: 13 }} />
        {query ? <Pressable onPress={() => setQuery('')}><Ionicons name="close-circle" size={16} color={colors.faint} /></Pressable> : null}
      </View>
    </> : null}

    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: segment === 'bookings' ? 4 : 16, paddingBottom: 30 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      {loading ? <Loading label="Loading your trips…" /> : error ? <ErrorState message={error} onRetry={() => { setLoading(true); load(); }} /> : null}

      {!loading && !error && segment === 'bookings' && !visible.length ? <Empty title={query ? 'No matching trips' : `No ${bucket} trips`} subtitle={query ? 'Try a different operator, city, or booking reference.' : bucket === 'upcoming' ? 'Search a route on Home and book your first journey.' : `Your ${bucket} bookings will appear here.`} icon="briefcase-outline" /> : null}

      {!loading && !error && segment === 'bookings' ? visible.map((item) => {
        const payment = paymentLabel(item.backendStatus);
        const ticketCount = ticketCountFor(item);
        return <Pressable key={item.key} onPress={() => navigation.navigate('BookingDetail', { bookingId: item.bookingId, journeyId: item.journeyId })}>
          <Card style={{ marginBottom: 12 }}>
            {/* Header */}
            <Row style={{ gap: 11, alignItems: 'flex-start', marginBottom: 11 }}>
              <OperatorLogo name={item.isTransit ? `${item.journey?.leg_count || 2} buses` : item.operatorLabel} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '900', color: colors.text, fontSize: 15 }} numberOfLines={1}>{item.origin} → {item.destination}</Text>
                {item.isTransit
                  ? <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 2 }} numberOfLines={1}>{item.journey?.leg_count} connecting buses · {(item.journey?.transfers || []).length} transfer{(item.journey?.transfers || []).length === 1 ? '' : 's'}</Text>
                  : <>
                      <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 2 }} numberOfLines={1}>{item.operatorLabel}</Text>
                      <Row style={{ gap: 4, marginTop: 2 }}>
                        <Ionicons name="bus-outline" size={11} color={colors.primary} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }} numberOfLines={1}>{busDisplayName(item.booking || {})}</Text>
                        {item.booking?.bus_type ? <Badge tone="neutral" text={item.booking.bus_type} /> : null}
                      </Row>
                    </>}
              </View>
              <Badge tone={tone(item.backendStatus)} text={item.backendStatus.replaceAll('_', ' ')} />
            </Row>

            {/* Body */}
            {item.isTransit ? <View style={{ gap: 7, marginBottom: 10 }}>
              {(item.journey?.legs || []).map((leg, index) => <View key={leg.booking_id} style={styles.legRow}>
                <Row style={{ gap: 7, flexWrap: 'wrap' }}>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: colors.primary }}>Bus {index + 1}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: colors.text }}>{leg.origin_city} → {leg.destination_city}</Text>
                  <Text style={{ fontSize: 11, color: colors.subtext }}>{leg.operator_name}{leg.bus_registration_no ? ` · ${leg.bus_registration_no}` : ''}{leg.bus_type ? ` · ${leg.bus_type}` : ''}</Text>
                </Row>
                <Row style={{ gap: 7, marginTop: 2, flexWrap: 'wrap' }}>
                  <Text style={{ fontSize: 11, color: colors.faint }}>{leg.departure_datetime ? `${shortTime(leg.departure_datetime)} – ${shortTime(leg.arrival_datetime)}` : (leg.departure_time || '').slice(0, 5)}</Text>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: colors.text }}>Seats {leg.seat_numbers.join(', ')}</Text>
                </Row>
                {index < (item.journey?.legs.length || 0) - 1 && item.journey?.transfers[index] ? <Text style={{ fontSize: 10, fontWeight: '700', color: colors.warn, marginTop: 3 }}>Change at {item.journey.transfers[index].city}{item.journey.transfers[index].wait_minutes != null ? ` · ${item.journey.transfers[index].wait_minutes} min wait` : ''}</Text> : null}
              </View>)}
              <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                <Badge tone="primary" text="One payment" />
                {ticketCount ? <Badge tone="success" text={`${ticketCount} ticket${ticketCount > 1 ? 's' : ''}`} /> : null}
              </Row>
            </View> : <View style={{ marginBottom: 10 }}>
              <TripTimeline
                depTime={item.booking?.departure_datetime ? shortTime(item.booking.departure_datetime) : (item.booking?.departure_time || '').slice(0, 5)}
                depCity={item.origin}
                depSub={item.booking?.boarding_point}
                arrTime={item.booking?.arrival_datetime ? shortTime(item.booking.arrival_datetime) : '--:--'}
                arrCity={item.destination}
                arrSub={item.booking?.dropping_point}
                centerLabel={durationBetween(item.booking?.departure_datetime, item.booking?.arrival_datetime) || shortDate(item.booking?.journey_date)}
              />
              <Row style={{ gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
                <Badge tone="neutral" text={`Seats ${item.booking?.seat_numbers.join(', ')}`} />
                <Badge tone="neutral" text={shortDate(item.booking?.journey_date)} />
                {(item.booking?.amenities || []).map((amenity) => AMENITY_LABEL[amenity.toLowerCase()] ? <Badge key={amenity} tone="info" text={AMENITY_LABEL[amenity.toLowerCase()]} /> : null)}
              </Row>
            </View>}

            {/* Footer */}
            <Row style={{ justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: 10 }}>
              <View>
                <Text style={{ fontSize: 11, color: colors.faint, fontWeight: '700' }}>Ref {reference(item.key)}</Text>
                {payment ? <Text style={{ fontSize: 10, fontWeight: '800', color: payment.color, marginTop: 1 }}>{payment.text.toUpperCase()}</Text> : null}
              </View>
              <Row style={{ gap: 6 }}>
                <Text style={{ fontWeight: '900', fontSize: 15, color: colors.primary }}>{money(item.total)}</Text>
                <Ionicons name="chevron-forward" size={17} color={colors.faint} />
              </Row>
            </Row>
          </Card>
        </Pressable>;
      }) : null}

      {!loading && !error && segment === 'tickets' && !tickets.length ? <Empty title="No tickets yet" subtitle="Tickets appear after a successful payment." icon="qr-code-outline" /> : null}
      {!loading && !error && segment === 'tickets' ? tickets.map((ticket) => <Pressable key={ticket.id} onPress={() => navigation.navigate('TicketDetail', { ticketId: ticket.id })}>
        <Card style={{ marginBottom: 12 }}>
          <Row style={{ gap: 11 }}>
            <View style={styles.qrBox}><Ionicons name="qr-code" size={22} color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '900', color: colors.text }}>Ticket {reference(ticket.id)}</Text>
                <Badge tone={tone(ticket.status)} text={ticket.status} />
              </Row>
              <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 3 }}>Seats {ticket.seat_numbers.join(', ')} · issued {shortDate(ticket.issued_at)}</Text>
            </View>
          </Row>
          <Row style={{ justifyContent: 'flex-end', marginTop: 6 }}>
            <Row style={{ gap: 3 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>View e-ticket</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </Row>
          </Row>
        </Card>
      </Pressable>) : null}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', margin: 16, marginBottom: 0, backgroundColor: '#e2e8f0', borderRadius: 12, padding: 4, gap: 4 },
  segmentButton: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  segmentActive: { backgroundColor: colors.primary },
  bucketChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.border },
  bucketChipActive: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
  countBubble: { minWidth: 17, height: 17, borderRadius: 9, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 7, marginHorizontal: 16, marginTop: 10, marginBottom: 8, paddingHorizontal: 11, backgroundColor: '#fff', borderWidth: 1.5, borderColor: colors.border, borderRadius: 12 },
  legRow: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  qrBox: { width: 44, height: 44, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
