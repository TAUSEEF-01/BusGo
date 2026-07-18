import React, { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { Badge, Button, Card, Empty, ErrorState, Loading, Row } from '../components/ui';
import { NotificationItem } from '../types/api';
import { colors } from '../theme';
import { dateTime } from '../utils/format';

const TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  BOOKING_CONFIRMED: 'checkmark-circle-outline', TICKET_ISSUED: 'ticket-outline', BOOKING_CANCELLED: 'close-circle-outline',
  DEPARTURE_REMINDER: 'alarm-outline', OPERATOR_TO_USER: 'megaphone-outline', ADMIN_BROADCAST: 'notifications-outline',
  REFUND_INITIATED: 'cash-outline', REFUND_COMPLETED: 'wallet-outline', BUS_DELAYED: 'warning-outline',
};

export default function AlertsScreen() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => { setError(''); try { const response = await api.get('/api/notifications/?per_page=100'); setItems(response.data?.notifications || []); } catch (reason: any) { setError(reason.message); } finally { setLoading(false); setRefreshing(false); } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const markRead = async (item: NotificationItem) => { if (item.is_read) return; setItems((current) => current.map((value) => value.id === item.id ? { ...value, is_read: true } : value)); try { await api.patch(`/api/notifications/${item.id}/read`); } catch { setItems((current) => current.map((value) => value.id === item.id ? { ...value, is_read: false } : value)); } };
  const markAll = async () => { setBusy(true); try { await api.patch('/api/notifications/read-all'); setItems((current) => current.map((item) => ({ ...item, is_read: true }))); } catch (reason: any) { Alert.alert('Could not update notifications', reason.message); } finally { setBusy(false); } };
  const remove = async (id: string) => { const previous = items; setItems((current) => current.filter((item) => item.id !== id)); try { await api.del(`/api/notifications/${id}`); } catch (reason: any) { setItems(previous); Alert.alert('Could not delete notification', reason.message); } };
  const unread = items.filter((item) => !item.is_read).length;
  return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 30 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
    <Row style={{ justifyContent: 'space-between', marginBottom: 14 }}><Row style={{ gap: 8 }}><Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }}>Notifications</Text>{unread ? <Badge tone="primary" text={`${unread} unread`} /> : null}</Row>{unread ? <Button title="Read all" variant="ghost" onPress={markAll} loading={busy} style={{ minHeight: 36, paddingVertical: 6 }} /> : null}</Row>
    {loading ? <Loading label="Loading notifications…" /> : error ? <ErrorState message={error} onRetry={() => { setLoading(true); load(); }} /> : null}
    {!loading && !error && !items.length ? <Empty title="No notifications" subtitle="Booking updates, tickets, and offers appear here." /> : null}
    {items.map((item) => <Pressable key={item.id} onPress={() => markRead(item)}><Card style={{ marginBottom: 10, borderLeftWidth: 3, borderLeftColor: item.is_read ? colors.border : colors.primary, opacity: item.is_read ? 0.78 : 1 }}><Row style={{ gap: 9, alignItems: 'flex-start' }}><Ionicons name={TYPE_ICON[item.type] || 'notifications-outline'} size={20} color={item.is_read ? colors.subtext : colors.primary} /><View style={{ flex: 1 }}><Text style={{ fontWeight: '800', color: colors.text }}>{item.title}</Text><Text style={{ fontSize: 13, color: colors.subtext, lineHeight: 18, marginTop: 3 }}>{item.message}</Text>{item.metadata?.promo_code ? <View style={{ marginTop: 7 }}><Badge tone="success" text={`Code: ${item.metadata.promo_code}`} /></View> : null}<Text style={{ fontSize: 10, color: colors.faint, marginTop: 7 }}>{dateTime(item.created_at)}</Text></View><Pressable accessibilityLabel="Delete notification" hitSlop={10} onPress={() => remove(item.id)}><Ionicons name="trash-outline" size={18} color={colors.faint} /></Pressable></Row></Card></Pressable>)}
  </ScrollView>;
}
