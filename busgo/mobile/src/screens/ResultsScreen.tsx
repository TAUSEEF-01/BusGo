import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../api/client';
import { Badge, Button, Card, Empty, Loading, Row } from '../components/ui';
import { colors } from '../theme';
import { DirectTrip, Itinerary, ScreenProps } from '../nav';

function timeOf(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export default function ResultsScreen({ route, navigation }: ScreenProps<'Results'>) {
  const { origin, destination, date } = route.params;
  const [trips, setTrips] = useState<DirectTrip[]>([]);
  const [itins, setItins] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const direct = api
        .get(`/api/operators/trips/?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&date=${date}T00:00:00`)
        .then((r) => (r.data || []) as DirectTrip[])
        .catch(() => [] as DirectTrip[]);
      const transit = api
        .get(`/api/transit/search?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&journey_date=${date}`)
        .then((r) => ((r.data?.itineraries || []) as Itinerary[]).filter((it) => it.leg_count > 1))
        .catch(() => [] as Itinerary[]);
      const [d, t] = await Promise.all([direct, transit]);
      setTrips(d);
      setItins(t);
      setLoading(false);
    })();
  }, [origin, destination, date]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.routeTitle}>
        {origin} → {destination}
      </Text>
      <Text style={{ color: colors.subtext, marginBottom: 14 }}>{date}</Text>

      {loading && <Loading label="Searching direct buses and connections…" />}

      {!loading && trips.length === 0 && itins.length === 0 && (
        <Empty title="No buses found" subtitle="Try a different date, or another route." />
      )}

      {/* Connecting journeys */}
      {!loading && itins.length > 0 && (
        <>
          {trips.length === 0 && (
            <Card style={{ backgroundColor: colors.infoSoft, borderColor: '#bfdbfe', marginBottom: 12 }}>
              <Text style={{ color: colors.info, fontSize: 13, fontWeight: '600' }}>
                No direct bus — here are connecting options where you change buses along the way.
              </Text>
            </Card>
          )}
          <Text style={styles.section}>🔀 Connecting journeys</Text>
          {itins.map((it) => (
            <Card key={it.itinerary_id} style={{ marginBottom: 12 }}>
              {it.source === 'operator' && (
                <View style={{ marginBottom: 8 }}>
                  <Badge tone="primary" text={`★ Operator service — guaranteed connection`} />
                  {it.transit_route_name ? (
                    <Text style={{ fontSize: 11, color: colors.subtext, marginTop: 3 }}>{it.transit_route_name}</Text>
                  ) : null}
                </View>
              )}
              {it.legs.map((leg, i) => (
                <View key={leg.leg_number}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '800', color: colors.text }}>
                        🚌 {leg.origin_city} → {leg.destination_city}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.subtext }}>
                        {leg.bus_registration_no ? `Bus ${i + 1}: ${leg.bus_registration_no}` : (leg.operator_name || 'Operator')} · {timeOf(leg.departure_datetime)}–{timeOf(leg.arrival_datetime)}
                      </Text>
                    </View>
                    <Text style={{ fontWeight: '700', color: colors.text }}>৳{leg.fare_amount}</Text>
                  </Row>
                  {i < it.legs.length - 1 && it.transfers[i] && (
                    <View style={styles.transfer}>
                      <Text style={{ fontSize: 11, color: colors.warn, fontWeight: '700' }}>
                        ⏱ Change at {it.transfers[i].city} · wait {it.transfers[i].wait_minutes} min
                      </Text>
                    </View>
                  )}
                </View>
              ))}
              <Row style={{ justifyContent: 'space-between', marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
                <View>
                  <Row style={{ gap: 6 }}>
                    {it.operator_discount_amount > 0 && (
                      <Text style={{ color: colors.faint, textDecorationLine: 'line-through' }}>৳{it.total_fare}</Text>
                    )}
                    <Text style={{ fontWeight: '900', fontSize: 18, color: colors.primary }}>৳{it.final_fare}</Text>
                  </Row>
                  <Text style={{ fontSize: 11, color: colors.subtext }}>
                    through fare per passenger · {it.leg_count} buses · {Math.floor(it.total_duration_minutes / 60)}h {it.total_duration_minutes % 60}m
                  </Text>
                </View>
                <Button
                  title="Book journey"
                  onPress={() => navigation.navigate('TransitSeats', { itinerary: it, origin, destination, date })}
                  style={{ paddingHorizontal: 18, paddingVertical: 10 }}
                />
              </Row>
            </Card>
          ))}
        </>
      )}

      {/* Direct buses */}
      {!loading && trips.length > 0 && (
        <>
          <Text style={styles.section}>🚌 Direct buses</Text>
          {trips.map((t, i) => {
            const id = (t.trip_id || t.id) as string;
            return (
              <Pressable key={id + i} onPress={() => navigation.navigate('Seats', { trip: t, origin, destination, date })}>
                <Card style={{ marginBottom: 12 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '800', fontSize: 15, color: colors.text }}>
                        {t.operator_name || 'Operator'}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 2 }}>
                        {timeOf(t.departure_datetime)} → {timeOf(t.arrival_datetime)}
                        {t.bus_type ? ` · ${t.bus_type}` : ''}
                      </Text>
                      {typeof t.available_seats === 'number' && (
                        <Text style={{ fontSize: 11, color: colors.success, marginTop: 2 }}>
                          {t.available_seats} seats left
                        </Text>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontWeight: '900', fontSize: 18, color: colors.primary }}>৳{t.fare_amount}</Text>
                      <Text style={{ fontSize: 11, color: colors.faint }}>per seat</Text>
                    </View>
                  </Row>
                </Card>
              </Pressable>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  routeTitle: { fontSize: 22, fontWeight: '900', color: colors.text },
  section: { fontWeight: '800', fontSize: 15, color: colors.text, marginBottom: 10, marginTop: 6 },
  transfer: {
    backgroundColor: colors.warnSoft,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginVertical: 8,
    marginLeft: 18,
  },
});
