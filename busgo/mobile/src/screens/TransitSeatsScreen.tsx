import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { api } from '../api/client';
import { SeatCell, SeatGrid, SeatLegend, toSeatCells } from '../components/SeatGrid';
import { Button, Card, Loading, Row } from '../components/ui';
import { colors, radius } from '../theme';
import { ScreenProps } from '../nav';

export default function TransitSeatsScreen({ route, navigation }: ScreenProps<'TransitSeats'>) {
  const { itinerary, origin, destination, date } = route.params;
  const legs = itinerary.legs;

  const [passengerCount, setPassengerCount] = useState(1);
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [seats, setSeats] = useState<SeatCell[]>([]);
  const [selectedByLeg, setSelectedByLeg] = useState<string[][]>(legs.map(() => []));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!started) return;
    setLoading(true);
    api
      .get(`/api/inventory/trips/${legs[step].trip_id}/seats?_t=${Date.now()}`)
      .then((r) => setSeats(toSeatCells(r.data || [])))
      .catch(() => setSeats(toSeatCells([])))
      .finally(() => setLoading(false));
  }, [started, step]);

  const selected = selectedByLeg[step];

  const toggle = (id: string) => {
    setSelectedByLeg((prev) => {
      const next = prev.map((a) => [...a]);
      const cur = next[step];
      if (cur.includes(id)) next[step] = cur.filter((s) => s !== id);
      else if (cur.length >= passengerCount) {
        Alert.alert('Seat limit', `Select exactly ${passengerCount} seat(s) on each bus.`);
        return prev;
      } else next[step] = [...cur, id];
      return next;
    });
  };

  const proceed = () => {
    if (selected.length !== passengerCount) {
      Alert.alert('Pick seats', `Select exactly ${passengerCount} seat(s) on this bus.`);
      return;
    }
    if (step < legs.length - 1) setStep(step + 1);
    else
      navigation.navigate('Passenger', {
        mode: 'transit',
        itinerary,
        seatsByLeg: selectedByLeg,
        origin,
        destination,
        date,
      });
  };

  if (!started) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
        <Card>
          <Text style={{ fontWeight: '900', fontSize: 18, color: colors.text, textAlign: 'center' }}>
            How many passengers?
          </Text>
          <Text style={{ color: colors.subtext, fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 18 }}>
            You'll pick the same number of seats on each of the {legs.length} buses.
          </Text>
          <Row style={{ justifyContent: 'center', gap: 12, marginBottom: 20 }}>
            {[1, 2, 3, 4].map((n) => (
              <Pressable
                key={n}
                onPress={() => setPassengerCount(n)}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: radius.md,
                  borderWidth: 2,
                  borderColor: passengerCount === n ? colors.primary : colors.border,
                  backgroundColor: passengerCount === n ? colors.primarySoft : '#fff',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontWeight: '900', fontSize: 18, color: passengerCount === n ? colors.primary : colors.text }}>
                  {n}
                </Text>
              </Pressable>
            ))}
          </Row>
          <Button title="Pick seats" onPress={() => setStarted(true)} />
        </Card>
      </ScrollView>
    );
  }

  const leg = legs[step];
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      {/* Leg stepper */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        <Row style={{ gap: 8 }}>
          {legs.map((l, i) => (
            <View
              key={i}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: i === step ? colors.primary : i < step ? colors.successSoft : '#f1f5f9',
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '800', color: i === step ? '#fff' : i < step ? colors.success : colors.subtext }}>
                Bus {i + 1}: {l.origin_city}→{l.destination_city}
              </Text>
            </View>
          ))}
        </Row>
      </ScrollView>

      <Card style={{ marginBottom: 14 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontWeight: '800', color: colors.text }}>
              Bus {step + 1}: {leg.operator_name || 'Operator'}
            </Text>
            <Text style={{ fontSize: 12, color: colors.subtext }}>
              {leg.origin_city} → {leg.destination_city} · ৳{leg.fare_amount}/seat
            </Text>
          </View>
          <Text style={{ fontWeight: '800', color: colors.primary }}>
            {selected.length}/{passengerCount}
          </Text>
        </Row>
      </Card>

      {loading ? (
        <Loading label="Loading seat map…" />
      ) : (
        <>
          <SeatLegend />
          <SeatGrid seats={seats} selected={selected} onToggle={toggle} />
        </>
      )}

      <Row style={{ gap: 10, marginTop: 16 }}>
        <Button
          title="Back"
          variant="outline"
          onPress={() => (step > 0 ? setStep(step - 1) : setStarted(false))}
          style={{ flex: 1 }}
        />
        <Button
          title={step < legs.length - 1 ? 'Next bus' : 'Continue'}
          disabled={selected.length !== passengerCount}
          onPress={proceed}
          style={{ flex: 2 }}
        />
      </Row>
      <Text style={{ fontSize: 11, color: colors.faint, textAlign: 'center', marginTop: 10 }}>
        All buses are booked together — if any leg is unavailable, nothing is booked.
      </Text>
    </ScrollView>
  );
}
