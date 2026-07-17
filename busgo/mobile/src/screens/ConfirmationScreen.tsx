import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { api } from '../api/client';
import { Badge, Button, Card, Row } from '../components/ui';
import { colors } from '../theme';
import { ScreenProps } from '../nav';

export default function ConfirmationScreen({ route, navigation }: ScreenProps<'Confirmation'>) {
  const p = route.params;
  const [legs, setLegs] = useState<any[]>([]);

  useEffect(() => {
    if (p.mode === 'transit' && p.journeyId) {
      api
        .get(`/api/bookings/journeys/${p.journeyId}`)
        .then((r) => setLegs(r.data?.legs || []))
        .catch(() => {});
    }
  }, []);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <View style={{ alignItems: 'center', paddingVertical: 28 }}>
        <Text style={{ fontSize: 60 }}>🎉</Text>
        <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text, marginTop: 8 }}>
          Payment successful!
        </Text>
        <Text style={{ color: colors.subtext, textAlign: 'center', marginTop: 6 }}>
          {p.mode === 'transit'
            ? 'All buses in your journey are confirmed. One e-ticket per bus is on its way.'
            : 'Your seats are confirmed. Your e-ticket is on its way.'}
        </Text>
      </View>

      <Card style={{ marginBottom: 14 }}>
        <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text }}>
            {p.origin} → {p.destination}
          </Text>
          <Text style={{ fontWeight: '900', fontSize: 16, color: colors.primary }}>৳{p.amount}</Text>
        </Row>
        {p.mode === 'transit' ? (
          legs.length > 0 ? (
            legs.map((l) => (
              <Row key={l.leg_number} style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: colors.subtext, fontSize: 13 }}>
                  Bus {l.leg_number}: {l.boarding_point} → {l.dropping_point}
                </Text>
                <Badge tone="success" text={`Seats ${(l.seat_numbers || []).join(', ')}`} />
              </Row>
            ))
          ) : (
            <Text style={{ color: colors.subtext, fontSize: 13 }}>Journey ref: {p.journeyId?.slice(0, 8)}</Text>
          )
        ) : (
          <Text style={{ color: colors.subtext, fontSize: 13 }}>Booking ref: {p.bookingId.slice(0, 8).toUpperCase()}</Text>
        )}
      </Card>

      <Button title="View my trips" onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] })} />
    </ScrollView>
  );
}
