import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { useAuth } from '../store/auth';
import { Card, Chip, Empty, ErrorState, Loading, Row, SectionTitle } from '../components/ui';
import { colors } from '../theme';
import { money } from '../utils/format';
import type { OperatorBooking } from '../types';

type Window = 7 | 14 | 30;

export default function AnalyticsScreen() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<OperatorBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [windowDays, setWindowDays] = useState<Window>(14);

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await api.get(`/api/bookings/operator/${user?.id}?limit=1000`);
      setBookings(response.data || []);
    } catch (reason: any) { setError(reason.message || 'Could not load analytics.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const confirmed = useMemo(() => bookings.filter((booking) => ['CONFIRMED', 'COMPLETED'].includes(booking.status.toUpperCase())), [bookings]);
  const cancelled = useMemo(() => bookings.filter((booking) => ['CANCELLED', 'REFUNDED'].includes(booking.status.toUpperCase())), [bookings]);

  // Revenue + bookings per day over the selected window.
  const series = useMemo(() => {
    const days: { key: string; label: string; revenue: number; count: number }[] = [];
    for (let offset = windowDays - 1; offset >= 0; offset -= 1) {
      const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - offset);
      days.push({ key: date.toDateString(), label: date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), revenue: 0, count: 0 });
    }
    const index = new Map(days.map((day) => [day.key, day]));
    for (const booking of confirmed) {
      const day = index.get(new Date(booking.created_at).toDateString());
      if (day) { day.revenue += Number(booking.total_fare); day.count += 1; }
    }
    return days;
  }, [confirmed, windowDays]);
  const maxRevenue = Math.max(...series.map((day) => day.revenue), 1);
  const windowRevenue = series.reduce((sum, day) => sum + day.revenue, 0);
  const windowCount = series.reduce((sum, day) => sum + day.count, 0);

  // Top routes by confirmed revenue.
  const topRoutes = useMemo(() => {
    const byRoute = new Map<string, { revenue: number; count: number; seats: number }>();
    for (const booking of confirmed) {
      const key = `${booking.origin_city || booking.boarding_point} → ${booking.destination_city || booking.dropping_point}`;
      const entry = byRoute.get(key) || { revenue: 0, count: 0, seats: 0 };
      entry.revenue += Number(booking.total_fare); entry.count += 1; entry.seats += booking.seat_numbers.length;
      byRoute.set(key, entry);
    }
    return [...byRoute.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5);
  }, [confirmed]);
  const maxRouteRevenue = Math.max(...topRoutes.map(([, entry]) => entry.revenue), 1);

  const totalRevenue = confirmed.reduce((sum, booking) => sum + Number(booking.total_fare), 0);

  return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 30 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
    {loading ? <Loading label="Crunching your numbers…" /> : error ? <ErrorState message={error} onRetry={() => { setLoading(true); load(); }} /> : <>
      {/* Lifetime tiles */}
      <Row style={{ gap: 10, marginBottom: 10 }}>
        <View style={[styles.tile, { backgroundColor: colors.primary, borderColor: colors.primaryDark }]}>
          <Text style={[styles.tileNum, { color: '#fff' }]}>{money(totalRevenue)}</Text>
          <Text style={[styles.tileLabel, { color: '#fecaca' }]}>Lifetime revenue</Text>
        </View>
        <View style={styles.tile}><Text style={styles.tileNum}>{confirmed.length}</Text><Text style={styles.tileLabel}>Confirmed</Text></View>
      </Row>
      <Row style={{ gap: 10, marginBottom: 16 }}>
        <View style={styles.tile}><Text style={styles.tileNum}>{confirmed.reduce((sum, booking) => sum + booking.seat_numbers.length, 0)}</Text><Text style={styles.tileLabel}>Seats sold</Text></View>
        <View style={styles.tile}><Text style={[styles.tileNum, { color: colors.danger }]}>{cancelled.length}</Text><Text style={styles.tileLabel}>Cancelled</Text></View>
      </Row>

      {/* Revenue chart */}
      <Card style={{ marginBottom: 14 }}>
        <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
          <SectionTitle title="Revenue" />
          <Row style={{ gap: 6 }}>
            {([7, 14, 30] as Window[]).map((days) => <Chip key={days} label={`${days}d`} active={windowDays === days} onPress={() => setWindowDays(days)} />)}
          </Row>
        </Row>
        <Text style={{ fontSize: 12, color: colors.subtext, marginBottom: 12 }}>{money(windowRevenue)} from {windowCount} bookings in the last {windowDays} days</Text>
        <Row style={{ alignItems: 'flex-end', gap: windowDays === 30 ? 2 : 4, height: 120 }}>
          {series.map((day) => <View key={day.key} style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ width: '100%', height: Math.max(3, (day.revenue / maxRevenue) * 110), backgroundColor: day.revenue ? colors.primary : colors.borderSoft, borderRadius: 4 }} />
          </View>)}
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
          <Text style={{ fontSize: 10, color: colors.faint }}>{series[0]?.label}</Text>
          <Text style={{ fontSize: 10, color: colors.faint }}>{series[series.length - 1]?.label}</Text>
        </Row>
      </Card>

      {/* Top routes */}
      <Card>
        <SectionTitle title="Top routes by revenue" />
        {!topRoutes.length ? <Empty title="No revenue yet" subtitle="Confirmed bookings will rank your routes here." icon="bar-chart-outline" /> : topRoutes.map(([routeName, entry]) => <View key={routeName} style={{ marginBottom: 12 }}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontWeight: '800', color: colors.text, flex: 1, marginRight: 8 }} numberOfLines={1}>{routeName}</Text>
            <Text style={{ fontWeight: '900', color: colors.primary }}>{money(entry.revenue)}</Text>
          </Row>
          <View style={{ height: 7, backgroundColor: colors.borderSoft, borderRadius: 4 }}>
            <View style={{ height: 7, width: `${Math.max(4, (entry.revenue / maxRouteRevenue) * 100)}%`, backgroundColor: colors.primary, borderRadius: 4 }} />
          </View>
          <Text style={{ fontSize: 11, color: colors.subtext, marginTop: 3 }}>{entry.count} bookings · {entry.seats} seats</Text>
        </View>)}
      </Card>
    </>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  tile: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14 },
  tileNum: { fontWeight: '900', fontSize: 18, color: colors.text },
  tileLabel: { fontSize: 11, color: colors.subtext, marginTop: 2 },
});
