import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { useAuth } from '../store/auth';
import { Badge, Button, Card, Input, Loading, Row, SectionTitle } from '../components/ui';
import { colors } from '../theme';
import { money } from '../utils/format';
import { GuestAccess } from '../components/GuestAccess';

export default function ProfileScreen() {
  const { user, updateProfile, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState({ bookings: 0, payments: 0, balance: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setSummary({ bookings: 0, payments: 0, balance: 0 }); setLoading(false); return; }
    try {
      const [bookings, payments, accounts] = await Promise.all([api.get('/api/bookings/my?limit=100'), api.get('/api/payments/my'), api.get('/api/bank/accounts/my')]);
      setSummary({ bookings: (bookings.data || []).length, payments: (payments.data || []).length, balance: (accounts.data || []).reduce((total: number, account: any) => total + Number(account.balance || 0), 0) });
    } catch { /* Profile itself remains usable if summary services are unavailable. */ }
    finally { setLoading(false); }
  }, [user]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { setName(user?.full_name || ''); setPhone(user?.phone || ''); }, [user]);
  const initials = (user?.full_name || 'U').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const save = async () => {
    if (name.trim().length < 2) return Alert.alert('Profile', 'Enter your full name.');
    const digits = phone.replace(/\D/g, '');
    if (phone && digits.length < 11) return Alert.alert('Profile', 'Enter a valid mobile number or leave it empty.');
    setBusy(true); try { await updateProfile(name.trim(), phone.trim()); setEditing(false); Alert.alert('Profile updated', 'Your details were saved.'); } catch (reason: any) { Alert.alert('Update failed', reason.message); } finally { setBusy(false); }
  };
  const confirmLogout = () => Alert.alert('Log out?', 'You will need your Google account to sign in again.', [{ text: 'Stay signed in', style: 'cancel' }, { text: 'Log out', style: 'destructive', onPress: logout }]);

  if (!user) return <GuestAccess title="Create your BusGo account" message="Browsing is open to everyone. Log in when you want to buy tickets, manage trips, or view your profile." />;

  return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
    <View style={{ alignItems: 'center', paddingVertical: 20 }}><View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 30, fontWeight: '900' }}>{initials}</Text></View><Text style={{ fontSize: 20, fontWeight: '900', color: colors.text, marginTop: 12 }}>{user?.full_name || 'Traveller'}</Text><View style={{ marginTop: 5 }}><Badge tone="primary" text={user?.role || 'CUSTOMER'} /></View></View>
    <Card style={{ marginBottom: 14 }}><SectionTitle title="Account details" action={!editing ? <Button title="Edit" variant="ghost" icon="create-outline" onPress={() => setEditing(true)} style={{ minHeight: 34, paddingVertical: 4 }} /> : undefined} />
      {editing ? <><Input label="Full name" value={name} onChangeText={setName} autoCapitalize="words" /><Input label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="01XXXXXXXXX" /><Row style={{ gap: 8 }}><Button title="Cancel" variant="outline" onPress={() => { setName(user?.full_name || ''); setPhone(user?.phone || ''); setEditing(false); }} style={{ flex: 1 }} /><Button title="Save" onPress={save} loading={busy} style={{ flex: 1 }} /></Row></> : <><Info icon="mail-outline" label="Email" value={user?.email || 'Not available'} /><Info icon="call-outline" label="Phone" value={user?.phone || 'Add a phone number'} /><Info icon="finger-print-outline" label="User ID" value={user?.id?.slice(0, 12).toUpperCase() || 'Not available'} /></>}
    </Card>
    <Card style={{ marginBottom: 14 }}><SectionTitle title="Travel summary" />{loading ? <Loading /> : <Row style={{ justifyContent: 'space-around' }}><Stat value={String(summary.bookings)} label="Bookings" /><Stat value={String(summary.payments)} label="Payments" /><Stat value={money(summary.balance)} label="Balance" /></Row>}</Card>
    {user?.role === 'OPERATOR' || user?.role === 'ADMIN' ? <Card style={{ marginBottom: 14, backgroundColor: colors.infoSoft }}><Row style={{ gap: 10 }}><Ionicons name="business-outline" size={22} color={colors.info} /><Text style={{ color: colors.info, fontSize: 12, flex: 1 }}>Operator and administration tools are available in the secured web portal. This mobile app currently provides the passenger travel experience.</Text></Row></Card> : null}
    <Button title="Log out" variant="outline" icon="log-out-outline" onPress={confirmLogout} />
  </ScrollView>;
}

function Info({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) { return <Row style={{ gap: 10, marginBottom: 11 }}><Ionicons name={icon} size={19} color={colors.primary} /><View style={{ flex: 1 }}><Text style={{ fontSize: 11, color: colors.faint }}>{label}</Text><Text style={{ fontWeight: '700', color: colors.text }}>{value}</Text></View></Row>; }
function Stat({ value, label }: { value: string; label: string }) { return <View style={{ alignItems: 'center', maxWidth: '32%' }}><Text style={{ fontWeight: '900', fontSize: 17, color: colors.primary }}>{value}</Text><Text style={{ fontSize: 11, color: colors.subtext, marginTop: 3 }}>{label}</Text></View>; }
