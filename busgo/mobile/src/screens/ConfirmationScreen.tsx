import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { Badge, Button, Card, Row } from '../components/ui';
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
    <View style={{ alignItems: 'center', paddingVertical: 28 }}><View style={{ width: 74, height: 74, borderRadius: 37, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="checkmark" size={46} color={colors.success} /></View><Text style={{ fontSize: 23, fontWeight: '900', color: colors.text, marginTop: 13 }}>Booking confirmed</Text><Text style={{ color: colors.subtext, textAlign: 'center', marginTop: 6 }}>{params.mode === 'transit' ? 'Every bus in your connecting journey is confirmed.' : 'Your seats are confirmed and payment is complete.'}</Text></View>
    <Card style={{ marginBottom: 14 }}><Row style={{ justifyContent: 'space-between', marginBottom: 9 }}><Text style={{ fontWeight: '900', fontSize: 16, color: colors.text, flex: 1 }}>{params.origin} → {params.destination}</Text><Text style={{ fontWeight: '900', fontSize: 18, color: colors.primary }}>{money(params.amount)}</Text></Row>
      {params.mode === 'transit' && legs.length ? legs.map((leg) => <Row key={leg.booking_id || leg.leg_number} style={{ justifyContent: 'space-between', marginBottom: 7 }}><Text style={{ color: colors.subtext, fontSize: 12, flex: 1 }}>Bus {leg.leg_number}: {leg.boarding_point} → {leg.dropping_point}</Text><Badge tone="success" text={`Seats ${(leg.seat_numbers || []).join(', ')}`} /></Row>) : <Text style={{ color: colors.subtext, fontSize: 12 }}>Booking reference: {reference(params.bookingId)}</Text>}
    </Card>
    <Card style={{ marginBottom: 14, backgroundColor: tickets.length ? colors.successSoft : colors.infoSoft }}><Row style={{ gap: 9 }}><Ionicons name={tickets.length ? 'ticket-outline' : 'hourglass-outline'} size={21} color={tickets.length ? colors.success : colors.info} /><Text style={{ flex: 1, color: tickets.length ? colors.success : colors.info, fontSize: 12 }}>{tickets.length ? `${tickets.length} e-ticket${tickets.length > 1 ? 's are' : ' is'} ready.` : 'Your e-ticket is being generated. It will appear in My Trips and Notifications shortly.'}</Text></Row></Card>
    {tickets.length ? <Button title={tickets.length > 1 ? 'View first e-ticket' : 'View e-ticket'} icon="qr-code-outline" onPress={() => navigation.navigate('TicketDetail', { ticketId: tickets[0].id })} style={{ marginBottom: 10 }} /> : null}
    <Button title="Go to My Trips" variant={tickets.length ? 'outline' : 'primary'} onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] })} />
  </ScrollView>;
}
