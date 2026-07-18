import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { Badge, Button, Card, Row, TicketDivider } from '../components/ui';
import { Ticket } from '../types/api';
import { colors } from '../theme';
import { money, reference } from '../utils/format';
import { ScreenProps } from '../nav';

export default function ConfirmationScreen({ route, navigation }: ScreenProps<'Confirmation'>) {
  const params = route.params;
  const [legs, setLegs] = useState<any[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const load = async () => {
      attempts += 1;
      try {
        if (params.journeyId) { const journey = await api.get(`/api/bookings/journeys/${params.journeyId}`); setLegs(journey.data?.legs || []); }
        const response = await api.get('/api/tickets/my');
        const all = (response.data || []) as Ticket[];
        const bookingIds = params.journeyId && legs.length ? legs.map((leg) => leg.booking_id) : [params.bookingId];
        const matched = all.filter((ticket) => bookingIds.includes(ticket.booking_id));
        setTickets(matched);
        if (!matched.length && attempts < 5) timer = setTimeout(load, 1500);
      } catch { if (attempts < 5) timer = setTimeout(load, 1500); }
    };
    load();
    return () => { if (timer) clearTimeout(timer); };
  }, [params.bookingId, params.journeyId, legs.length]);

  return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
    {/* Success hero */}
    <View style={{ alignItems: 'center', paddingVertical: 28 }}>
      <View style={styles.successRing}>
        <View style={styles.successCircle}><Ionicons name="checkmark" size={44} color="#fff" /></View>
      </View>
      <Text style={{ fontSize: 24, fontWeight: '900', color: colors.text, marginTop: 15 }}>Booking confirmed!</Text>
      <Text style={{ color: colors.subtext, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>{params.mode === 'transit' ? 'Every bus in your connecting journey is confirmed.' : 'Your seats are confirmed and payment is complete.'}</Text>
    </View>

    {/* Journey summary */}
    <Card style={{ marginBottom: 14 }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontWeight: '900', fontSize: 17, color: colors.text, flex: 1, marginRight: 10 }}>{params.origin} → {params.destination}</Text>
        <Text style={{ fontWeight: '900', fontSize: 19, color: colors.primary }}>{money(params.amount)}</Text>
      </Row>
      <Text style={{ fontSize: 11, color: colors.success, fontWeight: '800' }}>PAID</Text>
      <TicketDivider notchColor={colors.bg} />
      {params.mode === 'transit' && legs.length
        ? legs.map((leg) => <Row key={leg.booking_id || leg.leg_number} style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <Row style={{ gap: 7, flex: 1, marginRight: 8 }}>
              <View style={styles.legBubble}><Text style={styles.legBubbleText}>{leg.leg_number}</Text></View>
              <Text style={{ color: colors.subtext, fontSize: 12, flex: 1 }} numberOfLines={1}>{leg.boarding_point} → {leg.dropping_point}</Text>
            </Row>
            <Badge tone="success" text={`Seats ${(leg.seat_numbers || []).join(', ')}`} />
          </Row>)
        : <Row style={{ gap: 6 }}><Ionicons name="pricetag-outline" size={14} color={colors.subtext} /><Text style={{ color: colors.subtext, fontSize: 12 }}>Booking reference: {reference(params.bookingId)}</Text></Row>}
    </Card>

    {/* Ticket status */}
    <Card style={{ marginBottom: 14, backgroundColor: tickets.length ? colors.successSoft : colors.infoSoft, borderColor: tickets.length ? '#a7f3d0' : '#bfdbfe' }}>
      <Row style={{ gap: 10 }}>
        <Ionicons name={tickets.length ? 'ticket' : 'hourglass-outline'} size={21} color={tickets.length ? colors.success : colors.info} />
        <Text style={{ flex: 1, color: tickets.length ? colors.success : colors.info, fontSize: 12, fontWeight: '600', lineHeight: 17 }}>{tickets.length ? `${tickets.length} e-ticket${tickets.length > 1 ? 's are' : ' is'} ready.` : 'Your e-ticket is being generated. It will appear in My Trips and Notifications shortly.'}</Text>
      </Row>
    </Card>

    {tickets.length ? <Button title={tickets.length > 1 ? 'View first e-ticket' : 'View e-ticket'} icon="qr-code-outline" onPress={() => navigation.navigate('TicketDetail', { ticketId: tickets[0].id })} style={{ marginBottom: 10 }} /> : null}
    <Button title="Go to My Trips" variant={tickets.length ? 'outline' : 'primary'} icon="briefcase-outline" onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] })} />
  </ScrollView>;
}

const styles = StyleSheet.create({
  successRing: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' },
  successCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  legBubble: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder, alignItems: 'center', justifyContent: 'center' },
  legBubbleText: { color: colors.primary, fontWeight: '900', fontSize: 10 },
});
