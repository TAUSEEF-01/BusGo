import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { useAuth } from '../store/auth';
import { Badge, Button, Card, Chip, Empty, ErrorState, Input, Loading, Row } from '../components/ui';
import { colors } from '../theme';
import { money, shortDate, shortTime } from '../utils/format';
import type { FillCandidate, Trip } from '../types';

/**
 * The web portal's "fill empty seats" re-marketing tool: pick an
 * under-booked upcoming trip, let booking-service surface passengers who
 * historically travel this route, then send them a discount offer.
 */
export default function FillSeatsScreen() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [candidates, setCandidates] = useState<FillCandidate[]>([]);
  const [occupancy, setOccupancy] = useState<Record<string, any>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [discount, setDiscount] = useState('15');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await api.get(`/api/operators/trips/?operator_id=${user?.id}`);
      const now = Date.now();
      setTrips(((response.data || []) as Trip[])
        .filter((trip) => trip.status === 'SCHEDULED' && new Date(trip.departure_datetime).getTime() > now)
        .sort((a, b) => new Date(a.departure_datetime).getTime() - new Date(b.departure_datetime).getTime()));
    } catch (reason: any) { setError(reason.message || 'Could not load upcoming trips.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pickTrip = async (trip: Trip) => {
    setSelectedTrip(trip); setCandidates([]); setOccupancy({}); setSelected(new Set()); setLoadingCandidates(true);
    try {
      const response = await api.post(`/api/bookings/trips/${trip.id}/interested-passengers`, {
        origin: trip.origin_city, destination: trip.destination_city, operator_id: trip.operator_id || user?.id, limit: 30,
      });
      const list: FillCandidate[] = response.data?.candidates || [];
      setCandidates(list);
      setOccupancy(response.data?.occupancy || {});
      setSelected(new Set(list.map((candidate) => candidate.user_id)));
    } catch (reason: any) { Alert.alert('No candidates', reason.message || 'Could not find likely travellers for this route.'); }
    finally { setLoadingCandidates(false); }
  };

  const toggle = (userId: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(userId)) next.delete(userId); else next.add(userId);
    return next;
  });

  const send = async () => {
    if (!selectedTrip) return;
    if (!selected.size) return Alert.alert('Fill seats', 'Select at least one passenger.');
    const pct = Number(discount);
    if (!pct || pct < 1 || pct > 50) return Alert.alert('Fill seats', 'Discount must be between 1% and 50%.');
    setSending(true);
    try {
      const response = await api.post(`/api/bookings/trips/${selectedTrip.id}/notify-interested`, {
        user_ids: [...selected], origin: selectedTrip.origin_city, destination: selectedTrip.destination_city,
        discount_pct: pct, message: message.trim() || undefined, journey_date: selectedTrip.departure_datetime,
      });
      Alert.alert('Offers sent', `${selected.size} passenger${selected.size > 1 ? 's' : ''} notified${response.data?.promo_code ? ` with promo ${response.data.promo_code}` : ''}.`);
      setSelectedTrip(null); setCandidates([]); setSelected(new Set()); setMessage('');
    } catch (reason: any) { Alert.alert('Could not send offers', reason.message); }
    finally { setSending(false); }
  };

  const occupancyPct = useMemo(() => {
    const total = Number(occupancy.total_seats || 0);
    const bookedCount = Number(occupancy.booked ?? occupancy.booked_seats ?? 0);
    return total ? Math.round((bookedCount / total) * 100) : null;
  }, [occupancy]);

  return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 30 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
    {!selectedTrip ? <>
      <Text style={{ fontSize: 13, color: colors.subtext, marginBottom: 12 }}>Pick an upcoming trip with empty seats. BusGo finds passengers who travel this route and lets you send them a discount offer.</Text>
      {loading ? <Loading label="Loading upcoming trips…" /> : error ? <ErrorState message={error} onRetry={() => { setLoading(true); load(); }} /> : null}
      {!loading && !error && !trips.length ? <Empty title="No upcoming trips" subtitle="Schedule trips first, then fill their seats from here." icon="rocket-outline" /> : null}
      {trips.map((trip) => <Pressable key={trip.id} onPress={() => pickTrip(trip)}>
        <Card style={{ marginBottom: 10 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '900', color: colors.text }}>{trip.origin_city} → {trip.destination_city}</Text>
              <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 2 }}>{shortDate(trip.departure_datetime)} · {shortTime(trip.departure_datetime)} · {money(trip.fare_amount)}/seat</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontWeight: '900', fontSize: 16, color: (trip.available_seats ?? 0) > 15 ? colors.danger : colors.success }}>{trip.available_seats ?? '—'}</Text>
              <Text style={{ fontSize: 10, color: colors.faint }}>seats empty</Text>
            </View>
          </Row>
        </Card>
      </Pressable>)}
    </> : <>
      <Pressable onPress={() => setSelectedTrip(null)} style={{ marginBottom: 10 }}><Row style={{ gap: 5 }}><Ionicons name="arrow-back" size={16} color={colors.primary} /><Text style={{ fontWeight: '800', color: colors.primary }}>All trips</Text></Row></Pressable>
      <Card style={{ marginBottom: 12 }}>
        <Text style={{ fontWeight: '900', color: colors.text }}>{selectedTrip.origin_city} → {selectedTrip.destination_city}</Text>
        <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 2 }}>{shortDate(selectedTrip.departure_datetime)} · {shortTime(selectedTrip.departure_datetime)}</Text>
        {occupancyPct != null ? <View style={{ marginTop: 9 }}>
          <View style={{ height: 8, backgroundColor: colors.borderSoft, borderRadius: 4 }}><View style={{ height: 8, width: `${occupancyPct}%`, backgroundColor: occupancyPct < 40 ? colors.danger : occupancyPct < 70 ? colors.accent : colors.success, borderRadius: 4 }} /></View>
          <Text style={{ fontSize: 11, color: colors.subtext, marginTop: 4 }}>{occupancyPct}% booked</Text>
        </View> : null}
      </Card>

      {loadingCandidates ? <Loading label="Finding likely travellers…" /> : <>
        <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontWeight: '900', color: colors.text }}>Candidates ({selected.size}/{candidates.length} selected)</Text>
          {candidates.length ? <Pressable onPress={() => setSelected(selected.size === candidates.length ? new Set() : new Set(candidates.map((candidate) => candidate.user_id)))}><Text style={{ fontSize: 12, fontWeight: '800', color: colors.primary }}>{selected.size === candidates.length ? 'Clear all' : 'Select all'}</Text></Pressable> : null}
        </Row>
        {!candidates.length ? <Empty title="No candidates found" subtitle="No past travellers match this route yet." icon="people-outline" /> : candidates.map((candidate) => <Pressable key={candidate.user_id} onPress={() => toggle(candidate.user_id)}>
          <Card style={{ marginBottom: 8, borderColor: selected.has(candidate.user_id) ? colors.primary : colors.border }}>
            <Row style={{ gap: 10 }}>
              <Ionicons name={selected.has(candidate.user_id) ? 'checkbox' : 'square-outline'} size={22} color={selected.has(candidate.user_id) ? colors.primary : colors.faint} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', color: colors.text }} numberOfLines={1}>{candidate.full_name || candidate.email || candidate.user_id.slice(0, 8)}</Text>
                <Text style={{ fontSize: 11, color: colors.subtext }}>{candidate.trips_on_route ?? 0} past trips on this route{candidate.last_travelled ? ` · last ${shortDate(candidate.last_travelled)}` : ''}</Text>
              </View>
              {typeof candidate.score === 'number' ? <Badge tone="info" text={`score ${Math.round(candidate.score)}`} /> : null}
            </Row>
          </Card>
        </Pressable>)}

        {candidates.length ? <Card style={{ marginTop: 8 }}>
          <Text style={{ fontWeight: '900', color: colors.text, marginBottom: 8 }}>Offer</Text>
          <Row style={{ gap: 7, marginBottom: 10 }}>
            {['10', '15', '20', '30'].map((pct) => <Chip key={pct} label={`${pct}%`} active={discount === pct} onPress={() => setDiscount(pct)} />)}
          </Row>
          <Input label="Custom discount (%)" value={discount} onChangeText={(value) => setDiscount(value.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={2} />
          <Input label="Message (optional)" value={message} onChangeText={setMessage} placeholder="Leave blank for an auto-written message" />
          <Button title={`Send offer to ${selected.size} passenger${selected.size === 1 ? '' : 's'}`} icon="paper-plane-outline" onPress={send} loading={sending} disabled={!selected.size} />
        </Card> : null}
      </>}
    </>}
  </ScrollView>;
}

const styles = StyleSheet.create({});
