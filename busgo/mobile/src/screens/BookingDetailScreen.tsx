import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { Badge, Button, Card, ErrorState, Loading, Row, SectionTitle, TicketDivider } from '../components/ui';
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
    {/* Reference header */}
    <Card style={{ marginBottom: 14, overflow: 'hidden' }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <Text style={{ color: colors.faint, fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>BOOKING REFERENCE</Text>
          <Text style={{ fontWeight: '900', fontSize: 22, color: colors.text, marginTop: 2 }}>{reference(journeyId || booking.id)}</Text>
        </View>
        <Badge tone={status === 'CONFIRMED' ? 'success' : status === 'CANCELLED' || status === 'REFUNDED' ? 'neutral' : 'warn'} text={status.replaceAll('_', ' ')} />
      </Row>
      {journeyId ? <View style={{ marginTop: 8 }}><Badge tone="primary" text={`Transit journey · ${legs.length} buses · one payment`} /></View> : null}
    </Card>

    {/* Legs */}
    <Card style={{ marginBottom: 14 }}>
      <SectionTitle title={journeyId ? 'Connecting journey' : 'Trip details'} />
      {legs.map((leg: any, index: number) => <View key={leg.booking_id || leg.id}>
        <Row style={{ gap: 10, alignItems: 'flex-start' }}>
          <View style={styles.legBubble}><Ionicons name="bus" size={13} color={colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '800', color: colors.text }}>{leg.boarding_point} → {leg.dropping_point}</Text>
            <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 2 }}>{leg.journey_date ? shortDate(leg.journey_date) : ''}{leg.departure_time ? ` · ${String(leg.departure_time).slice(0, 5)}` : ''}{leg.operator_name ? ` · ${leg.operator_name}` : ''}</Text>
            <Row style={{ gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
              {(leg.seat_numbers || []).map((seat: string) => <Badge key={seat} tone="primary" text={`Seat ${seat}`} />)}
            </Row>
          </View>
          <Text style={{ fontWeight: '800', color: colors.text }}>{money(leg.fare ?? leg.total_fare)}</Text>
        </Row>
        {index < legs.length - 1 ? <View style={styles.legConnector} /> : null}
      </View>)}
    </Card>

    {/* Passengers */}
    {booking.passenger_details?.length ? <Card style={{ marginBottom: 14 }}>
      <SectionTitle title="Passengers" />
      {booking.passenger_details.map((person, index) => <Row key={`${person.seat}-${index}`} style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <Row style={{ gap: 9 }}>
          <View style={styles.personIcon}><Ionicons name="person" size={13} color={colors.subtext} /></View>
          <View>
            <Text style={{ fontWeight: '700', color: colors.text }}>{person.name}</Text>
            <Text style={{ fontSize: 11, color: colors.subtext }}>Age {person.age} · {person.gender}</Text>
          </View>
        </Row>
        <Badge tone="neutral" text={`Seat ${person.seat}`} />
      </Row>)}
    </Card> : null}

    {/* Total */}
    <Card style={{ marginBottom: 14 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: '800', color: colors.text }}>Total paid</Text>
        <Text style={{ fontWeight: '900', fontSize: 19, color: colors.primary }}>{money(journey?.final_fare ?? Number(booking.total_fare) - Number(booking.discount_amount || 0))}</Text>
      </Row>
      <TicketDivider notchColor={colors.bg} />
      <Row style={{ gap: 5 }}>
        <Ionicons name="time-outline" size={13} color={colors.faint} />
        <Text style={{ fontSize: 11, color: colors.faint }}>Created {dateTime(booking.created_at)}</Text>
      </Row>
    </Card>

    {ticket ? <Button title="View e-ticket" icon="qr-code-outline" onPress={() => navigation.navigate('TicketDetail', { ticketId: ticket.id })} style={{ marginBottom: 10 }} /> : status === 'CONFIRMED' ? <Card style={{ marginBottom: 10, backgroundColor: colors.infoSoft, borderColor: '#bfdbfe' }}><Row style={{ gap: 8 }}><Ionicons name="hourglass-outline" size={17} color={colors.info} /><Text style={{ color: colors.info, fontSize: 12, flex: 1 }}>Your e-ticket is being generated. Pull to refresh My Trips in a moment.</Text></Row></Card> : null}
    {cancellable ? <Button title="Cancel booking" variant="danger" icon="close-circle-outline" onPress={cancel} loading={busy} /> : status === 'CONFIRMED' ? <Text style={{ color: colors.subtext, fontSize: 12, textAlign: 'center' }}>{cancellation?.reason || 'Cancellation is no longer available for this booking.'}</Text> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  legBubble: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  legConnector: { width: 2, height: 18, backgroundColor: colors.primaryBorder, marginLeft: 13, marginVertical: 4, borderRadius: 1 },
  personIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
});
