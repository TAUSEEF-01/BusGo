import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { Badge, Button, Card, ErrorState, Loading, OperatorLogo, Row, SectionTitle, TicketDivider } from '../components/ui';
import { Booking, Journey, Ticket } from '../types/api';
import { colors } from '../theme';
import { busDisplayName, dateTime, durationBetween, money, reference, shortDate, shortTime } from '../utils/format';
import { ScreenProps } from '../nav';

const AMENITY_LABEL: Record<string, string> = { ac: 'AC', wifi: 'WiFi', usb: 'USB' };

interface CancelPolicy {
  cancellable: boolean;
  reason?: string | null;
  refund_amount?: number;
  refund_percentage?: number;
  window_expires_at?: string | null;
}

export default function BookingDetailScreen({ route, navigation }: ScreenProps<'BookingDetail'>) {
  const { bookingId, journeyId } = route.params;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [policy, setPolicy] = useState<CancelPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [bookingResponse, ticketsResponse] = await Promise.all([api.get(`/api/bookings/${bookingId}`), api.get('/api/tickets/my')]);
      const nextBooking = bookingResponse.data as Booking;
      setBooking(nextBooking);
      const allTickets = (ticketsResponse.data || []) as Ticket[];
      let nextJourney: Journey | null = null;
      if (journeyId) {
        const response = await api.get(`/api/bookings/journeys/${journeyId}`);
        nextJourney = response.data as Journey;
        setJourney(nextJourney);
      }
      const legBookingIds = nextJourney ? nextJourney.legs.map((leg) => leg.booking_id) : [bookingId];
      setTickets(allTickets.filter((ticket) => legBookingIds.includes(ticket.booking_id))
        .sort((a, b) => legBookingIds.indexOf(a.booking_id) - legBookingIds.indexOf(b.booking_id)));

      // P1.7: the server owns the cancellation policy — never assume one.
      const status = String(nextJourney?.status || nextBooking.status || '').toUpperCase();
      if (status === 'CONFIRMED') {
        if (journeyId) {
          try {
            const response = await api.get(`/api/bookings/journeys/${journeyId}/cancellation-info`);
            setPolicy(response.data);
          } catch {
            // No journey preview endpoint yet: allow the attempt, the server
            // still enforces its policy on the cancel call itself.
            setPolicy({ cancellable: true, reason: null });
          }
        } else {
          const response = await api.get(`/api/bookings/${bookingId}/cancellation-info`);
          setPolicy(response.data);
        }
      } else {
        setPolicy(null);
      }
    } catch (reason: any) { setError(reason.message || 'Could not load this booking.'); }
    finally { setLoading(false); }
  }, [bookingId, journeyId]);

  useEffect(() => { load(); }, [load]);
  const status = String(journey?.status || booking?.status || '').toUpperCase();
  const cancellable = !!policy?.cancellable;

  const cancel = () => {
    const refundText = policy?.refund_amount != null
      ? `The current policy refunds ${money(policy.refund_amount)}${policy.refund_percentage != null ? ` (${policy.refund_percentage}%)` : ''} to your BusGo account.`
      : 'The refund follows the current cancellation policy.';
    Alert.alert('Cancel booking?', `This cancels ${journeyId ? 'every bus in the connecting journey' : 'this booking'}. ${refundText}`, [
      { text: 'Keep booking', style: 'cancel' },
      { text: 'Cancel booking', style: 'destructive', onPress: async () => {
        setBusy(true);
        try {
          const response = journeyId ? await api.post(`/api/bookings/journeys/${journeyId}/cancel`) : await api.post(`/api/bookings/${bookingId}/cancel`);
          Alert.alert('Booking cancelled', response.data?.message || response.message || `Refund: ${money(response.data?.refund_amount)}`);
          setLoading(true); await load();
        } catch (reason: any) { Alert.alert('Cancellation failed', reason.message); }
        finally { setBusy(false); }
      } },
    ]);
  };

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}><Loading label="Loading booking…" /></View>;
  if (error || !booking) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}><ErrorState message={error || 'Booking not found.'} onRetry={() => { setLoading(true); load(); }} /></View>;

  const legs = journey?.legs || null;
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
      {journeyId && journey ? <View style={{ marginTop: 8 }}><Badge tone="primary" text={`Transit journey · ${journey.leg_count} buses · one payment · ${journey.leg_count} tickets`} /></View> : null}
    </Card>

    {/* Trip / legs */}
    <Card style={{ marginBottom: 14 }}>
      <SectionTitle title={journeyId ? 'Connecting journey' : 'Trip details'} />
      {legs ? legs.map((leg, index) => <View key={leg.booking_id}>
        <Row style={{ gap: 10, alignItems: 'flex-start' }}>
          <View style={styles.legBubble}><Text style={{ color: colors.primary, fontWeight: '900', fontSize: 11 }}>{index + 1}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '800', color: colors.text }}>Bus {index + 1}: {leg.origin_city} → {leg.destination_city}</Text>
            <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 2 }}>{leg.operator_name}{leg.bus_registration_no ? ` · ${leg.bus_registration_no}` : ''}{leg.bus_type ? ` · ${leg.bus_type}` : ''}</Text>
            <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 2 }}>
              {leg.journey_date ? shortDate(leg.journey_date) : ''}
              {leg.departure_datetime ? ` · ${shortTime(leg.departure_datetime)} – ${shortTime(leg.arrival_datetime)}` : leg.departure_time ? ` · ${String(leg.departure_time).slice(0, 5)}` : ''}
              {durationBetween(leg.departure_datetime, leg.arrival_datetime) ? ` · ${durationBetween(leg.departure_datetime, leg.arrival_datetime)}` : ''}
            </Text>
            <Text style={{ fontSize: 11, color: colors.faint, marginTop: 2 }}>Board: {leg.boarding_point} · Drop: {leg.dropping_point}</Text>
            <Row style={{ gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
              {(leg.seat_numbers || []).map((seat) => <Badge key={seat} tone="primary" text={`Seat ${seat}`} />)}
              {(leg.amenities || []).map((amenity) => AMENITY_LABEL[amenity.toLowerCase()] ? <Badge key={amenity} tone="info" text={AMENITY_LABEL[amenity.toLowerCase()]} /> : null)}
            </Row>
          </View>
          <Text style={{ fontWeight: '800', color: colors.text }}>{money(leg.fare)}</Text>
        </Row>
        {index < legs.length - 1 ? <Row style={{ gap: 6, marginLeft: 36, marginVertical: 7 }}>
          <Ionicons name="swap-horizontal" size={13} color={colors.warn} />
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.warn }}>Change at {journey?.transfers[index]?.city || leg.destination_city}{journey?.transfers[index]?.wait_minutes != null ? ` · ${journey.transfers[index].wait_minutes} min wait` : ''}</Text>
        </Row> : null}
      </View>) : <View>
        <Row style={{ gap: 11, marginBottom: 10 }}>
          <OperatorLogo name={booking.operator_name || 'Bus operator'} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '800', color: colors.text }}>{booking.operator_name || 'Bus operator'}</Text>
            <Row style={{ gap: 4, marginTop: 2 }}>
              <Ionicons name="bus-outline" size={11} color={colors.primary} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>{busDisplayName(booking)}</Text>
              {booking.bus_type ? <Badge tone="neutral" text={booking.bus_type} /> : null}
            </Row>
          </View>
        </Row>
        <Text style={{ fontWeight: '800', color: colors.text }}>{booking.origin_city || booking.boarding_point} → {booking.destination_city || booking.dropping_point}</Text>
        <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 2 }}>
          {shortDate(booking.journey_date)}
          {booking.departure_datetime ? ` · ${shortTime(booking.departure_datetime)} – ${shortTime(booking.arrival_datetime)}` : ` · ${String(booking.departure_time).slice(0, 5)}`}
          {durationBetween(booking.departure_datetime, booking.arrival_datetime) ? ` · ${durationBetween(booking.departure_datetime, booking.arrival_datetime)}` : ''}
        </Text>
        <Text style={{ fontSize: 11, color: colors.faint, marginTop: 2 }}>Board: {booking.boarding_point} · Drop: {booking.dropping_point}</Text>
        <Row style={{ gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
          {(booking.seat_numbers || []).map((seat) => <Badge key={seat} tone="primary" text={`Seat ${seat}`} />)}
          {(booking.amenities || []).map((amenity) => AMENITY_LABEL[amenity.toLowerCase()] ? <Badge key={amenity} tone="info" text={AMENITY_LABEL[amenity.toLowerCase()]} /> : null)}
        </Row>
      </View>}
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
      {journey && journey.discount_amount > 0 ? <Row style={{ justifyContent: 'space-between', marginTop: 4 }}><Text style={{ fontSize: 12, color: colors.success }}>Through-service discount</Text><Text style={{ fontSize: 12, fontWeight: '700', color: colors.success }}>−{money(journey.discount_amount)}</Text></Row> : null}
      {!journey && Number(booking.discount_amount || 0) > 0 ? <Row style={{ justifyContent: 'space-between', marginTop: 4 }}><Text style={{ fontSize: 12, color: colors.success }}>Promo {booking.promo_code || ''}</Text><Text style={{ fontSize: 12, fontWeight: '700', color: colors.success }}>−{money(booking.discount_amount)}</Text></Row> : null}
      <TicketDivider notchColor={colors.bg} />
      <Row style={{ gap: 5 }}>
        <Ionicons name="time-outline" size={13} color={colors.faint} />
        <Text style={{ fontSize: 11, color: colors.faint }}>Created {dateTime(booking.created_at)}</Text>
      </Row>
    </Card>

    {/* Tickets */}
    {tickets.length ? tickets.map((ticket, index) => (
      <Button key={ticket.id} title={tickets.length > 1 ? `E-ticket · Bus ${index + 1} of ${tickets.length} · ${reference(ticket.id)}` : 'View e-ticket'} icon="qr-code-outline" variant={index === 0 ? 'primary' : 'outline'} onPress={() => navigation.navigate('TicketDetail', { ticketId: ticket.id })} style={{ marginBottom: 8 }} />
    )) : status === 'CONFIRMED' ? <Card style={{ marginBottom: 10, backgroundColor: colors.infoSoft, borderColor: '#bfdbfe' }}><Row style={{ gap: 8 }}><Ionicons name="hourglass-outline" size={17} color={colors.info} /><Text style={{ color: colors.info, fontSize: 12, flex: 1 }}>Your e-ticket is being generated. Pull to refresh My Trips in a moment.</Text></Row></Card> : null}

    {/* Cancellation (server policy) */}
    {cancellable ? <>
      {policy?.window_expires_at ? <Text style={{ color: colors.subtext, fontSize: 11, textAlign: 'center', marginBottom: 8 }}>Free cancellation window closes {dateTime(policy.window_expires_at)}{policy.refund_percentage != null ? ` · ${policy.refund_percentage}% refund` : ''}</Text> : null}
      <Button title={policy?.refund_amount != null ? `Cancel booking · refund ${money(policy.refund_amount)}` : 'Cancel booking'} variant="danger" icon="close-circle-outline" onPress={cancel} loading={busy} />
    </> : status === 'CONFIRMED' ? <Text style={{ color: colors.subtext, fontSize: 12, textAlign: 'center' }}>{policy?.reason || 'Cancellation is no longer available for this booking.'}</Text> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  legBubble: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  personIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
});
