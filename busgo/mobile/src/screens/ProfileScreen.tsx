import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api/client';
import { useAuth } from '../store/auth';
import { Badge, Button, Card, Input, Loading, Row, SectionTitle } from '../components/ui';
import { colors } from '../theme';
import { dateTime, money, reference, shortDate } from '../utils/format';
import { Booking, Journey } from '../types/api';
import type { RootStackParamList } from '../nav';
import { GuestAccess } from '../components/GuestAccess';
import { API_URL } from '../config';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface PaymentRow {
  id: string; booking_id?: string | null; amount: number; method: string;
  status: string; gateway_transaction_id?: string | null;
  initiated_at?: string; completed_at?: string | null;
}

const HISTORY_PREVIEW = 4;

function methodIcon(method: string): keyof typeof Ionicons.glyphMap {
  const value = method.toUpperCase();
  if (value.includes('CARD') || value.includes('BANK')) return 'card-outline';
  return 'phone-portrait-outline';
}

function paymentTone(status: string): 'success' | 'warn' | 'danger' | 'neutral' {
  const value = status.toUpperCase();
  if (value === 'COMPLETED') return 'success';
  if (value === 'PENDING' || value === 'INITIATED') return 'warn';
  if (value === 'FAILED') return 'danger';
  return 'neutral';
}

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { user, updateProfile, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [busy, setBusy] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showAllPayments, setShowAllPayments] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setBookings([]); setJourneys([]); setPayments([]); setBalance(0); setLoading(false); return; }
    try {
      const [bookingResponse, journeyResponse, paymentResponse, accountResponse] = await Promise.all([
        api.get('/api/bookings/my?limit=100'),
        api.get('/api/bookings/journeys/my').catch(() => ({ data: [] })),
        api.get('/api/payments/my'),
        api.get('/api/bank/accounts/my'),
      ]);
      setBookings(bookingResponse.data || []);
      setJourneys(journeyResponse.data || []);
      setPayments((paymentResponse.data || []).map((payment: any) => ({ ...payment, amount: Number(payment.amount) })));
      setBalance((accountResponse.data || []).reduce((total: number, account: any) => total + Number(account.balance || 0), 0));
    } catch { /* Profile itself remains usable if summary services are unavailable. */ }
    finally { setLoading(false); }
  }, [user]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { setName(user?.full_name || ''); setPhone(user?.phone || ''); }, [user]);
  const initials = (user?.full_name || 'U').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  // Travel history: journeys + standalone bookings, newest first.
  const history = useMemo(() => {
    const items: { key: string; bookingId: string; journeyId?: string | null; title: string; subtitle: string; status: string; total: number; createdAt: string }[] = [];
    for (const journey of journeys) {
      items.push({
        key: journey.journey_id,
        bookingId: journey.legs[0]?.booking_id || journey.journey_id,
        journeyId: journey.journey_id,
        title: `${journey.origin} → ${journey.destination}`,
        subtitle: `${journey.leg_count} connecting buses · ${shortDate(journey.legs[0]?.journey_date)}`,
        status: journey.status,
        total: journey.final_fare,
        createdAt: journey.created_at || '',
      });
    }
    for (const booking of bookings) {
      if (booking.journey_id) continue;
      items.push({
        key: booking.id,
        bookingId: booking.id,
        journeyId: null,
        title: `${booking.origin_city || booking.boarding_point} → ${booking.destination_city || booking.dropping_point}`,
        subtitle: `${booking.operator_name || 'Bus operator'} · ${shortDate(booking.journey_date)}`,
        status: booking.status,
        total: Number(booking.total_fare) - Number(booking.discount_amount || 0),
        createdAt: booking.created_at,
      });
    }
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [bookings, journeys]);

  const stats = useMemo(() => {
    const statusOf = (value: string) => value.toUpperCase();
    const active = history.filter((item) => statusOf(item.status) === 'CONFIRMED' || statusOf(item.status) === 'SEAT_LOCKED').length;
    const completed = history.filter((item) => statusOf(item.status) === 'COMPLETED').length;
    const cancelled = history.filter((item) => ['CANCELLED', 'REFUNDED', 'EXPIRED'].includes(statusOf(item.status))).length;
    // Only successfully completed payments count as money actually paid.
    const totalPaid = payments.filter((payment) => payment.status.toUpperCase() === 'COMPLETED').reduce((sum, payment) => sum + payment.amount, 0);
    return { active, completed, cancelled, totalPaid };
  }, [history, payments]);

  const openBooking = (bookingId?: string | null, journeyId?: string | null) => {
    if (bookingId) navigation.navigate('BookingDetail', { bookingId, journeyId: journeyId || undefined });
  };

  const save = async () => {
    if (name.trim().length < 2) return Alert.alert('Profile', 'Enter your full name.');
    const digits = phone.replace(/\D/g, '');
    const normalizedPhone = digits.startsWith('880') && digits.length === 13 ? `0${digits.slice(3)}` : digits;
    if (!/^01\d{9}$/.test(normalizedPhone)) return Alert.alert('Profile', 'Enter a valid 11-digit Bangladeshi mobile number.');
    setBusy(true); try { await updateProfile(name.trim(), phone.trim()); setEditing(false); Alert.alert('Profile updated', 'Your details were saved.'); } catch (reason: any) { Alert.alert('Update failed', reason.message); } finally { setBusy(false); }
  };
  const confirmLogout = () => Alert.alert('Log out?', 'You will need your Google account to sign in again.', [{ text: 'Stay signed in', style: 'cancel' }, { text: 'Log out', style: 'destructive', onPress: logout }]);

  if (!user) return <GuestAccess title="Create your BusGo account" message="Browsing is open to everyone. Log in when you want to buy tickets, manage trips, or view your profile." />;

  const visibleHistory = showAllHistory ? history : history.slice(0, HISTORY_PREVIEW);
  const visiblePayments = showAllPayments ? payments : payments.slice(0, HISTORY_PREVIEW);

  return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
    <View style={{ alignItems: 'center', paddingVertical: 20 }}>
      <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 82, height: 82, borderRadius: 41, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 29, fontWeight: '900' }}>{initials}</Text></View>
      </View>
      <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text, marginTop: 12 }}>{user?.full_name || 'Traveller'}</Text>
      <View style={{ marginTop: 5 }}><Badge tone="primary" text={user?.role || 'CUSTOMER'} /></View>
    </View>

    {/* Stats */}
    <Card style={{ marginBottom: 14 }}>
      <SectionTitle title="Travel summary" />
      {loading ? <Loading /> : <>
        <Row style={{ justifyContent: 'space-around', marginBottom: 12 }}>
          <Stat value={String(stats.active)} label="Active" />
          <Stat value={String(stats.completed)} label="Completed" />
          <Stat value={String(stats.cancelled)} label="Cancelled" />
        </Row>
        <Row style={{ justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: 10 }}>
          <Row style={{ gap: 6 }}><Ionicons name="wallet-outline" size={15} color={colors.subtext} /><Text style={{ fontSize: 12, color: colors.subtext }}>Wallet balance</Text></Row>
          <Text style={{ fontWeight: '900', color: colors.success }}>{money(balance)}</Text>
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: 7 }}>
          <Row style={{ gap: 6 }}><Ionicons name="cash-outline" size={15} color={colors.subtext} /><Text style={{ fontSize: 12, color: colors.subtext }}>Total paid (completed payments)</Text></Row>
          <Text style={{ fontWeight: '900', color: colors.primary }}>{money(stats.totalPaid)}</Text>
        </Row>
      </>}
    </Card>

    {/* Travel history */}
    <Card style={{ marginBottom: 14 }}>
      <SectionTitle title="Travel history" />
      {loading ? <Loading /> : !history.length ? <Text style={{ fontSize: 12, color: colors.faint }}>Your journeys will appear here after your first booking.</Text> : <>
        {visibleHistory.map((item) => <Pressable key={item.key} onPress={() => openBooking(item.bookingId, item.journeyId)}>
          <Row style={styles.historyRow}>
            <View style={styles.historyIcon}><Ionicons name="bus-outline" size={15} color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', color: colors.text, fontSize: 13 }} numberOfLines={1}>{item.title}</Text>
              <Text style={{ fontSize: 11, color: colors.subtext, marginTop: 1 }} numberOfLines={1}>{item.subtitle}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 3 }}>
              <Text style={{ fontWeight: '900', color: colors.primary, fontSize: 13 }}>{money(item.total)}</Text>
              <Badge tone={paymentTone(item.status) === 'success' ? 'success' : paymentTone(item.status)} text={item.status.replaceAll('_', ' ')} />
            </View>
          </Row>
        </Pressable>)}
        {history.length > HISTORY_PREVIEW ? <Button title={showAllHistory ? 'Show fewer' : `Show all ${history.length}`} variant="ghost" onPress={() => setShowAllHistory((value) => !value)} style={{ minHeight: 34, paddingVertical: 4 }} /> : null}
      </>}
    </Card>

    {/* Transactions */}
    <Card style={{ marginBottom: 14 }}>
      <SectionTitle title="Transactions" />
      {loading ? <Loading /> : !payments.length ? <Text style={{ fontSize: 12, color: colors.faint }}>Payments appear here after your first checkout.</Text> : <>
        {visiblePayments.map((payment) => <Pressable key={payment.id} onPress={() => openBooking(payment.booking_id)}>
          <Row style={styles.historyRow}>
            <View style={styles.historyIcon}><Ionicons name={methodIcon(payment.method)} size={15} color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', color: colors.text, fontSize: 13 }}>{payment.method} · {reference(payment.gateway_transaction_id || payment.id)}</Text>
              <Text style={{ fontSize: 11, color: colors.subtext, marginTop: 1 }}>{dateTime(payment.completed_at || payment.initiated_at)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 3 }}>
              <Text style={{ fontWeight: '900', color: colors.text, fontSize: 13 }}>{money(payment.amount)}</Text>
              <Badge tone={paymentTone(payment.status)} text={payment.status} />
            </View>
          </Row>
        </Pressable>)}
        {payments.length > HISTORY_PREVIEW ? <Button title={showAllPayments ? 'Show fewer' : `Show all ${payments.length}`} variant="ghost" onPress={() => setShowAllPayments((value) => !value)} style={{ minHeight: 34, paddingVertical: 4 }} /> : null}
      </>}
    </Card>

    {/* Account details */}
    <Card style={{ marginBottom: 14 }}><SectionTitle title="Account details" action={!editing ? <Button title="Edit" variant="ghost" icon="create-outline" onPress={() => setEditing(true)} style={{ minHeight: 34, paddingVertical: 4 }} /> : undefined} />
      {editing ? <><Input label="Full name" value={name} onChangeText={setName} autoCapitalize="words" /><Input label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="01XXXXXXXXX" /><Row style={{ gap: 8 }}><Button title="Cancel" variant="outline" onPress={() => { setName(user?.full_name || ''); setPhone(user?.phone || ''); setEditing(false); }} style={{ flex: 1 }} /><Button title="Save" onPress={save} loading={busy} style={{ flex: 1 }} /></Row></> : <><Info icon="mail-outline" label="Email" value={user?.email || 'Not available'} /><Info icon="call-outline" label="Phone" value={user?.phone || 'Add a phone number'} /><Info icon="finger-print-outline" label="User ID" value={user?.id?.slice(0, 12).toUpperCase() || 'Not available'} /></>}
    </Card>

    {user?.role === 'OPERATOR' || user?.role === 'ADMIN' ? <Card style={{ marginBottom: 14, backgroundColor: colors.infoSoft, borderColor: '#bfdbfe' }}>
      <Row style={{ gap: 10, marginBottom: 10 }}><Ionicons name="business-outline" size={22} color={colors.info} /><Text style={{ color: colors.info, fontSize: 12, flex: 1 }}>Operator and administration tools live in the secured web portal. This app provides the passenger experience.</Text></Row>
      <Button title="Open the web portal" icon="open-outline" variant="outline" onPress={() => Linking.openURL(API_URL.startsWith('http') ? API_URL.replace(':18085', '') : 'https://busgo.farefin.com')} />
    </Card> : null}
    <Button title="Log out" variant="outline" icon="log-out-outline" onPress={confirmLogout} />
  </ScrollView>;
}

function Info({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) { return <Row style={{ gap: 10, marginBottom: 11 }}><Ionicons name={icon} size={19} color={colors.primary} /><View style={{ flex: 1 }}><Text style={{ fontSize: 11, color: colors.faint }}>{label}</Text><Text style={{ fontWeight: '700', color: colors.text }}>{value}</Text></View></Row>; }
function Stat({ value, label }: { value: string; label: string }) { return <View style={{ alignItems: 'center', maxWidth: '32%' }}><Text style={{ fontWeight: '900', fontSize: 17, color: colors.primary }}>{value}</Text><Text style={{ fontSize: 11, color: colors.subtext, marginTop: 3 }}>{label}</Text></View>; }

const styles = StyleSheet.create({
  historyRow: { gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  historyIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
