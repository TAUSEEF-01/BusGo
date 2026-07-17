import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { api } from '../api/client';
import { Button, Card, Input, Row } from '../components/ui';
import { colors } from '../theme';
import { ScreenProps } from '../nav';

const SERVICE_FEE = 20;

function uuid(): string {
  // RFC4122-ish v4, good enough for idempotency keys.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function PassengerScreen({ route, navigation }: ScreenProps<'Passenger'>) {
  const p = route.params;
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const summary = useMemo(() => {
    if (p.mode === 'direct') {
      const seats = p.seats || [];
      const fare = Number(p.trip?.fare_amount || 0);
      const total = seats.length * fare + SERVICE_FEE;
      return { lines: [{ label: `${p.origin} → ${p.destination} · seats ${seats.join(', ')}`, amount: total }], total };
    }
    const legs = p.itinerary?.legs || [];
    const seatsByLeg = p.seatsByLeg || [];
    const lines = legs.map((l, i) => ({
      label: `Bus ${i + 1}: ${l.origin_city} → ${l.destination_city} · seats ${(seatsByLeg[i] || []).join(', ')}`,
      amount: Number(l.fare_amount) * (seatsByLeg[i]?.length || 0),
    }));
    return { lines, total: lines.reduce((s, l) => s + l.amount, 0) };
  }, [p]);

  const submit = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Enter the lead passenger name.');
      return;
    }
    setBusy(true);
    try {
      if (p.mode === 'direct') {
        const trip = p.trip!;
        const tripId = (trip.trip_id || trip.id) as string;
        const seats = p.seats || [];
        const body = {
          trip_id: tripId,
          operator_id: trip.operator_id,
          operator_name: trip.operator_name || 'Operator',
          seat_numbers: seats,
          passenger_details: seats.map((seat) => ({ name: name.trim(), age: 30, gender: 'male', seat })),
          boarding_point: p.origin,
          dropping_point: p.destination,
          journey_date: p.date,
          departure_time: String(trip.departure_datetime).slice(11, 19) || '08:00:00',
          total_fare: summary.total,
          idempotency_key: uuid(),
        };
        const res = await api.post('/api/bookings/', body);
        const d = res.data;
        navigation.navigate('Payment', {
          mode: 'direct',
          bookingId: d.booking_id,
          tripId,
          amount: Number(d.total_fare ?? summary.total),
          origin: p.origin,
          destination: p.destination,
        });
      } else {
        const it = p.itinerary!;
        const seatsByLeg = p.seatsByLeg || [];
        const legs = it.legs.map((l, i) => ({
          trip_id: l.trip_id,
          operator_id: l.operator_id,
          seat_numbers: seatsByLeg[i] || [],
          boarding_point: l.origin_city,
          dropping_point: l.destination_city,
          journey_date: String(l.departure_datetime).slice(0, 10),
          departure_time: String(l.departure_datetime).slice(11, 19) || '08:00:00',
          fare: Number(l.fare_amount) * (seatsByLeg[i]?.length || 0),
        }));
        const body = {
          origin: p.origin,
          destination: p.destination,
          legs,
          passenger_details: (seatsByLeg[0] || []).map((seat) => ({ name: name.trim(), age: 30, gender: 'male', seat })),
          total_fare: summary.total,
          transit_route_id: it.transit_route_id || undefined,
          idempotency_key: uuid(),
        };
        const res = await api.post('/api/bookings/journeys/', body);
        const d = res.data;
        navigation.navigate('Payment', {
          mode: 'transit',
          bookingId: d.booking_ids[0],
          tripId: it.legs[0].trip_id,
          journeyId: d.journey_id,
          amount: Number(d.final_fare),
          legs: d.legs,
          origin: p.origin,
          destination: p.destination,
        });
      }
    } catch (e: any) {
      Alert.alert('Could not hold seats', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Card style={{ marginBottom: 14 }}>
        <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text, marginBottom: 4 }}>
          Passenger details
        </Text>
        <Text style={{ color: colors.subtext, fontSize: 12, marginBottom: 14 }}>
          {p.mode === 'transit' ? 'One name for all buses in this journey.' : 'Lead passenger for this booking.'}
        </Text>
        <Input label="Full name" value={name} onChangeText={setName} placeholder="As per NID" />
      </Card>

      <Card>
        <Text style={{ fontWeight: '800', color: colors.text, marginBottom: 10 }}>Summary</Text>
        {summary.lines.map((l, i) => (
          <Row key={i} style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ color: colors.subtext, fontSize: 12, flex: 1, marginRight: 8 }}>{l.label}</Text>
            <Text style={{ fontWeight: '700', color: colors.text }}>৳{l.amount}</Text>
          </Row>
        ))}
        {p.mode === 'direct' && (
          <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ color: colors.subtext, fontSize: 12 }}>Includes ৳{SERVICE_FEE} service fee</Text>
          </Row>
        )}
        <Row style={{ justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }}>
          <Text style={{ fontWeight: '800', color: colors.text }}>Total</Text>
          <Text style={{ fontWeight: '900', fontSize: 18, color: colors.primary }}>৳{summary.total}</Text>
        </Row>
        <Button title={busy ? 'Holding seats…' : 'Hold seats & continue'} onPress={submit} loading={busy} style={{ marginTop: 12 }} />
        <Text style={{ fontSize: 11, color: colors.faint, textAlign: 'center', marginTop: 8 }}>
          {p.mode === 'transit'
            ? 'All buses are locked together (all-or-nothing) and held for 10 minutes.'
            : 'Seats are held for 10 minutes while you pay.'}
        </Text>
      </Card>
    </ScrollView>
  );
}
