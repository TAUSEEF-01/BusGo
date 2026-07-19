import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { useAuth } from '../store/auth';
import { Button, Card, Row } from '../components/ui';
import { colors } from '../theme';
import { money } from '../utils/format';
import { Passenger } from '../types/api';
import { ScreenProps } from '../nav';
import { GuestAccess } from '../components/GuestAccess';

const SERVICE_FEE = 20;

function idempotencyKey(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

/**
 * Web parity: the website never asks per-passenger details — it books every
 * seat under the account holder's name with default demographics. This screen
 * therefore holds the seats automatically and moves straight to payment; it
 * only renders while the hold is in flight (or if it fails).
 */
export default function PassengerScreen({ route, navigation }: ScreenProps<'Passenger'>) {
  const params = route.params;
  const { user } = useAuth();
  const passengerSeats = params.mode === 'direct' ? (params.seats || []) : (params.seatsByLeg?.[0] || []);
  const [error, setError] = useState('');
  const submitted = useRef(false);

  const summary = useMemo(() => {
    if (params.mode === 'direct') {
      const fare = passengerSeats.length * Number(params.trip?.fare_amount || 0);
      if (params.outbound) {
        return {
          lines: [
            { label: `Outbound · seats ${params.outbound.seats.join(', ')} (incl. fee)`, amount: params.outbound.total },
            { label: `Return · seats ${passengerSeats.join(', ')}`, amount: fare },
            { label: 'Service fee (return)', amount: SERVICE_FEE },
          ],
          total: params.outbound.total + fare + SERVICE_FEE,
        };
      }
      return {
        lines: [
          { label: `${params.origin} → ${params.destination} · seats ${passengerSeats.join(', ')}`, amount: fare },
          { label: 'Service fee', amount: SERVICE_FEE },
        ],
        total: fare + SERVICE_FEE,
      };
    }
    const legs = params.itinerary?.legs || [];
    const selected = params.seatsByLeg || [];
    const lines = legs.map((leg, index) => ({ label: `Bus ${index + 1}: ${leg.origin_city} → ${leg.destination_city} · ${selected[index]?.join(', ')}`, amount: Number(leg.fare_amount) * (selected[index]?.length || 0) }));
    const gross = lines.reduce((sum, line) => sum + line.amount, 0);
    const baseFare = Number(params.itinerary?.total_fare || 0);
    const discountRate = baseFare ? Number(params.itinerary?.operator_discount_amount || 0) / baseFare : 0;
    const discount = Math.round(gross * discountRate * 100) / 100;
    return { lines, total: Math.max(0, gross - discount) };
  }, [params, passengerSeats]);

  const holdSeats = async () => {
    setError('');
    // Same defaults the web checkout submits for every seat.
    const details: Passenger[] = passengerSeats.map((seat) => ({
      name: user?.full_name?.trim() || 'BusGo Traveller',
      age: 30,
      gender: 'male',
      seat,
    }));
    try {
      if (params.mode === 'direct' && params.outbound) {
        // Round trip: outbound booking first, then the return booking; the
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
        navigation.replace('Payment', {
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
        navigation.replace('Payment', { mode: 'direct', bookingId: response.data.booking_id, tripId, amount: Number(response.data.total_fare ?? summary.total), expiresAt: response.data.expires_at, origin: params.origin, destination: params.destination });
      } else {
        const itinerary = params.itinerary!;
        const selected = params.seatsByLeg || [];
        const legs = itinerary.legs.map((leg, index) => ({ trip_id: leg.trip_id, operator_id: leg.operator_id, seat_numbers: selected[index] || [], boarding_point: leg.origin_city, dropping_point: leg.destination_city, journey_date: String(leg.departure_datetime).slice(0, 10), departure_time: String(leg.departure_datetime).slice(11, 19) || '08:00:00', fare: Number(leg.fare_amount) * (selected[index]?.length || 0) }));
        const gross = legs.reduce((sum, leg) => sum + leg.fare, 0);
        const response = await api.post('/api/bookings/journeys/', { origin: params.origin, destination: params.destination, legs, passenger_details: details, total_fare: gross, transit_route_id: itinerary.transit_route_id || undefined, idempotency_key: idempotencyKey() });
        navigation.replace('Payment', { mode: 'transit', bookingId: response.data.booking_ids[0], tripId: itinerary.legs[0].trip_id, journeyId: response.data.journey_id, amount: Number(response.data.final_fare), expiresAt: response.data.expires_at, legs: response.data.legs, origin: params.origin, destination: params.destination });
      }
    } catch (reason: any) {
      submitted.current = false;
      setError(reason.message || 'Please refresh the seats and try again.');
    }
  };

  // Hold the seats as soon as the user is signed in with a phone number.
  useEffect(() => {
    if (!user || !user.phone?.trim() || submitted.current) return;
    submitted.current = true;
    holdSeats();
  }, [user]);

  if (!user) return <GuestAccess title="Log in to buy tickets" message="Your route and selected seats are ready. Sign in with Google to continue checkout." resumeCheckout={params} />;
  if (!user.phone?.trim()) return <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: colors.bg }}><Card><Text style={{ fontSize: 19, fontWeight: '900', color: colors.text }}>Add your phone number</Text><Text style={{ color: colors.subtext, lineHeight: 20, marginTop: 7, marginBottom: 16 }}>Google does not share your phone number. Add it once to register your payment wallet and continue checkout.</Text><Button title="Add phone and continue" icon="call-outline" onPress={() => navigation.navigate('PhoneSetup', { resumeCheckout: params })} /></Card></View>;

  return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 16 }}>
    <Card>
      {error ? <>
        <View style={{ alignItems: 'center', marginBottom: 12 }}>
          <View style={{ width: 58, height: 58, borderRadius: 20, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="alert-circle-outline" size={30} color={colors.danger} /></View>
        </View>
        <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text, textAlign: 'center' }}>Could not hold your seats</Text>
        <Text style={{ color: colors.subtext, fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 6, marginBottom: 16 }}>{error}</Text>
        <Button title="Try again" icon="refresh" onPress={() => { submitted.current = true; holdSeats(); }} />
        <Button title="Back to seats" variant="ghost" onPress={() => navigation.goBack()} style={{ marginTop: 6 }} />
      </> : <>
        <View style={{ alignItems: 'center', marginBottom: 14 }}><ActivityIndicator size="large" color={colors.primary} /></View>
        <Text style={{ fontSize: 18, fontWeight: '900', color: colors.text, textAlign: 'center' }}>Holding your seats…</Text>
        <Text style={{ color: colors.subtext, fontSize: 13, textAlign: 'center', marginTop: 5, marginBottom: 16 }}>The server locks the selected seats for 10 minutes while you pay.</Text>
      </>}
      <View style={{ borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: 12, marginTop: 4 }}>
        {summary.lines.map((line, index) => <Row key={index} style={{ justifyContent: 'space-between', marginBottom: 6 }}><Text style={{ color: colors.subtext, fontSize: 12, flex: 1, marginRight: 8 }}>{line.label}</Text><Text style={{ fontWeight: '700', color: colors.text, fontSize: 13 }}>{money(line.amount)}</Text></Row>)}
        <Row style={{ justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: 9 }}><Text style={{ fontWeight: '800', color: colors.text }}>Payable</Text><Text style={{ fontWeight: '900', fontSize: 18, color: colors.primary }}>{money(summary.total)}</Text></Row>
      </View>
    </Card>
  </ScrollView>;
}
