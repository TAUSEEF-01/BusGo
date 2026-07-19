import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { useAuth } from '../store/auth';
import { Badge, Button, Card, Empty, ErrorState, Input, Loading, Row } from '../components/ui';
import { colors } from '../theme';
import { shortDate } from '../utils/format';
import type { OperatorBooking } from '../types';

interface Recipient { user_id: string; name: string; lastRoute: string; lastDate: string; bookings: number }

/**
 * Web parity with OperatorSendNotification: pick from your past passengers
 * (names resolved via auth-service lookup) and send an OPERATOR_TO_USER
 * notification through notification-service.
 */
export default function NotifyScreen() {
  const { user } = useAuth();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await api.get(`/api/bookings/operator/${user?.id}?limit=1000`);
      const bookings: OperatorBooking[] = response.data || [];
      const byUser = new Map<string, Recipient>();
      for (const booking of bookings) {
        const entry = byUser.get(booking.user_id);
        const route = `${booking.origin_city || booking.boarding_point} → ${booking.destination_city || booking.dropping_point}`;
        if (entry) { entry.bookings += 1; if (booking.created_at > entry.lastDate) { entry.lastDate = booking.created_at; entry.lastRoute = route; } }
        else byUser.set(booking.user_id, { user_id: booking.user_id, name: booking.passenger_details?.[0]?.name || '', lastRoute: route, lastDate: booking.created_at, bookings: 1 });
      }
      // Resolve real account names where the auth service knows them.
      const ids = [...byUser.keys()];
      if (ids.length) {
        try {
          const lookup = await api.post('/api/auth/users/lookup', { user_ids: ids });
          for (const item of lookup.data || []) {
            const entry = byUser.get(item.id);
            if (entry && item.full_name) entry.name = item.full_name;
          }
        } catch { /* booking passenger names remain the fallback */ }
      }
      setRecipients([...byUser.values()].sort((a, b) => b.lastDate.localeCompare(a.lastDate)));
    } catch (reason: any) { setError(reason.message || 'Could not load your passengers.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = (userId: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(userId)) next.delete(userId); else next.add(userId);
    return next;
  });

  const send = async () => {
    if (!selected.size) return Alert.alert('Notification', 'Select at least one passenger.');
    if (!title.trim()) return Alert.alert('Notification', 'Enter a title.');
    if (!message.trim()) return Alert.alert('Notification', 'Enter a message.');
    setSending(true);
    try {
      const response = await api.post('/api/notifications/send', {
        user_ids: [...selected], type: 'OPERATOR_TO_USER', title: title.trim(), message: message.trim(),
        metadata: { operator_id: user?.id, operator_name: user?.full_name },
      });
      Alert.alert('Sent', `Notification delivered to ${response.data?.sent_count ?? selected.size} passenger${selected.size > 1 ? 's' : ''}.`);
      setSelected(new Set()); setTitle(''); setMessage('');
    } catch (reason: any) { Alert.alert('Could not send', reason.message); }
    finally { setSending(false); }
  };

  const allSelected = useMemo(() => recipients.length > 0 && selected.size === recipients.length, [recipients, selected]);

  return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 30 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />} keyboardShouldPersistTaps="handled">
    <Card style={{ marginBottom: 12 }}>
      <Input label="Title" value={title} onChangeText={setTitle} placeholder="Schedule update from your operator" />
      <Input label="Message" value={message} onChangeText={setMessage} placeholder="Write the announcement your passengers will receive…" multiline numberOfLines={3} style={{ minHeight: 76, textAlignVertical: 'top' }} />
      <Button title={`Send to ${selected.size} passenger${selected.size === 1 ? '' : 's'}`} icon="paper-plane-outline" onPress={send} loading={sending} disabled={!selected.size} />
    </Card>

    <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
      <Text style={{ fontWeight: '900', color: colors.text }}>Your passengers ({recipients.length})</Text>
      {recipients.length ? <Pressable onPress={() => setSelected(allSelected ? new Set() : new Set(recipients.map((recipient) => recipient.user_id)))}><Text style={{ fontSize: 12, fontWeight: '800', color: colors.primary }}>{allSelected ? 'Clear all' : 'Select all'}</Text></Pressable> : null}
    </Row>
    {loading ? <Loading label="Loading passengers…" /> : error ? <ErrorState message={error} onRetry={() => { setLoading(true); load(); }} /> : null}
    {!loading && !error && !recipients.length ? <Empty title="No passengers yet" subtitle="Passengers who book your trips will appear here." icon="people-outline" /> : null}
    {recipients.map((recipient) => <Pressable key={recipient.user_id} onPress={() => toggle(recipient.user_id)}>
      <Card style={{ marginBottom: 8, borderColor: selected.has(recipient.user_id) ? colors.primary : colors.border }}>
        <Row style={{ gap: 10 }}>
          <Ionicons name={selected.has(recipient.user_id) ? 'checkbox' : 'square-outline'} size={22} color={selected.has(recipient.user_id) ? colors.primary : colors.faint} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '800', color: colors.text }} numberOfLines={1}>{recipient.name || `Passenger ${recipient.user_id.slice(0, 8)}`}</Text>
            <Text style={{ fontSize: 11, color: colors.subtext }}>{recipient.lastRoute} · last {shortDate(recipient.lastDate)}</Text>
          </View>
          <Badge tone="neutral" text={`${recipient.bookings} trip${recipient.bookings > 1 ? 's' : ''}`} />
        </Row>
      </Card>
    </Pressable>)}
  </ScrollView>;
}
