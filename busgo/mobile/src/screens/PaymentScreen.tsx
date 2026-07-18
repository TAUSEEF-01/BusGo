import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { Badge, Button, Card, ErrorState, Input, Loading, Row } from '../components/ui';
import { colors, radius } from '../theme';
import { countdown, money, secondsRemaining } from '../utils/format';
import { ScreenProps } from '../nav';

type Method = 'BKASH' | 'NAGAD' | 'CARD';
interface BankAccount { id: string; account_type: 'MOBILE' | 'BANK'; provider: string; account_number: string; balance: number }
const METHODS: { id: Method; label: string; icon: keyof typeof Ionicons.glyphMap; funds: 'MOBILE' | 'BANK' }[] = [
  { id: 'BKASH', label: 'bKash', icon: 'phone-portrait-outline', funds: 'MOBILE' },
  { id: 'NAGAD', label: 'Nagad', icon: 'phone-portrait-outline', funds: 'MOBILE' },
  { id: 'CARD', label: 'Card', icon: 'card-outline', funds: 'BANK' },
];

export default function PaymentScreen({ route, navigation }: ScreenProps<'Payment'>) {
  const params = route.params;
  const [method, setMethod] = useState<Method>('BKASH');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [amount, setAmount] = useState(Number(params.amount));
  const [gross, setGross] = useState(Number(params.amount));
  const [discount, setDiscount] = useState(0);
  const [promo, setPromo] = useState('');
  const [promoApplied, setPromoApplied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(secondsRemaining(params.expiresAt));

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [accountResponse, bookingResponse] = await Promise.all([
        api.get('/api/bank/accounts/my'),
        params.mode === 'transit' && params.journeyId ? api.get(`/api/bookings/journeys/${params.journeyId}`) : api.get(`/api/bookings/${params.bookingId}`),
      ]);
      const nextAccounts = (accountResponse.data || []).map((account: any) => ({ ...account, balance: Number(account.balance) }));
      setAccounts(nextAccounts);
      const booking = bookingResponse.data;
      const total = Number(booking.total_fare || params.amount);
      const saved = Number(booking.discount_amount || 0);
      setGross(total); setDiscount(saved); setAmount(Math.max(0, total - saved));
      if (booking.promo_code) setPromoApplied(booking.promo_code);
      const expiry = booking.expires_at || params.expiresAt;
      setRemaining(secondsRemaining(expiry));
      const mobile = nextAccounts.find((account: BankAccount) => account.account_type === 'MOBILE');
      if (mobile?.account_number) setPhone(mobile.account_number);
    } catch (reason: any) { setError(reason.message || 'Could not prepare payment.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (loading || remaining <= 0) return;
    const timer = setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [loading, remaining > 0]);

  const selectedMethod = METHODS.find((item) => item.id === method)!;
  const activeAccount = accounts.find((account) => account.account_type === selectedMethod.funds);
  const insufficient = !!activeAccount && activeAccount.balance < amount;
  const expired = remaining <= 0;

  const applyPromo = async () => {
    const code = promo.trim().toUpperCase();
    if (!code) return Alert.alert('Promo code', 'Enter a promo code first.');
    setBusy(true);
    try {
      const response = await api.post(`/api/bookings/${params.bookingId}/apply-promo`, { promo_code: code });
      setGross(Number(response.data.total_fare)); setAmount(Number(response.data.final_fare)); setDiscount(Number(response.data.discount_amount)); setPromoApplied(response.data.promo_code || code);
    } catch (reason: any) { Alert.alert('Promo not applied', reason.message); }
    finally { setBusy(false); }
  };

  const removePromo = async () => {
    setBusy(true);
    try { const response = await api.del(`/api/bookings/${params.bookingId}/apply-promo`); setGross(Number(response.data.total_fare)); setAmount(Number(response.data.final_fare)); setDiscount(0); setPromoApplied(null); setPromo(''); }
    catch (reason: any) { Alert.alert('Could not remove promo', reason.message); }
    finally { setBusy(false); }
  };

  const pay = async () => {
    if (expired) return Alert.alert('Seat hold expired', 'Return to search and select seats again.', [{ text: 'Return home', onPress: () => navigation.popToTop() }]);
    if ((method === 'BKASH' || method === 'NAGAD') && !/^01\d{9}$/.test(phone.replace(/\D/g, '').slice(-11))) return Alert.alert('Wallet number', 'Enter the 11-digit mobile number linked to your BusGo wallet.');
    if ((method === 'BKASH' || method === 'NAGAD') && pin.length < 4) return Alert.alert('Wallet PIN', 'Enter your wallet PIN.');
    if (insufficient) return Alert.alert('Insufficient balance', `Available balance: ${money(activeAccount?.balance)}.`);
    setBusy(true);
    try {
      const body: any = { booking_id: params.bookingId, trip_id: params.tripId, amount, method };
      if (params.journeyId) body.journey_id = params.journeyId;
      if (method !== 'CARD') { body.mobile_number = phone.replace(/\D/g, '').slice(-11); body.pin = pin; }
      const initiated = await api.post('/api/payments/initiate', body);
      const paymentId = initiated.data.payment_id;
      // The server also confirms through the durable payment.completed event.
      // This request makes the UI immediate, but losing connectivity here must
      // never present an already-completed charge as a failed payment.
      try {
        if (params.mode === 'transit') await api.post(`/api/bookings/journeys/${params.journeyId}/confirm-payment?payment_id=${paymentId}`);
        else await api.post(`/api/bookings/${params.bookingId}/confirm-payment?payment_id=${paymentId}`);
      } catch { /* confirmation continues server-side */ }
      navigation.replace('Confirmation', { mode: params.mode, bookingId: params.bookingId, journeyId: params.journeyId, origin: params.origin, destination: params.destination, amount });
    } catch (reason: any) {
      const released = reason.status === 402 || reason.status === 403 || reason.status >= 500 || reason.status === 0;
      Alert.alert('Payment failed', `${reason.message}${released ? '\n\nThe seat hold was released. Please make a new booking.' : ''}`, released ? [{ text: 'Return home', onPress: () => navigation.popToTop() }] : undefined);
    } finally { setBusy(false); }
  };

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}><Loading label="Preparing secure payment…" /></View>;
  if (error) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}><ErrorState title="Payment unavailable" message={error} onRetry={load} /></View>;

  return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
    <Card style={{ marginBottom: 14 }}><Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}><View style={{ flex: 1 }}><Text style={{ fontWeight: '800', fontSize: 16, color: colors.text }}>{params.origin} → {params.destination}</Text>{params.mode === 'transit' ? <Badge tone="primary" text={`${params.legs?.length || 2}-bus journey · one payment`} /> : null}</View><View style={{ alignItems: 'flex-end' }}>{discount > 0 ? <Text style={{ color: colors.faint, textDecorationLine: 'line-through' }}>{money(gross)}</Text> : null}<Text style={{ fontWeight: '900', fontSize: 22, color: colors.primary }}>{money(amount)}</Text></View></Row><Row style={{ gap: 6, marginTop: 10 }}><Ionicons name="time-outline" size={17} color={expired ? colors.danger : colors.warn} /><Text style={{ fontSize: 12, fontWeight: '800', color: expired ? colors.danger : colors.warn }}>{expired ? 'Seat hold expired' : `Complete payment within ${countdown(remaining)}`}</Text></Row></Card>

    <Card style={{ marginBottom: 14 }}><Text style={{ fontWeight: '800', color: colors.text, marginBottom: 10 }}>Payment method</Text><Row style={{ gap: 8 }}>{METHODS.map((item) => <Pressable key={item.id} onPress={() => setMethod(item.id)} style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.md, borderWidth: 2, borderColor: method === item.id ? colors.primary : colors.border, backgroundColor: method === item.id ? colors.primarySoft : '#fff' }}><Ionicons name={item.icon} size={22} color={method === item.id ? colors.primary : colors.subtext} /><Text style={{ fontWeight: '800', fontSize: 12, marginTop: 4, color: method === item.id ? colors.primary : colors.text }}>{item.label}</Text></Pressable>)}</Row>
      {activeAccount ? <Row style={{ justifyContent: 'space-between', marginTop: 14, padding: 10, backgroundColor: '#f8fafc', borderRadius: radius.md }}><View><Text style={{ fontWeight: '700', color: colors.text }}>{activeAccount.provider}</Text><Text style={{ fontSize: 11, color: colors.subtext }}>{activeAccount.account_number}</Text></View><Text style={{ fontWeight: '900', color: insufficient ? colors.danger : colors.success }}>{money(activeAccount.balance)}</Text></Row> : null}
      {method !== 'CARD' ? <View style={{ marginTop: 14 }}><Input label={`${selectedMethod.label} number`} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="01XXXXXXXXX" maxLength={14} /><Input label="PIN" value={pin} onChangeText={(value) => setPin(value.replace(/\D/g, ''))} secureTextEntry keyboardType="number-pad" placeholder="Wallet PIN" maxLength={8} /></View> : <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 12 }}>Your linked bank account will be charged.</Text>}
    </Card>

    {params.mode === 'direct' ? <Card style={{ marginBottom: 14 }}><Text style={{ fontWeight: '800', color: colors.text, marginBottom: 10 }}>Promo code</Text>{promoApplied ? <Row style={{ justifyContent: 'space-between' }}><Badge tone="success" text={`${promoApplied} · saved ${money(discount)}`} /><Button title="Remove" variant="ghost" onPress={removePromo} /></Row> : <Row style={{ gap: 8, alignItems: 'flex-start' }}><View style={{ flex: 1 }}><Input value={promo} onChangeText={(value) => setPromo(value.toUpperCase())} placeholder="Enter code" autoCapitalize="characters" /></View><Button title="Apply" variant="outline" onPress={applyPromo} style={{ paddingHorizontal: 18 }} /></Row>}</Card> : null}
    <Button title={expired ? 'Seat hold expired' : `Pay ${money(amount)}`} icon="lock-closed-outline" onPress={pay} loading={busy} disabled={expired || insufficient} />
    {insufficient ? <Text style={{ color: colors.danger, fontSize: 12, textAlign: 'center', marginTop: 8 }}>Your selected account does not have enough balance.</Text> : null}
  </ScrollView>;
}
