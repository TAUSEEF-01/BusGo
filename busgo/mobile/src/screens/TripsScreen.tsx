import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { Badge, Card, Empty, Loading, Row } from '../components/ui';
import { colors } from '../theme';

type Seg = 'bookings' | 'tickets';

export default function TripsScreen() {
  const [seg, setSeg] = useState<Seg>('bookings');
  const [bookings, setBookings] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const b = api.get('/api/bookings/my?limit=50').then((r) => r.data || []).catch(() => []);
    const t = api.get('/api/tickets/my').then((r) => r.data || []).catch(() => []);
    const [bv, tv] = await Promise.all([b, t]);
    setBookings(bv);
    setTickets(tv);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const statusTone = (s: string): 'success' | 'info' | 'warn' | 'neutral' => {
    if (s === 'CONFIRMED' || s === 'ACTIVE') return 'success';
    if (s === 'SEAT_LOCKED' || s === 'PAYMENT_PENDING') return 'warn';
    if (s === 'CANCELLED' || s === 'EXPIRED' || s === 'REFUNDED') return 'neutral';
    return 'info';
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Segmented control */}
      <View style={styles.segWrap}>
        {(['bookings', 'tickets'] as Seg[]).map((s) => (
          <Pressable
            key={s}
            onPress={() => setSeg(s)}
            style={[styles.segBtn, seg === s && styles.segActive]}
          >
            <Text style={{ fontWeight: '800', fontSize: 13, color: seg === s ? '#fff' : colors.subtext }}>
              {s === 'bookings' ? `Bookings (${bookings.length})` : `Tickets (${tickets.length})`}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        {loading && <Loading label="Loading your trips…" />}

        {!loading && seg === 'bookings' && bookings.length === 0 && (
          <Empty title="No bookings yet" subtitle="Search a route on Home and book your first trip." />
        )}
        {!loading &&
          seg === 'bookings' &&
          bookings.map((b) => (
            <Card key={b.id} style={{ marginBottom: 12 }}>
              <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontWeight: '800', color: colors.text, flex: 1 }}>
                  {b.origin_city || b.boarding_point} → {b.destination_city || b.dropping_point}
                </Text>
                <Badge tone={statusTone(b.status)} text={String(b.status)} />
              </Row>
              <Row style={{ gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                {b.journey_id && <Badge tone="primary" text={`Transit leg ${b.leg_number}`} />}
                <Badge tone="neutral" text={`Seats ${(b.seat_numbers || []).join(', ')}`} />
              </Row>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, color: colors.subtext }}>
                  {b.operator_name || 'Operator'} · {b.journey_date}
                </Text>
                <Text style={{ fontWeight: '800', color: colors.text }}>৳{b.total_fare}</Text>
              </Row>
            </Card>
          ))}

        {!loading && seg === 'tickets' && tickets.length === 0 && (
          <Empty title="No tickets yet" subtitle="Tickets appear here after payment — one per bus." />
        )}
        {!loading &&
          seg === 'tickets' &&
          tickets.map((t) => (
            <Card key={t.id} style={{ marginBottom: 12 }}>
              <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontWeight: '800', color: colors.text }}>
                  🎟️ Ticket {String(t.id).slice(0, 8).toUpperCase()}
                </Text>
                <Badge tone={statusTone(t.status)} text={String(t.status)} />
              </Row>
              <Text style={{ fontSize: 12, color: colors.subtext, marginBottom: 4 }}>
                Seats {(t.seat_numbers || []).join(', ')} · booking {String(t.booking_id).slice(0, 8)}
              </Text>
              <Text style={{ fontSize: 11, color: colors.faint }}>
                Issued {t.issued_at ? new Date(t.issued_at).toLocaleString() : ''}
              </Text>
            </Card>
          ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  segWrap: {
    flexDirection: 'row',
    margin: 16,
    marginBottom: 0,
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  segActive: { backgroundColor: colors.primary },
});
