import React, { useEffect, useState } from 'react';
import { Alert, Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { api } from '../api/client';
import { Badge, Button, Card, ErrorState, Loading, Row, TicketDivider } from '../components/ui';
import { Booking, Journey, JourneyLeg, Passenger, Ticket } from '../types/api';
import { colors } from '../theme';
import { busDisplayName, dateTime, durationBetween, reference, shortDate, shortTime } from '../utils/format';
import { ScreenProps } from '../nav';
import { API_URL } from '../config';

const assetUrl = (value?: string | null) => value
  ? (value.startsWith('http://') || value.startsWith('https://') ? value : `${API_URL}${value.startsWith('/') ? '' : '/'}${value}`)
  : null;

export default function TicketDetailScreen({ route }: ScreenProps<'TicketDetail'>) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const response = await api.get(`/api/tickets/${route.params.ticketId}`);
      const nextTicket = response.data as Ticket;
      setTicket(nextTicket);
      // Enrich with the booking (operator/bus/route/schedule); tolerate failure —
      // the QR alone is still a usable ticket.
      try {
        const bookingResponse = await api.get(`/api/bookings/${nextTicket.booking_id}`);
        const nextBooking = bookingResponse.data as Booking;
        setBooking(nextBooking);
        if (nextBooking.journey_id) {
          const journeyResponse = await api.get(`/api/bookings/journeys/${nextBooking.journey_id}`);
          setJourney(journeyResponse.data as Journey);
        }
      } catch { /* context is optional */ }
    } catch (reason: any) { setError(reason.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [route.params.ticketId]);

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}><Loading label="Loading e-ticket…" /></View>;
  if (error || !ticket) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}><ErrorState message={error || 'Ticket not found.'} onRetry={() => { setLoading(true); load(); }} /></View>;

  const leg: JourneyLeg | null = journey?.legs.find((item) => item.booking_id === ticket.booking_id) || null;
  const legIndex = leg && journey ? journey.legs.indexOf(leg) : -1;
  const operatorName = leg?.operator_name || booking?.operator_name || null;
  const busLabel = leg ? busDisplayName(leg) : booking ? busDisplayName(booking) : null;
  const busType = leg?.bus_type || booking?.bus_type || null;
  const originCity = leg?.origin_city || booking?.origin_city || booking?.boarding_point || null;
  const destinationCity = leg?.destination_city || booking?.destination_city || booking?.dropping_point || null;
  const boardingPoint = leg?.boarding_point || booking?.boarding_point || null;
  const droppingPoint = leg?.dropping_point || booking?.dropping_point || null;
  const journeyDate = leg?.journey_date || booking?.journey_date || null;
  const departure = leg?.departure_datetime || booking?.departure_datetime || null;
  const arrival = leg?.arrival_datetime || booking?.arrival_datetime || null;
  const duration = durationBetween(departure, arrival);
  const passengers: Passenger[] = Array.isArray(ticket.passenger_details)
    ? (ticket.passenger_details as Passenger[])
    : (booking?.passenger_details || []);
  const transfer = journey && legIndex >= 0 && legIndex < journey.legs.length - 1 ? journey.transfers[legIndex] : null;

  return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
    {/* Boarding-pass style ticket */}
    <Card style={{ marginBottom: 14, padding: 0, overflow: 'hidden' }}>
      {/* Ticket header strip */}
      <View style={styles.ticketHeader}>
        <Row style={{ gap: 8 }}>
          <View style={styles.logoBox}><Ionicons name="bus" size={16} color="#fff" /></View>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>BusGo</Text>
          {journey && legIndex >= 0 ? <View style={styles.legPill}><Text style={{ color: '#fff', fontWeight: '800', fontSize: 11 }}>Bus {legIndex + 1} of {journey.leg_count}</Text></View> : null}
        </Row>
        <Badge tone={ticket.status === 'ACTIVE' ? 'success' : 'neutral'} text={ticket.status} />
      </View>

      <View style={{ padding: 18, alignItems: 'center' }}>
        <Text style={{ color: colors.faint, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 }}>E-TICKET</Text>
        <Text style={{ fontWeight: '900', fontSize: 24, color: colors.text, marginTop: 2, letterSpacing: 1 }}>{reference(ticket.id)}</Text>

        {/* Route summary */}
        {originCity && destinationCity ? <View style={{ alignSelf: 'stretch', marginTop: 12 }}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.metaLabel}>FROM</Text>
              <Text style={styles.routeCity}>{originCity}</Text>
              {boardingPoint && boardingPoint !== originCity ? <Text style={styles.terminal} numberOfLines={1}>{boardingPoint}</Text> : null}
              {departure ? <Text style={styles.routeTime}>{shortTime(departure)}</Text> : null}
            </View>
            <View style={{ alignItems: 'center', paddingTop: 14, paddingHorizontal: 6 }}>
              <Ionicons name="bus" size={17} color={colors.primary} />
              {duration ? <Text style={{ fontSize: 10, color: colors.faint, marginTop: 2 }}>{duration}</Text> : null}
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.metaLabel}>TO</Text>
              <Text style={styles.routeCity}>{destinationCity}</Text>
              {droppingPoint && droppingPoint !== destinationCity ? <Text style={[styles.terminal, { textAlign: 'right' }]} numberOfLines={1}>{droppingPoint}</Text> : null}
              {arrival ? <Text style={styles.routeTime}>{shortTime(arrival)}</Text> : null}
            </View>
          </Row>
          <Row style={{ justifyContent: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {journeyDate ? <Badge tone="primary" text={shortDate(journeyDate)} /> : null}
            {operatorName ? <Badge tone="neutral" text={operatorName} /> : null}
            {busLabel ? <Badge tone="neutral" text={busLabel} /> : null}
            {busType ? <Badge tone="neutral" text={busType} /> : null}
          </Row>
        </View> : null}

        {ticket.qr_code_url
          ? <View style={styles.qrFrame}><Image source={{ uri: assetUrl(ticket.qr_code_url)! }} resizeMode="contain" style={{ width: 210, height: 210 }} /></View>
          : <View style={[styles.qrFrame, { width: 230, height: 180, alignItems: 'center', justifyContent: 'center' }]}><Ionicons name="hourglass-outline" size={26} color={colors.faint} /><Text style={{ color: colors.subtext, fontSize: 12, marginTop: 6 }}>QR image is being generated</Text></View>}

        <Row style={{ gap: 5 }}>
          <Ionicons name="scan-outline" size={13} color={colors.subtext} />
          <Text style={{ color: colors.subtext, fontSize: 12, textAlign: 'center' }}>Show this QR code when boarding. Do not share it publicly.</Text>
        </Row>

        <View style={{ alignSelf: 'stretch', paddingHorizontal: 8 }}><TicketDivider notchColor={colors.bg} /></View>

        {/* Passengers */}
        {passengers.length ? <View style={{ alignSelf: 'stretch', paddingHorizontal: 8, marginBottom: 10 }}>
          {passengers.map((person, index) => <Row key={`${person.seat}-${index}`} style={{ justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{person.name}</Text>
            <Text style={{ fontSize: 13, fontWeight: '900', color: colors.primary }}>Seat {person.seat}</Text>
          </Row>)}
        </View> : null}

        <Row style={{ alignSelf: 'stretch', justifyContent: 'space-between', paddingHorizontal: 8 }}>
          <View>
            <Text style={styles.metaLabel}>SEATS</Text>
            <Text style={styles.metaValue}>{ticket.seat_numbers.join(', ')}</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.metaLabel}>BOOKING</Text>
            <Text style={styles.metaValue}>{reference(ticket.booking_id)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.metaLabel}>ISSUED</Text>
            <Text style={[styles.metaValue, { fontSize: 12 }]}>{dateTime(ticket.issued_at)}</Text>
          </View>
        </Row>
      </View>
    </Card>

    {/* Transfer instruction (kept outside the QR) */}
    {transfer ? <Card style={{ marginBottom: 14, backgroundColor: colors.warnSoft, borderColor: '#fde68a' }}>
      <Row style={{ gap: 9 }}>
        <Ionicons name="swap-horizontal" size={18} color={colors.warn} />
        <Text style={{ flex: 1, fontSize: 12, color: colors.warn, fontWeight: '600', lineHeight: 17 }}>
          After this bus, change at {transfer.city}{transfer.wait_minutes != null ? ` — about ${transfer.wait_minutes} minutes to board Bus ${legIndex + 2}` : ` to board Bus ${legIndex + 2}`}. Use the next ticket for that bus.
        </Text>
      </Row>
    </Card> : null}

    <Button title="Copy ticket reference" variant="outline" icon="copy-outline" onPress={async () => { await Clipboard.setStringAsync(ticket.id); Alert.alert('Copied', 'Ticket reference copied.'); }} style={{ marginBottom: 10 }} />
    {ticket.pdf_url ? <Button title="Open PDF ticket" icon="document-text-outline" onPress={() => Linking.openURL(assetUrl(ticket.pdf_url)!)} /> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  ticketHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 12 },
  logoBox: { width: 28, height: 28, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  legPill: { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  qrFrame: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 18, padding: 10, marginVertical: 16, backgroundColor: '#fff' },
  metaLabel: { fontSize: 9, fontWeight: '800', color: colors.faint, letterSpacing: 1 },
  metaValue: { fontSize: 14, fontWeight: '900', color: colors.text, marginTop: 2 },
  routeCity: { fontSize: 16, fontWeight: '900', color: colors.text, marginTop: 2 },
  routeTime: { fontSize: 13, fontWeight: '800', color: colors.primary, marginTop: 2 },
  terminal: { fontSize: 10, color: colors.subtext, marginTop: 1 },
});
