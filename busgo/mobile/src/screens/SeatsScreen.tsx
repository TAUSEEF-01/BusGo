import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { SeatCell, SeatGrid, SeatLegend, toSeatCells } from '../components/SeatGrid';
import { Badge, Button, Card, ErrorState, Loading, OperatorLogo, Row, TripTimeline } from '../components/ui';
import { colors } from '../theme';
import { busDisplayName, durationBetween, money, shortDate, shortTime } from '../utils/format';
import { ScreenProps } from '../nav';
import { useAuth } from '../store/auth';

const MAX_SEATS = 4;
const SERVICE_FEE = 20;

export default function SeatsScreen({ route, navigation }: ScreenProps<'Seats'>) {
  const { trip, origin, destination, date, returnDate, isReturnLeg, outbound } = route.params;
  const isOutboundLeg = !!returnDate && !isReturnLeg;
  const { user } = useAuth();
  const tripId = (trip.trip_id || trip.id) as string;
  const [seats, setSeats] = useState<SeatCell[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const boardingPoints = trip.boarding_points?.length ? trip.boarding_points : [{ name: origin }];
  const droppingPoints = trip.dropping_points?.length ? trip.dropping_points : [{ name: destination }];
  const [boardingPoint, setBoardingPoint] = useState(boardingPoints[0].name);
  const [droppingPoint, setDroppingPoint] = useState(droppingPoints[0].name);
  const [selecting, setSelecting] = useState<'boarding' | 'dropping' | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await api.get(`/api/inventory/trips/${tripId}/seats?_t=${Date.now()}`);
      if (!Array.isArray(response.data) || !response.data.length) throw new Error('The operator has not published a seat layout for this bus.');
      const next = toSeatCells(response.data);
      setSeats(next);
      setSelected((current) => current.filter((id) => next.some((seat) => seat.id === id && !seat.taken)));
    } catch (reason: any) { setError(reason.message || 'Could not load the current seat map.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [tripId]);

  useEffect(() => { load(); }, [load]);
  const toggle = (id: string) => setSelected((current) => {
    if (current.includes(id)) return current.filter((seat) => seat !== id);
    if (current.length >= MAX_SEATS) { Alert.alert('Seat limit', `You can book up to ${MAX_SEATS} seats at once.`); return current; }
    return [...current, id];
  });
  const seatFare = selected.length * Number(trip.fare_amount);
  const total = seatFare + (selected.length ? SERVICE_FEE : 0);
  const passengerParams = { mode: 'direct' as const, trip, seats: selected, boardingPoint, droppingPoint, origin, destination, date, outbound: isReturnLeg ? outbound : undefined };
  const continueToCheckout = () => {
    if (isReturnLeg && outbound && selected.length !== outbound.seats.length) {
      return Alert.alert('Match your outbound seats', `Select exactly ${outbound.seats.length} return seat${outbound.seats.length > 1 ? 's' : ''} — the same passengers travel both ways.`);
    }
    if (isOutboundLeg) {
      // Round trip step 1 → pick the return bus next; login happens at checkout.
      return navigation.navigate('Results', {
        origin: destination,
        destination: origin,
        date: returnDate!,
        isReturnLeg: true,
        outbound: { trip, seats: selected, boardingPoint, droppingPoint, date, total },
      });
    }
    if (user) return navigation.navigate('Passenger', passengerParams);
    Alert.alert(
      'Account required for checkout',
      'You can browse BusGo without an account. Log in or create an account to enter passenger details and buy these tickets.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Create account', onPress: () => navigation.navigate('Register', { resumeCheckout: passengerParams }) },
        { text: 'Log in', onPress: () => navigation.navigate('Login', { resumeCheckout: passengerParams }) },
      ],
    );
  };

  return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 30 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
    {/* Trip summary */}
    <Card style={{ marginBottom: 14 }}>
      <Row style={{ gap: 11, marginBottom: 12 }}>
        <OperatorLogo name={trip.operator_name || 'Bus operator'} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '800', fontSize: 15, color: colors.text }} numberOfLines={1}>{trip.operator_name || 'Bus operator'}</Text>
          <Row style={{ gap: 4, marginTop: 2 }}>
            <Ionicons name="bus-outline" size={12} color={colors.primary} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }} numberOfLines={1}>{busDisplayName(trip)}</Text>
          </Row>
        </View>
        {trip.bus_type ? <Badge tone="neutral" text={trip.bus_type} /> : null}
      </Row>
      <TripTimeline
        depTime={shortTime(trip.departure_datetime)} depCity={origin} depSub={shortDate(date)}
        arrTime={shortTime(trip.arrival_datetime)} arrCity={destination}
        centerLabel={durationBetween(trip.departure_datetime, trip.arrival_datetime) || `${money(trip.fare_amount)}/seat`}
      />
    </Card>

    {loading ? <Loading label="Loading live seat map…" /> : error ? <ErrorState title="Seat map unavailable" message={error} onRetry={() => { setLoading(true); load(); }} /> : <><SeatLegend /><SeatGrid seats={seats} selected={selected} onToggle={toggle} /></>}

    {!loading && !error ? <Card style={{ marginTop: 16 }}>
      <Text style={{ fontWeight: '800', color: colors.text, marginBottom: 8 }}>Pickup and drop-off</Text>
      <Pressable onPress={() => setSelecting('boarding')} style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 8, backgroundColor: '#fff' }}>
        <Text style={{ color: colors.faint, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 }}>BOARDING POINT</Text>
        <Row style={{ justifyContent: 'space-between', marginTop: 3 }}><Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>{boardingPoint}</Text><Ionicons name="chevron-down" size={18} color={colors.subtext} /></Row>
      </Pressable>
      <Pressable onPress={() => setSelecting('dropping')} style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, padding: 12, marginBottom: 14, backgroundColor: '#fff' }}>
        <Text style={{ color: colors.faint, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 }}>DROPPING POINT</Text>
        <Row style={{ justifyContent: 'space-between', marginTop: 3 }}><Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>{droppingPoint}</Text><Ionicons name="chevron-down" size={18} color={colors.subtext} /></Row>
      </Pressable>
      <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ color: colors.subtext }}>Selected seats</Text>
        <Row style={{ gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end', flex: 1, marginLeft: 12 }}>
          {selected.length ? selected.map((seat) => <Badge key={seat} tone="primary" text={seat} />) : <Text style={{ fontWeight: '700', color: colors.faint }}>None</Text>}
        </Row>
      </Row>
      <Row style={{ justifyContent: 'space-between', marginBottom: 5 }}><Text style={{ color: colors.subtext }}>Seat fare</Text><Text style={{ fontWeight: '700', color: colors.text }}>{money(seatFare)}</Text></Row>
      <Row style={{ justifyContent: 'space-between', marginBottom: 5 }}><Text style={{ color: colors.subtext }}>Service fee</Text><Text style={{ fontWeight: '700', color: colors.text }}>{money(selected.length ? SERVICE_FEE : 0)}</Text></Row>
      <Row style={{ justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: 9 }}><Text style={{ fontWeight: '800', color: colors.text }}>Total</Text><Text style={{ fontWeight: '900', fontSize: 18, color: colors.primary }}>{money(total)}</Text></Row>
      {isReturnLeg && outbound ? <Row style={{ gap: 6, marginTop: 10, marginBottom: 2, backgroundColor: colors.infoSoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 }}><Ionicons name="information-circle-outline" size={15} color={colors.info} /><Text style={{ flex: 1, fontSize: 11, color: colors.info, fontWeight: '600' }}>Return leg: select exactly {outbound.seats.length} seat{outbound.seats.length > 1 ? 's' : ''} to match your outbound passengers.</Text></Row> : null}
      <Button
        title={!selected.length ? 'Select seats to continue'
          : isOutboundLeg ? `Continue to return bus (${selected.length} seat${selected.length > 1 ? 's' : ''})`
          : isReturnLeg ? `Continue with round trip` : `Continue with ${selected.length} seat${selected.length > 1 ? 's' : ''}`}
        icon="arrow-forward"
        disabled={!selected.length || (!!isReturnLeg && !!outbound && selected.length !== outbound.seats.length)}
        onPress={continueToCheckout}
        style={{ marginTop: 12 }}
      />
      <Text style={{ fontSize: 11, color: colors.faint, textAlign: 'center', marginTop: 8 }}>Seats are checked again and held when you continue to payment.</Text>
    </Card> : null}

    <Modal visible={!!selecting} transparent animationType="fade" onRequestClose={() => setSelecting(null)}><Pressable onPress={() => setSelecting(null)} style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' }}><Pressable onPress={() => {}} style={{ backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, maxHeight: '70%' }}><Row style={{ justifyContent: 'space-between', marginBottom: 12 }}><Text style={{ fontSize: 18, fontWeight: '900', color: colors.text }}>Select {selecting === 'boarding' ? 'boarding' : 'dropping'} point</Text><Pressable onPress={() => setSelecting(null)}><Ionicons name="close" size={24} color={colors.text} /></Pressable></Row><ScrollView>{(selecting === 'boarding' ? boardingPoints : droppingPoints).map((point, index) => <Pressable key={`${point.name}-${index}`} onPress={() => { if (selecting === 'boarding') setBoardingPoint(point.name); else setDroppingPoint(point.name); setSelecting(null); }} style={{ paddingVertical: 13, borderBottomWidth: index === (selecting === 'boarding' ? boardingPoints : droppingPoints).length - 1 ? 0 : 1, borderBottomColor: colors.borderSoft }}><Text style={{ color: colors.text, fontWeight: '800' }}>{point.name}</Text>{point.address ? <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 2 }}>{point.address}</Text> : null}</Pressable>)}</ScrollView></Pressable></Pressable></Modal>
  </ScrollView>;
}
