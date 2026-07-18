import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { Badge, Button, Card, ErrorState, Input, Loading, Row } from '../components/ui';
import { colors, radius } from '../theme';
import { countdown, money, secondsRemaining } from '../utils/format';
import { ScreenProps } from '../nav';
import { useAuth } from '../store/auth';

type Method = 'BKASH' | 'NAGAD' | 'CARD';
interface BankAccount { id: string; account_type: 'MOBILE' | 'BANK'; provider: string; account_number: string; balance: number }
const METHODS: { id: Method; label: string; icon: keyof typeof Ionicons.glyphMap; brand: string }[] = [
  { id: 'BKASH', label: 'bKash', icon: 'phone-portrait-outline', brand: '#e2136e' },
  { id: 'NAGAD', label: 'Nagad', icon: 'phone-portrait-outline', brand: '#f6921e' },
  { id: 'CARD', label: 'Card', icon: 'card-outline', brand: '#1d4ed8' },
];

/**
 * P0.2: a payment method may only ever use the account of ITS provider.
 * bKash and Nagad are both MOBILE accounts, so matching by type alone could
 * charge the wrong wallet.
 */
function accountForMethod(accounts: BankAccount[], method: Method): BankAccount | undefined {
  if (method === 'CARD') return accounts.find((account) => account.account_type === 'BANK');
  const wanted = method === 'BKASH' ? 'bkash' : 'nagad';
  return accounts.find((account) => {
    if (account.account_type !== 'MOBILE') return false;
    return (account.provider || '').toLowerCase().replace(/[\s-]/g, '').includes(wanted);
  });
}

export default function PaymentScreen({ route, navigation }: ScreenProps<'Payment'>) {
  const params = route.params;
  const { user } = useAuth();
  const [method, setMethod] = useState<Method | null>(null);
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [amount, setAmount] = useState(Number(params.amount));
  const [gross, setGross] = useState(Number(params.amount));
  const [discount, setDiscount] = useState(0);
  const [promo, setPromo] = useState('');
  const [promoApplied, setPromoApplied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [payingLabel, setPayingLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(secondsRemaining(params.expiresAt));

  const returnAmount = Number(params.returnAmount || 0);
  const isRoundTrip = !!params.returnBookingId;
  const totalDue = amount + returnAmount;

  const load = async () => {
    setLoading(true); setError('');
    if (!user?.phone?.trim()) { setLoading(false); return; }
    try {
      const [accountResponse, bookingResponse] = await Promise.all([
        api.get('/api/bank/accounts/my'),
        params.mode === 'transit' && params.journeyId ? api.get(`/api/bookings/journeys/${params.journeyId}`) : api.get(`/api/bookings/${params.bookingId}`),
      ]);
      const nextAccounts: BankAccount[] = (accountResponse.data || []).map((account: any) => ({ ...account, balance: Number(account.balance) }));
      setAccounts(nextAccounts);
      const booking = bookingResponse.data;
      const total = Number(booking.total_fare || params.amount);
      const saved = Number(booking.discount_amount || 0);
      setGross(total); setDiscount(saved); setAmount(Math.max(0, total - saved));
      if (booking.promo_code) setPromoApplied(booking.promo_code);
      const expiry = booking.expires_at || params.expiresAt;
      setRemaining(secondsRemaining(expiry));
      // Preselect the first method the user can actually pay with.
      const usable = METHODS.find((item) => accountForMethod(nextAccounts, item.id));
      setMethod(usable ? usable.id : 'BKASH');
      const wallet = accountForMethod(nextAccounts, usable?.id || 'BKASH');
      if (wallet?.account_type === 'MOBILE' && wallet.account_number) setPhone(wallet.account_number);
    } catch (reason: any) { setError(reason.message || 'Could not prepare payment.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (loading || remaining <= 0) return;
    const timer = setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [loading, remaining > 0]);

  const activeAccount = method ? accountForMethod(accounts, method) : undefined;
  const insufficient = !!activeAccount && activeAccount.balance < totalDue;
  const expired = remaining <= 0;

  const selectMethod = (next: Method) => {
    setMethod(next);
    const wallet = accountForMethod(accounts, next);
    if (wallet?.account_type === 'MOBILE' && wallet.account_number) setPhone(wallet.account_number);
  };

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
    if (!method) return;
    if (expired) return Alert.alert('Seat hold expired', 'Return to search and select seats again.', [{ text: 'Return home', onPress: () => navigation.popToTop() }]);
    if (!activeAccount) return Alert.alert('No matching account', `No ${method === 'CARD' ? 'bank' : METHODS.find((item) => item.id === method)?.label} account is linked to your BusGo wallet.`);
    if ((method === 'BKASH' || method === 'NAGAD') && !/^01\d{9}$/.test(phone.replace(/\D/g, '').slice(-11))) return Alert.alert('Wallet number', 'Enter the 11-digit mobile number linked to your BusGo wallet.');
    if ((method === 'BKASH' || method === 'NAGAD') && pin.length < 4) return Alert.alert('Wallet PIN', 'Enter your wallet PIN.');
    if (insufficient) return Alert.alert('Insufficient balance', `This checkout needs ${money(totalDue)}. Available: ${money(activeAccount.balance)}.`);
    setBusy(true);
    const credentials = method !== 'CARD' ? { mobile_number: phone.replace(/\D/g, '').slice(-11), pin } : {};
    try {
      if (params.mode === 'transit') {
        setPayingLabel('Charging your journey…');
        const initiated = await api.post('/api/payments/initiate', { booking_id: params.bookingId, trip_id: params.tripId, journey_id: params.journeyId, amount, method, ...credentials });
        // The durable payment.completed event also confirms server-side; this
        // inline confirm only makes the UI fast, so its failure is tolerated.
        try { await api.post(`/api/bookings/journeys/${params.journeyId}/confirm-payment?payment_id=${initiated.data.payment_id}`); } catch { /* reconciled on Confirmation */ }
      } else {
        setPayingLabel(isRoundTrip ? 'Charging outbound trip…' : 'Charging your trip…');
        const initiated = await api.post('/api/payments/initiate', { booking_id: params.bookingId, trip_id: params.tripId, amount, method, ...credentials });
        try { await api.post(`/api/bookings/${params.bookingId}/confirm-payment?payment_id=${initiated.data.payment_id}`); } catch { /* reconciled on Confirmation */ }
        if (isRoundTrip && params.returnBookingId) {
          setPayingLabel('Charging return trip…');
          const initiatedReturn = await api.post('/api/payments/initiate', { booking_id: params.returnBookingId, trip_id: params.returnTripId, amount: returnAmount, method, ...credentials });
          try { await api.post(`/api/bookings/${params.returnBookingId}/confirm-payment?payment_id=${initiatedReturn.data.payment_id}`); } catch { /* reconciled on Confirmation */ }
        }
      }
      // Confirmation verifies real server state before announcing success (P0.3).
      navigation.replace('Confirmation', { mode: params.mode, bookingId: params.bookingId, journeyId: params.journeyId, returnBookingId: params.returnBookingId, origin: params.origin, destination: params.destination, amount: totalDue });
    } catch (reason: any) {
      const released = reason.status === 402 || reason.status === 403 || reason.status >= 500 || reason.status === 0;
      Alert.alert('Payment failed', `${reason.message}${released ? '\n\nThe seat hold was released. Please make a new booking.' : ''}`, released ? [{ text: 'Return home', onPress: () => navigation.popToTop() }] : undefined);
    } finally { setBusy(false); setPayingLabel(''); }
  };

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}><Loading label="Preparing secure payment…" /></View>;
  if (!user?.phone?.trim()) return <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: colors.bg }}><Card><Text style={{ fontSize: 19, fontWeight: '900', color: colors.text }}>Phone number required</Text><Text style={{ color: colors.subtext, lineHeight: 20, marginTop: 7, marginBottom: 16 }}>Add your phone number to synchronize the wallet used for this payment.</Text><Button title="Add phone and return" icon="call-outline" onPress={() => navigation.replace('PhoneSetup', { resumePayment: params })} /></Card></View>;
  if (error) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}><ErrorState title="Payment unavailable" message={error} onRetry={load} /></View>;

  return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
    <Card style={{ marginBottom: 14 }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text }}>{params.origin} → {params.destination}{isRoundTrip ? ` → ${params.origin}` : ''}</Text>
          {params.mode === 'transit' ? <Badge tone="primary" text={`${params.legs?.length || 2}-bus journey · one payment`} /> : null}
          {isRoundTrip ? <Badge tone="primary" text="Round trip · one checkout" /> : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {discount > 0 ? <Text style={{ color: colors.faint, textDecorationLine: 'line-through' }}>{money(gross + returnAmount)}</Text> : null}
          <Text style={{ fontWeight: '900', fontSize: 22, color: colors.primary }}>{money(totalDue)}</Text>
        </View>
      </Row>
      {isRoundTrip ? <View style={{ marginTop: 8 }}>
        <Row style={{ justifyContent: 'space-between' }}><Text style={{ fontSize: 12, color: colors.subtext }}>Outbound</Text><Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{money(amount)}</Text></Row>
        <Row style={{ justifyContent: 'space-between', marginTop: 3 }}><Text style={{ fontSize: 12, color: colors.subtext }}>Return</Text><Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{money(returnAmount)}</Text></Row>
      </View> : null}
      <Row style={{ gap: 6, marginTop: 12, alignSelf: 'flex-start', backgroundColor: expired ? colors.dangerSoft : colors.warnSoft, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 }}><Ionicons name="time-outline" size={15} color={expired ? colors.danger : colors.warn} /><Text style={{ fontSize: 12, fontWeight: '800', color: expired ? colors.danger : colors.warn }}>{expired ? 'Seat hold expired' : `Complete payment within ${countdown(remaining)}`}</Text></Row>
    </Card>

    <Card style={{ marginBottom: 14 }}>
      <Text style={{ fontWeight: '800', color: colors.text, marginBottom: 10 }}>Payment method</Text>
      <Row style={{ gap: 8 }}>{METHODS.map((item) => {
        const available = !!accountForMethod(accounts, item.id);
        const selected = method === item.id;
        return <Pressable key={item.id} disabled={!available} onPress={() => selectMethod(item.id)} style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.md, borderWidth: 2, borderColor: selected ? item.brand : colors.border, backgroundColor: selected ? `${item.brand}14` : '#fff', opacity: available ? 1 : 0.4 }}>
          <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: item.brand, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={item.icon} size={19} color="#fff" /></View>
          <Text style={{ fontWeight: '800', fontSize: 12, marginTop: 6, color: selected ? item.brand : colors.text }}>{item.label}</Text>
          {selected ? <View style={{ position: 'absolute', top: 6, right: 6 }}><Ionicons name="checkmark-circle" size={15} color={item.brand} /></View> : null}
          {!available ? <Text style={{ fontSize: 9, color: colors.faint, marginTop: 2 }}>Not linked</Text> : null}
        </Pressable>;
      })}</Row>
      {activeAccount ? <Row style={{ justifyContent: 'space-between', marginTop: 14, padding: 10, backgroundColor: '#f8fafc', borderRadius: radius.md }}><View><Text style={{ fontWeight: '700', color: colors.text }}>{activeAccount.provider}</Text><Text style={{ fontSize: 11, color: colors.subtext }}>{activeAccount.account_number}</Text></View><Text style={{ fontWeight: '900', color: insufficient ? colors.danger : colors.success }}>{money(activeAccount.balance)}</Text></Row>
        : <Row style={{ gap: 7, marginTop: 14, padding: 10, backgroundColor: colors.warnSoft, borderRadius: radius.md }}><Ionicons name="alert-circle-outline" size={16} color={colors.warn} /><Text style={{ flex: 1, fontSize: 12, color: colors.warn }}>No {method === 'CARD' ? 'bank' : METHODS.find((item) => item.id === method)?.label} account is linked to your wallet. It is registered automatically from your profile phone number — check your phone number in Profile, or pick another method.</Text></Row>}
      {method !== 'CARD' ? <View style={{ marginTop: 14 }}><Input label={`${METHODS.find((item) => item.id === method)?.label} number`} value={phone} editable={false} keyboardType="phone-pad" placeholder="01XXXXXXXXX" maxLength={14} /><Text style={{ color: colors.faint, fontSize: 11, marginTop: -8, marginBottom: 12 }}>This number is synchronized from your BusGo wallet account.</Text><Input label="PIN" value={pin} onChangeText={(value) => setPin(value.replace(/\D/g, ''))} secureTextEntry keyboardType="number-pad" placeholder="Wallet PIN" maxLength={8} /></View> : <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 12 }}>Your linked bank account will be charged.</Text>}
    </Card>

    {params.mode === 'direct' && !isRoundTrip ? <Card style={{ marginBottom: 14 }}><Text style={{ fontWeight: '800', color: colors.text, marginBottom: 10 }}>Promo code</Text>{promoApplied ? <Row style={{ justifyContent: 'space-between' }}><Badge tone="success" text={`${promoApplied} · saved ${money(discount)}`} /><Button title="Remove" variant="ghost" onPress={removePromo} /></Row> : <Row style={{ gap: 8, alignItems: 'flex-start' }}><View style={{ flex: 1 }}><Input value={promo} onChangeText={(value) => setPromo(value.toUpperCase())} placeholder="Enter code" autoCapitalize="characters" /></View><Button title="Apply" variant="outline" onPress={applyPromo} style={{ paddingHorizontal: 18 }} /></Row>}</Card> : null}
    <Button title={expired ? 'Seat hold expired' : busy && payingLabel ? payingLabel : `Pay ${money(totalDue)}`} icon="lock-closed-outline" onPress={pay} loading={busy} disabled={expired || insufficient || !activeAccount} />
    {insufficient ? <Text style={{ color: colors.danger, fontSize: 12, textAlign: 'center', marginTop: 8 }}>Your selected account does not have enough balance for {money(totalDue)}.</Text> : null}
  </ScrollView>;
}
