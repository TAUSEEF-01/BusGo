import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { api } from '../api/client';
import { useAuth } from '../store/auth';
import { Button, Card, Input, Row } from '../components/ui';
import { colors, radius } from '../theme';
import { money } from '../utils/format';
import { Passenger } from '../types/api';
import { ScreenProps } from '../nav';
import { GuestAccess } from '../components/GuestAccess';

const SERVICE_FEE = 20;
type Draft = { name: string; age: string; gender: 'male' | 'female' | 'other' };

function idempotencyKey(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

export default function PassengerScreen({ route, navigation }: ScreenProps<'Passenger'>) {
  const params = route.params;
  const { user } = useAuth();
  const passengerSeats = params.mode === 'direct' ? (params.seats || []) : (params.seatsByLeg?.[0] || []);
  const [passengers, setPassengers] = useState<Draft[]>(passengerSeats.map((_, index) => ({ name: index === 0 ? user?.full_name || '' : '', age: '', gender: 'male' })));
  const [busy, setBusy] = useState(false);

  const summary = useMemo(() => {
    if (params.mode === 'direct') {
      const fare = passengerSeats.length * Number(params.trip?.fare_amount || 0);
      if (params.outbound) {
        // Round trip: this screen holds the RETURN leg; the outbound total was
        // fixed when its seats were chosen.
        return {
          lines: [
            { label: `Outbound ${params.destination} → ${params.origin} · seats ${params.outbound.seats.join(', ')} (incl. fee)`, amount: params.outbound.total },
            { label: `Return ${params.origin} → ${params.destination} · seats ${passengerSeats.join(', ')}`, amount: fare },
          ],
          total: params.outbound.total + fare + SERVICE_FEE,
          discount: 0,
        };
      }
      return { lines: [{ label: `${params.origin} → ${params.destination} · seats ${passengerSeats.join(', ')}`, amount: fare }], total: fare + SERVICE_FEE, discount: 0 };
    }
    const legs = params.itinerary?.legs || [];
    const selected = params.seatsByLeg || [];
    const lines = legs.map((leg, index) => ({ label: `Bus ${index + 1}: ${leg.origin_city} → ${leg.destination_city} · ${selected[index]?.join(', ')}`, amount: Number(leg.fare_amount) * (selected[index]?.length || 0) }));
    const gross = lines.reduce((sum, line) => sum + line.amount, 0);
    const baseFare = Number(params.itinerary?.total_fare || 0);
    const discountRate = baseFare ? Number(params.itinerary?.operator_discount_amount || 0) / baseFare : 0;
    const discount = Math.round(gross * discountRate * 100) / 100;
    return { lines, total: Math.max(0, gross - discount), discount };
  }, [params, passengerSeats]);

  const update = (index: number, patch: Partial<Draft>) => setPassengers((current) => current.map((passenger, position) => position === index ? { ...passenger, ...patch } : passenger));
  const validate = (): Passenger[] | null => {
    const output: Passenger[] = [];
    for (let index = 0; index < passengers.length; index += 1) {
      const passenger = passengers[index];
      const age = Number(passenger.age);
      if (passenger.name.trim().length < 2) { Alert.alert('Passenger details', `Enter the full name for passenger ${index + 1}.`); return null; }
      if (!Number.isInteger(age) || age < 1 || age > 120) { Alert.alert('Passenger details', `Enter a valid age for passenger ${index + 1}.`); return null; }
      output.push({ name: passenger.name.trim(), age, gender: passenger.gender, seat: passengerSeats[index] });
    }
    return output;
  };

  const submit = async () => {
    const details = validate();
    if (!details) return;
    setBusy(true);
    try {
      if (params.mode === 'direct' && params.outbound) {
        // Round trip: hold the outbound seats, then the return seats. The
        // same passengers travel both ways, remapped to each leg's seats.
        const outbound = params.outbound;
        const outboundTrip = outbound.trip;
        const outboundTripId = (outboundTrip.trip_id || outboundTrip.id) as string;
        const returnTrip = params.trip!;
        const returnTripId = (returnTrip.trip_id || returnTrip.id) as string;
        const returnFare = passengerSeats.length * Number(returnTrip.fare_amount) + SERVICE_FEE;
        const outboundDetails = details.map((person, index) => ({ ...person, seat: outbound.seats[index] }));

        const outboundResponse = await api.post('/api/bookings/', {
          trip_id: outboundTripId, operator_id: outboundTrip.operator_id, operator_name: outboundTrip.operator_name || 'Operator',
          seat_numbers: outbound.seats, passenger_details: outboundDetails, boarding_point: outbound.boardingPoint,
          dropping_point: outbound.droppingPoint, journey_date: outbound.date,
          departure_time: String(outboundTrip.departure_datetime).slice(11, 19) || '08:00:00',
          total_fare: outbound.total, idempotency_key: idempotencyKey(),
        });
        const returnResponse = await api.post('/api/bookings/', {
          trip_id: returnTripId, operator_id: returnTrip.operator_id, operator_name: returnTrip.operator_name || 'Operator',
          seat_numbers: passengerSeats, passenger_details: details, boarding_point: params.boardingPoint || params.origin,
          dropping_point: params.droppingPoint || params.destination, journey_date: params.date,
          departure_time: String(returnTrip.departure_datetime).slice(11, 19) || '08:00:00',
          total_fare: returnFare, idempotency_key: idempotencyKey(),
        });
        navigation.navigate('Payment', {
          mode: 'direct',
          bookingId: outboundResponse.data.booking_id,
          tripId: outboundTripId,
          amount: Number(outboundResponse.data.total_fare ?? outbound.total),
          expiresAt: outboundResponse.data.expires_at,
          origin: outbound.trip.origin_city || params.destination,
          destination: outbound.trip.destination_city || params.origin,
          returnBookingId: returnResponse.data.booking_id,
          returnTripId,
          returnAmount: Number(returnResponse.data.total_fare ?? returnFare),
        });
      } else if (params.mode === 'direct') {
        const trip = params.trip!;
        const tripId = (trip.trip_id || trip.id) as string;
        const response = await api.post('/api/bookings/', {
          trip_id: tripId, operator_id: trip.operator_id, operator_name: trip.operator_name || 'Operator',
          seat_numbers: passengerSeats, passenger_details: details, boarding_point: params.boardingPoint || params.origin,
          dropping_point: params.droppingPoint || params.destination, journey_date: params.date,
          departure_time: String(trip.departure_datetime).slice(11, 19) || '08:00:00',
          total_fare: summary.total, idempotency_key: idempotencyKey(),
        });
        navigation.navigate('Payment', { mode: 'direct', bookingId: response.data.booking_id, tripId, amount: Number(response.data.total_fare ?? summary.total), expiresAt: response.data.expires_at, origin: params.origin, destination: params.destination });
      } else {
        const itinerary = params.itinerary!;
        const selected = params.seatsByLeg || [];
        const legs = itinerary.legs.map((leg, index) => ({ trip_id: leg.trip_id, operator_id: leg.operator_id, seat_numbers: selected[index] || [], boarding_point: leg.origin_city, dropping_point: leg.destination_city, journey_date: String(leg.departure_datetime).slice(0, 10), departure_time: String(leg.departure_datetime).slice(11, 19) || '08:00:00', fare: Number(leg.fare_amount) * (selected[index]?.length || 0) }));
        const gross = legs.reduce((sum, leg) => sum + leg.fare, 0);
        const response = await api.post('/api/bookings/journeys/', { origin: params.origin, destination: params.destination, legs, passenger_details: details, total_fare: gross, transit_route_id: itinerary.transit_route_id || undefined, idempotency_key: idempotencyKey() });
        navigation.navigate('Payment', { mode: 'transit', bookingId: response.data.booking_ids[0], tripId: itinerary.legs[0].trip_id, journeyId: response.data.journey_id, amount: Number(response.data.final_fare), expiresAt: response.data.expires_at, legs: response.data.legs, origin: params.origin, destination: params.destination });
      }
    } catch (error: any) { Alert.alert('Could not hold seats', error.message || 'Please refresh the seats and try again.'); }
    finally { setBusy(false); }
  };

  if (!user) return <GuestAccess title="Log in to buy tickets" message="Your route and selected seats are ready. Log in or create an account to continue checkout." resumeCheckout={params} />;
  if (!user.phone?.trim()) return <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: colors.bg }}><Card><Text style={{ fontSize: 19, fontWeight: '900', color: colors.text }}>Add your phone number</Text><Text style={{ color: colors.subtext, lineHeight: 20, marginTop: 7, marginBottom: 16 }}>Google does not share your phone number. Add it once to register your payment wallet and continue checkout.</Text><Button title="Add phone and continue" icon="call-outline" onPress={() => navigation.navigate('PhoneSetup', { resumeCheckout: params })} /></Card></View>;

  return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
    <Text style={{ fontSize: 13, color: colors.subtext, marginBottom: 12 }}>Enter the person travelling in each selected seat.</Text>
    {passengers.map((passenger, index) => <Card key={passengerSeats[index]} style={{ marginBottom: 12 }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <Row style={{ gap: 9 }}>
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.primary, fontWeight: '900', fontSize: 13 }}>{index + 1}</Text></View>
          <Text style={{ fontWeight: '900', color: colors.text }}>Passenger {index + 1}</Text>
        </Row>
        <View style={{ backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryBorder, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12 }}>Seat {passengerSeats[index]}</Text></View>
      </Row>
      <Input label="Full name" value={passenger.name} onChangeText={(name) => update(index, { name })} placeholder="As shown on identification" autoCapitalize="words" />
      <Input label="Age" value={passenger.age} onChangeText={(age) => update(index, { age: age.replace(/\D/g, '') })} placeholder="Age" keyboardType="number-pad" maxLength={3} />
      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 7 }}>Gender</Text>
      <Row style={{ gap: 8 }}>{(['male', 'female', 'other'] as const).map((gender) => <Pressable key={gender} onPress={() => update(index, { gender })} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md, borderWidth: 1.5, borderColor: passenger.gender === gender ? colors.primary : colors.border, backgroundColor: passenger.gender === gender ? colors.primarySoft : '#fff' }}><Text style={{ textTransform: 'capitalize', fontWeight: '700', color: passenger.gender === gender ? colors.primary : colors.text }}>{gender}</Text></Pressable>)}</Row>
    </Card>)}

    <Card><Text style={{ fontWeight: '900', color: colors.text, marginBottom: 10 }}>Fare summary</Text>{summary.lines.map((line, index) => <Row key={index} style={{ justifyContent: 'space-between', marginBottom: 7 }}><Text style={{ color: colors.subtext, fontSize: 12, flex: 1, marginRight: 8 }}>{line.label}</Text><Text style={{ fontWeight: '700', color: colors.text }}>{money(line.amount)}</Text></Row>)}
      {params.mode === 'direct' ? <Row style={{ justifyContent: 'space-between', marginBottom: 7 }}><Text style={{ color: colors.subtext, fontSize: 12 }}>Service fee</Text><Text style={{ fontWeight: '700', color: colors.text }}>{money(SERVICE_FEE)}</Text></Row> : null}
      {summary.discount > 0 ? <Row style={{ justifyContent: 'space-between', marginBottom: 7 }}><Text style={{ color: colors.success, fontSize: 12 }}>Through-service discount</Text><Text style={{ color: colors.success, fontWeight: '700' }}>−{money(summary.discount)}</Text></Row> : null}
      <Row style={{ justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9 }}><Text style={{ fontWeight: '800', color: colors.text }}>Payable</Text><Text style={{ fontWeight: '900', fontSize: 18, color: colors.primary }}>{money(summary.total)}</Text></Row>
      <Button title="Hold seats and pay" onPress={submit} loading={busy} style={{ marginTop: 12 }} />
      <Text style={{ fontSize: 11, color: colors.faint, textAlign: 'center', marginTop: 8 }}>The server locks all selected seats for 10 minutes. Transit bookings are all-or-nothing.</Text>
    </Card>
  </ScrollView>;
}
