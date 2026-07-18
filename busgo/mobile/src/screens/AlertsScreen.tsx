import React, { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api/client';
import { Badge, Button, Card, Empty, ErrorState, Loading, Row } from '../components/ui';
import { NotificationItem } from '../types/api';
import { colors } from '../theme';
import { dateTime } from '../utils/format';
import { useAuth } from '../store/auth';
import { useNotifications } from '../store/notifications';
import { GuestAccess } from '../components/GuestAccess';
import type { RootStackParamList } from '../nav';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  BOOKING_CONFIRMED: 'checkmark-circle-outline', TICKET_ISSUED: 'ticket-outline', BOOKING_CANCELLED: 'close-circle-outline',
  DEPARTURE_REMINDER: 'alarm-outline', OPERATOR_TO_USER: 'megaphone-outline', ADMIN_BROADCAST: 'notifications-outline',
  REFUND_INITIATED: 'cash-outline', REFUND_COMPLETED: 'wallet-outline', BUS_DELAYED: 'warning-outline',
};

/** P1.8: where a notification leads when tapped, from its metadata. */
function targetOf(item: NotificationItem): { label: string; go: (nav: Nav) => void } | null {
  const meta = item.metadata || {};
  const ticketId = meta.ticket_id || meta.ticketId;
  const bookingId = meta.booking_id || meta.bookingId;
  const journeyId = meta.journey_id || meta.journeyId;
  if (ticketId) return { label: 'View e-ticket', go: (nav) => nav.navigate('TicketDetail', { ticketId: String(ticketId) }) };
  if (bookingId) return { label: 'View booking', go: (nav) => nav.navigate('BookingDetail', { bookingId: String(bookingId), journeyId: journeyId ? String(journeyId) : undefined }) };
  if (meta.promo_code) return { label: 'See deals', go: (nav) => (nav as any).navigate('Deals') };
  if (meta.origin && meta.destination && meta.journey_date) return { label: 'View route', go: (nav) => nav.navigate('Results', { origin: String(meta.origin), destination: String(meta.destination), date: String(meta.journey_date) }) };
  return null;
}

export default function AlertsScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { setUnread } = useNotifications();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const syncUnread = (list: NotificationItem[]) => setUnread(list.filter((item) => !item.is_read).length);

  const load = useCallback(async () => {
    setError('');
    if (!user) { setItems([]); setUnread(0); setLoading(false); setRefreshing(false); return; }
    try {
      const response = await api.get('/api/notifications/?per_page=100');
      const list = response.data?.notifications || [];
      setItems(list);
      syncUnread(list);
    } catch (reason: any) { setError(reason.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const markRead = async (item: NotificationItem) => {
    if (item.is_read) return;
    setItems((current) => { const next = current.map((value) => value.id === item.id ? { ...value, is_read: true } : value); syncUnread(next); return next; });
    try { await api.patch(`/api/notifications/${item.id}/read`); }
    catch { setItems((current) => { const next = current.map((value) => value.id === item.id ? { ...value, is_read: false } : value); syncUnread(next); return next; }); }
  };

  const open = (item: NotificationItem) => {
    markRead(item);
    const target = targetOf(item);
    if (!target) return;
    try { target.go(navigation); }
    catch { Alert.alert('Not available', 'The item this notification points to is no longer available.'); }
  };

  const markAll = async () => {
    setBusy(true);
    try { await api.patch('/api/notifications/read-all'); setItems((current) => { const next = current.map((item) => ({ ...item, is_read: true })); syncUnread(next); return next; }); }
    catch (reason: any) { Alert.alert('Could not update notifications', reason.message); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    const previous = items;
    setItems((current) => { const next = current.filter((item) => item.id !== id); syncUnread(next); return next; });
    try { await api.del(`/api/notifications/${id}`); }
    catch (reason: any) { setItems(previous); syncUnread(previous); Alert.alert('Could not delete notification', reason.message); }
  };

  const unread = items.filter((item) => !item.is_read).length;
  if (!user) return <GuestAccess title="Notifications need an account" message="Log in to receive booking confirmations, ticket updates, reminders, and offers." />;
  return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 30 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
    <Row style={{ justifyContent: 'space-between', marginBottom: 14 }}><Row style={{ gap: 8 }}><Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }}>Notifications</Text>{unread ? <Badge tone="primary" text={`${unread} unread`} /> : null}</Row>{unread ? <Button title="Read all" variant="ghost" onPress={markAll} loading={busy} style={{ minHeight: 36, paddingVertical: 6 }} /> : null}</Row>
    {loading ? <Loading label="Loading notifications…" /> : error ? <ErrorState message={error} onRetry={() => { setLoading(true); load(); }} /> : null}
    {!loading && !error && !items.length ? <Empty title="No notifications" subtitle="Booking updates, tickets, and offers appear here." icon="notifications-outline" /> : null}
    {items.map((item) => {
      const target = targetOf(item);
      return <Pressable key={item.id} onPress={() => open(item)}>
        <Card style={{ marginBottom: 10, borderLeftWidth: 3, borderLeftColor: item.is_read ? colors.border : colors.primary, opacity: item.is_read ? 0.78 : 1 }}>
          <Row style={{ gap: 9, alignItems: 'flex-start' }}>
            <Ionicons name={TYPE_ICON[item.type] || 'notifications-outline'} size={20} color={item.is_read ? colors.subtext : colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', color: colors.text }}>{item.title}</Text>
              <Text style={{ fontSize: 13, color: colors.subtext, lineHeight: 18, marginTop: 3 }}>{item.message}</Text>
              {item.metadata?.promo_code ? <View style={{ marginTop: 7 }}><Badge tone="success" text={`Code: ${item.metadata.promo_code}`} /></View> : null}
              <Row style={{ justifyContent: 'space-between', marginTop: 7 }}>
                <Text style={{ fontSize: 10, color: colors.faint }}>{dateTime(item.created_at)}</Text>
                {target ? <Row style={{ gap: 3 }}><Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary }}>{target.label}</Text><Ionicons name="chevron-forward" size={12} color={colors.primary} /></Row> : null}
              </Row>
            </View>
            <Pressable accessibilityLabel="Delete notification" hitSlop={10} onPress={() => remove(item.id)}><Ionicons name="trash-outline" size={18} color={colors.faint} /></Pressable>
          </Row>
        </Card>
      </Pressable>;
    })}
  </ScrollView>;
}
