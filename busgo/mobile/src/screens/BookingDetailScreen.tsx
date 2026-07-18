import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { Badge, Button, Card, ErrorState, Loading, Row, SectionTitle } from '../components/ui';
import { Booking, Ticket } from '../types/api';
import { colors } from '../theme';
import { dateTime, money, reference, shortDate } from '../utils/format';
import { ScreenProps } from '../nav';

export default function BookingDetailScreen({ route, navigation }: ScreenProps<'BookingDetail'>) {
  const { bookingId, journeyId } = route.params;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [journey, setJourney] = useState<any>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [cancellation, setCancellation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [bookingResponse, ticketsResponse] = await Promise.all([api.get(`/api/bookings/${bookingId}`), api.get('/api/tickets/my')]);
      const nextBooking = bookingResponse.data as Booking;
      setBooking(nextBooking);
      setTicket(((ticketsResponse.data || []) as Ticket[]).find((item) => item.booking_id === bookingId) || null);
      if (journeyId) {
        const response = await api.get(`/api/bookings/journeys/${journeyId}`);
        setJourney(response.data);
      } else if (nextBooking.status === 'CONFIRMED') {
        const response = await api.get(`/api/bookings/${bookingId}/cancellation-info`);
        setCancellation(response.data);
      }
    } catch (reason: any) { setError(reason.message || 'Could not load this booking.'); }
    finally { setLoading(false); }
  }, [bookingId, journeyId]);

  useEffect(() => { load(); }, [load]);
  const status = String(journey?.status || booking?.status || '').toUpperCase();
  const cancellable = journeyId ? status === 'CONFIRMED' : !!cancellation?.cancellable;

  const cancel = () => Alert.alert('Cancel booking?', `This cancels ${journeyId ? 'every bus in the connecting journey' : 'this booking'}. The current policy refunds 80% to the original BusGo account.`, [
    { text: 'Keep booking', style: 'cancel' },
    { text: 'Cancel booking', style: 'destructive', onPress: async () => {
      setBusy(true);
      try {
        const response = journeyId ? await api.post(`/api/bookings/journeys/${journeyId}/cancel`) : await api.post(`/api/bookings/${bookingId}/cancel`);
        Alert.alert('Booking cancelled', response.message || `Refund: ${money(response.data?.refund_amount)}`);
        setLoading(true); await load();
      } catch (reason: any) { Alert.alert('Cancellation failed', reason.message); }
      finally { setBusy(false); }
    } },
  ]);

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}><Loading label="Loading booking…" /></View>;
  if (error || !booking) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}><ErrorState message={error || 'Booking not found.'} onRetry={() => { setLoading(true); load(); }} /></View>;

  const legs = journey?.legs || [booking];
  return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
    <Card style={{ marginBottom: 14 }}><Row style={{ justifyContent: 'space-between' }}><View><Text style={{ color: colors.subtext, fontSize: 11 }}>BOOKING REFERENCE</Text><Text style={{ fontWeight: '900', fontSize: 20, color: colors.text }}>{reference(journeyId || booking.id)}</Text></View><Badge tone={status === 'CONFIRMED' ? 'success' : status === 'CANCELLED' || status === 'REFUNDED' ? 'neutral' : 'warn'} text={status.replaceAll('_', ' ')} /></Row></Card>
    <Card style={{ marginBottom: 14 }}><SectionTitle title={journeyId ? 'Connecting journey' : 'Trip details'} />{legs.map((leg: any, index: number) => <View key={leg.booking_id || leg.id} style={{ paddingBottom: index < legs.length - 1 ? 14 : 0, marginBottom: index < legs.length - 1 ? 14 : 0, borderBottomWidth: index < legs.length - 1 ? 1 : 0, borderBottomColor: colors.border }}><Row style={{ gap: 9, alignItems: 'flex-start' }}><Ionicons name="bus-outline" size={20} color={colors.primary} /><View style={{ flex: 1 }}><Text style={{ fontWeight: '800', color: colors.text }}>{leg.boarding_point} → {leg.dropping_point}</Text><Text style={{ fontSize: 12, color: colors.subtext }}>{leg.journey_date ? shortDate(leg.journey_date) : ''}{leg.departure_time ? ` · ${leg.departure_time.slice(0, 5)}` : ''}</Text><Text style={{ fontSize: 12, color: colors.subtext, marginTop: 3 }}>Seats {(leg.seat_numbers || []).join(', ')}</Text></View><Text style={{ fontWeight: '800', color: colors.text }}>{money(leg.fare ?? leg.total_fare)}</Text></Row></View>)}</Card>
    {booking.passenger_details?.length ? <Card style={{ marginBottom: 14 }}><SectionTitle title="Passengers" />{booking.passenger_details.map((person, index) => <Row key={`${person.seat}-${index}`} style={{ justifyContent: 'space-between', marginBottom: 7 }}><View><Text style={{ fontWeight: '700', color: colors.text }}>{person.name}</Text><Text style={{ fontSize: 11, color: colors.subtext }}>Age {person.age} · {person.gender}</Text></View><Badge tone="neutral" text={`Seat ${person.seat}`} /></Row>)}</Card> : null}
    <Card style={{ marginBottom: 14 }}><Row style={{ justifyContent: 'space-between' }}><Text style={{ fontWeight: '800', color: colors.text }}>Total paid</Text><Text style={{ fontWeight: '900', fontSize: 18, color: colors.primary }}>{money(journey?.final_fare ?? Number(booking.total_fare) - Number(booking.discount_amount || 0))}</Text></Row><Text style={{ fontSize: 11, color: colors.faint, marginTop: 6 }}>Created {dateTime(booking.created_at)}</Text></Card>
    {ticket ? <Button title="View e-ticket" icon="qr-code-outline" onPress={() => navigation.navigate('TicketDetail', { ticketId: ticket.id })} style={{ marginBottom: 10 }} /> : status === 'CONFIRMED' ? <Card style={{ marginBottom: 10, backgroundColor: colors.infoSoft }}><Text style={{ color: colors.info, fontSize: 12 }}>Your e-ticket is being generated. Pull to refresh My Trips in a moment.</Text></Card> : null}
    {cancellable ? <Button title="Cancel booking" variant="danger" icon="close-circle-outline" onPress={cancel} loading={busy} /> : status === 'CONFIRMED' ? <Text style={{ color: colors.subtext, fontSize: 12, textAlign: 'center' }}>{cancellation?.reason || 'Cancellation is no longer available for this booking.'}</Text> : null}
  </ScrollView>;
}
