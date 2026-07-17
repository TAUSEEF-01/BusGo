import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { Badge, Card, Empty, Loading, Row } from '../components/ui';
import { colors } from '../theme';

const TYPE_ICON: Record<string, string> = {
  BOOKING_CONFIRMED: '✅',
  TICKET_ISSUED: '🎟️',
  BOOKING_CANCELLED: '❌',
  DEPARTURE_REMINDER: '⏰',
  OPERATOR_TO_USER: '📣',
  ADMIN_BROADCAST: '📢',
  REFUND_INITIATED: '💸',
  REFUND_COMPLETED: '💰',
  BUS_DELAYED: '🚧',
};

export default function AlertsScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/api/notifications/?per_page=50');
      setItems(res.data?.notifications || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const markRead = async (n: any) => {
    if (n.is_read) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    try {
      await api.patch(`/api/notifications/${n.id}/read`);
    } catch {
      /* optimistic */
    }
  };

  const unread = items.filter((n) => !n.is_read).length;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
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
      <Row style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }}>Notifications</Text>
        {unread > 0 && <Badge tone="primary" text={`${unread} unread`} />}
      </Row>

      {loading && <Loading label="Loading notifications…" />}
      {!loading && items.length === 0 && (
        <Empty title="No notifications" subtitle="Booking updates and special offers will appear here." />
      )}

      {items.map((n) => (
        <Pressable key={n.id} onPress={() => markRead(n)}>
          <Card
            style={{
              marginBottom: 10,
              borderLeftWidth: 3,
              borderLeftColor: n.is_read ? colors.border : colors.primary,
              opacity: n.is_read ? 0.75 : 1,
            }}
          >
            <Row style={{ gap: 8, marginBottom: 4 }}>
              <Text style={{ fontSize: 16 }}>{TYPE_ICON[n.type] || '🔔'}</Text>
              <Text style={{ fontWeight: '800', color: colors.text, flex: 1 }} numberOfLines={1}>
                {n.title}
              </Text>
            </Row>
            <Text style={{ fontSize: 13, color: colors.subtext, lineHeight: 18 }}>{n.message}</Text>
            {n.metadata?.promo_code ? (
              <View style={{ marginTop: 8 }}>
                <Badge tone="success" text={`Code: ${n.metadata.promo_code}`} />
              </View>
            ) : null}
            <Text style={{ fontSize: 10, color: colors.faint, marginTop: 6 }}>
              {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
            </Text>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}
