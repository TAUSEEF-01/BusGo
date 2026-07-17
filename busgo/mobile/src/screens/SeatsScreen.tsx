import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { api } from '../api/client';
import { SeatCell, SeatGrid, SeatLegend, toSeatCells } from '../components/SeatGrid';
import { Button, Card, Loading, Row } from '../components/ui';
import { colors } from '../theme';
import { ScreenProps } from '../nav';

const MAX_SEATS = 4;
const SERVICE_FEE = 20;

export default function SeatsScreen({ route, navigation }: ScreenProps<'Seats'>) {
  const { trip, origin, destination, date } = route.params;
  const tripId = (trip.trip_id || trip.id) as string;
  const [seats, setSeats] = useState<SeatCell[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/api/inventory/trips/${tripId}/seats?_t=${Date.now()}`)
      .then((r) => setSeats(toSeatCells(r.data || [])))
      .catch(() => setSeats(toSeatCells([])))
      .finally(() => setLoading(false));
  }, [tripId]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((s) => s !== id);
      if (prev.length >= MAX_SEATS) {
        Alert.alert('Limit reached', `Maximum ${MAX_SEATS} seats per booking.`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const total = selected.length * Number(trip.fare_amount) + (selected.length ? SERVICE_FEE : 0);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Card style={{ marginBottom: 14 }}>
        <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text }}>
          {trip.operator_name || 'Operator'}
        </Text>
        <Text style={{ color: colors.subtext, fontSize: 13 }}>
          {origin} → {destination} · {date} · ৳{trip.fare_amount}/seat
        </Text>
      </Card>

      {loading ? (
        <Loading label="Loading seat map…" />
      ) : (
        <>
          <SeatLegend />
          <SeatGrid seats={seats} selected={selected} onToggle={toggle} />
        </>
      )}

      <Card style={{ marginTop: 16 }}>
        <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ color: colors.subtext }}>Seats ({selected.length})</Text>
          <Text style={{ fontWeight: '700', color: colors.text }}>
            {selected.length ? selected.join(', ') : '—'}
          </Text>
        </Row>
        <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ color: colors.subtext }}>Service fee</Text>
          <Text style={{ fontWeight: '700', color: colors.text }}>৳{selected.length ? SERVICE_FEE : 0}</Text>
        </Row>
        <Row style={{ justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 4 }}>
          <Text style={{ fontWeight: '800', color: colors.text }}>Total</Text>
          <Text style={{ fontWeight: '900', fontSize: 18, color: colors.primary }}>৳{total}</Text>
        </Row>
        <Button
          title="Continue"
          disabled={selected.length === 0}
          onPress={() =>
            navigation.navigate('Passenger', {
              mode: 'direct',
              trip,
              seats: selected,
              origin,
              destination,
              date,
            })
          }
          style={{ marginTop: 12 }}
        />
        <Text style={{ fontSize: 11, color: colors.faint, textAlign: 'center', marginTop: 8 }}>
          Seats are held for 10 minutes once you continue to payment.
        </Text>
      </Card>
    </ScrollView>
  );
}
