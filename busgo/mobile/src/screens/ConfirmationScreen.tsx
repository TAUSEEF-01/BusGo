import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { Badge, Button, Card, Row, TicketDivider } from '../components/ui';
import { Ticket } from '../types/api';
import { colors } from '../theme';
import { money, reference } from '../utils/format';
import { ScreenProps } from '../nav';

type Phase = 'confirming' | 'confirmed' | 'pending';

const CONFIRM_ATTEMPTS = 10;
const CONFIRM_INTERVAL_MS = 1800;

/**
 * P0.3: this screen never claims success on its own. It polls the server until
 * every booking (or the journey) reports CONFIRMED, showing an honest
 * "payment received, confirming seats" state until then.
 */
export default function ConfirmationScreen({ route, navigation }: ScreenProps<'Confirmation'>) {
  const params = route.params;
  const [phase, setPhase] = useState<Phase>('confirming');
  const [legs, setLegs] = useState<any[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const legsRef = useRef<any[]>([]);

  // Reconcile booking/journey state with the server.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    const check = async () => {
      attempts += 1;
      try {
        let confirmed = false;
        if (params.mode === 'transit' && params.journeyId) {
          const journey = await api.get(`/api/bookings/journeys/${params.journeyId}`);
          if (cancelled) return;
          legsRef.current = journey.data?.legs || [];
          setLegs(legsRef.current);
          confirmed = String(journey.data?.status || '').toUpperCase() === 'CONFIRMED';
        } else {
          const ids = [params.bookingId, params.returnBookingId].filter(Boolean) as string[];
          const responses = await Promise.all(ids.map((id) => api.get(`/api/bookings/${id}`)));
          if (cancelled) return;
          confirmed = responses.every((response) => String(response.data?.status || '').toUpperCase() === 'CONFIRMED');
        }
        if (confirmed) { setPhase('confirmed'); return; }
      } catch { /* transient network problems keep polling */ }
      if (cancelled) return;
      if (attempts < CONFIRM_ATTEMPTS) timer = setTimeout(check, CONFIRM_INTERVAL_MS);
      else setPhase('pending');
    };
    check();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [params.bookingId, params.journeyId, params.returnBookingId, params.mode]);

  // Poll for issued tickets once confirmed.
  useEffect(() => {
    if (phase !== 'confirmed') return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    const load = async () => {
      attempts += 1;
      try {
        const response = await api.get('/api/tickets/my');
        if (cancelled) return;
        const all = (response.data || []) as Ticket[];
        const bookingIds = params.journeyId && legsRef.current.length
          ? legsRef.current.map((leg) => leg.booking_id)
          : [params.bookingId, params.returnBookingId].filter(Boolean);
        const matched = all.filter((ticket) => bookingIds.includes(ticket.booking_id));
        setTickets(matched);
        if (matched.length < bookingIds.length && attempts < 6) timer = setTimeout(load, 1500);
      } catch { if (!cancelled && attempts < 6) timer = setTimeout(load, 1500); }
    };
    load();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [phase]);

  const heroIcon = phase === 'confirmed' ? 'checkmark' : phase === 'confirming' ? 'card-outline' : 'time-outline';
  const heroColor = phase === 'confirmed' ? colors.success : phase === 'confirming' ? colors.info : colors.warn;
  const heroSoft = phase === 'confirmed' ? colors.successSoft : phase === 'confirming' ? colors.infoSoft : colors.warnSoft;

  return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
    {/* Status hero */}
    <View style={{ alignItems: 'center', paddingVertical: 28 }}>
      <View style={[styles.ring, { backgroundColor: heroSoft }]}>
        <View style={[styles.circle, { backgroundColor: heroColor }]}><Ionicons name={heroIcon} size={40} color="#fff" /></View>
      </View>
      <Text style={{ fontSize: 24, fontWeight: '900', color: colors.text, marginTop: 15 }}>
        {phase === 'confirmed' ? 'Booking confirmed!' : phase === 'confirming' ? 'Payment received' : 'Confirmation pending'}
      </Text>
      <Text style={{ color: colors.subtext, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
        {phase === 'confirmed'
          ? (params.mode === 'transit' ? 'Every bus in your connecting journey is confirmed.' : params.returnBookingId ? 'Both directions of your round trip are confirmed.' : 'Your seats are confirmed and payment is complete.')
          : phase === 'confirming'
          ? 'Confirming your seats with the operator — this normally takes a few seconds.'
          : 'Your payment was received but the booking has not confirmed yet. It will finish automatically — check My Trips in a minute. You will not be charged twice.'}
      </Text>
    </View>

    {/* Journey summary */}
    <Card style={{ marginBottom: 14 }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontWeight: '900', fontSize: 17, color: colors.text, flex: 1, marginRight: 10 }}>{params.origin} → {params.destination}{params.returnBookingId ? ` → ${params.origin}` : ''}</Text>
        <Text style={{ fontWeight: '900', fontSize: 19, color: colors.primary }}>{money(params.amount)}</Text>
      </Row>
      <Text style={{ fontSize: 11, color: phase === 'confirmed' ? colors.success : colors.warn, fontWeight: '800' }}>{phase === 'confirmed' ? 'PAID · CONFIRMED' : 'PAID · CONFIRMING'}</Text>
      <TicketDivider notchColor={colors.bg} />
      {params.mode === 'transit' && legs.length
        ? legs.map((leg) => <Row key={leg.booking_id || leg.leg_number} style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <Row style={{ gap: 7, flex: 1, marginRight: 8 }}>
              <View style={styles.legBubble}><Text style={styles.legBubbleText}>{leg.leg_number}</Text></View>
              <Text style={{ color: colors.subtext, fontSize: 12, flex: 1 }} numberOfLines={1}>{leg.boarding_point} → {leg.dropping_point}</Text>
            </Row>
            <Badge tone="success" text={`Seats ${(leg.seat_numbers || []).join(', ')}`} />
          </Row>)
        : <View>
            <Row style={{ gap: 6 }}><Ionicons name="pricetag-outline" size={14} color={colors.subtext} /><Text style={{ color: colors.subtext, fontSize: 12 }}>Outbound reference: {reference(params.bookingId)}</Text></Row>
            {params.returnBookingId ? <Row style={{ gap: 6, marginTop: 5 }}><Ionicons name="return-down-back-outline" size={14} color={colors.subtext} /><Text style={{ color: colors.subtext, fontSize: 12 }}>Return reference: {reference(params.returnBookingId)}</Text></Row> : null}
          </View>}
    </Card>

    {/* Ticket status */}
    {phase === 'confirmed' ? <Card style={{ marginBottom: 14, backgroundColor: tickets.length ? colors.successSoft : colors.infoSoft, borderColor: tickets.length ? '#a7f3d0' : '#bfdbfe' }}>
      <Row style={{ gap: 10 }}>
        <Ionicons name={tickets.length ? 'ticket' : 'hourglass-outline'} size={21} color={tickets.length ? colors.success : colors.info} />
        <Text style={{ flex: 1, color: tickets.length ? colors.success : colors.info, fontSize: 12, fontWeight: '600', lineHeight: 17 }}>{tickets.length ? `${tickets.length} e-ticket${tickets.length > 1 ? 's are' : ' is'} ready.` : 'Your e-ticket is being generated. It will appear in My Trips and Notifications shortly.'}</Text>
      </Row>
    </Card> : null}

    {tickets.length === 1 ? <Button title="View e-ticket" icon="qr-code-outline" onPress={() => navigation.navigate('TicketDetail', { ticketId: tickets[0].id })} style={{ marginBottom: 10 }} /> : null}
    {tickets.length > 1 ? tickets.map((ticket, index) => (
      <Button key={ticket.id} title={`View ticket ${index + 1} of ${tickets.length} · ${reference(ticket.id)}`} icon="qr-code-outline" variant={index === 0 ? 'primary' : 'outline'} onPress={() => navigation.navigate('TicketDetail', { ticketId: ticket.id })} style={{ marginBottom: 8 }} />
    )) : null}
    <Button title="Go to My Trips" variant={tickets.length ? 'outline' : 'primary'} icon="briefcase-outline" onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] })} style={tickets.length > 1 ? { marginTop: 2 } : undefined} />
  </ScrollView>;
}

const styles = StyleSheet.create({
  ring: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  circle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  legBubble: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder, alignItems: 'center', justifyContent: 'center' },
  legBubbleText: { color: colors.primary, fontWeight: '900', fontSize: 10 },
});
