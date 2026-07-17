import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { api } from '../api/client';
import { Badge, Button, Card, Input, Loading, Row } from '../components/ui';
import { colors, radius } from '../theme';
import { ScreenProps } from '../nav';

type Method = 'BKASH' | 'NAGAD' | 'CARD';

interface BankAccount {
  id: string;
  account_type: 'MOBILE' | 'BANK';
  provider: string;
  account_number: string;
  balance: number;
}

const METHODS: { id: Method; label: string; icon: string; funds: 'MOBILE' | 'BANK' }[] = [
  { id: 'BKASH', label: 'bKash', icon: '📱', funds: 'MOBILE' },
  { id: 'NAGAD', label: 'Nagad', icon: '📲', funds: 'MOBILE' },
  { id: 'CARD', label: 'Card', icon: '💳', funds: 'BANK' },
];

export default function PaymentScreen({ route, navigation }: ScreenProps<'Payment'>) {
  const p = route.params;
  const [method, setMethod] = useState<Method>('BKASH');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [amount, setAmount] = useState<number>(p.amount);
  const [discount, setDiscount] = useState(0);
  const [promo, setPromo] = useState('');
  const [promoApplied, setPromoApplied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const acc = await api.get('/api/bank/accounts/my');
        setAccounts((acc.data || []).map((a: any) => ({ ...a, balance: Number(a.balance) })));
      } catch {
        /* accounts are optional info */
      }
      // Authoritative total
      try {
        if (p.mode === 'transit' && p.journeyId) {
          const j = await api.get(`/api/bookings/journeys/${p.journeyId}`);
          setAmount(Number(j.data.final_fare));
        } else {
          const b = await api.get(`/api/bookings/${p.bookingId}`);
          const gross = Number(b.data.total_fare);
          const disc = Number(b.data.discount_amount || 0);
          setAmount(gross - disc);
          setDiscount(disc);
          if (b.data.promo_code) setPromoApplied(b.data.promo_code);
        }
      } catch {
        /* fall back to navigation param */
      }
      setLoading(false);
    })();
  }, []);

  const active = accounts.find((a) => a.account_type === METHODS.find((m) => m.id === method)?.funds);
  const insufficient = !!active && active.balance < amount;

  const applyPromo = async () => {
    const code = promo.trim().toUpperCase();
    if (!code) return;
    try {
      const res = await api.post(`/api/bookings/${p.bookingId}/apply-promo`, { promo_code: code });
      const d = res.data;
      setAmount(Number(d.final_fare));
      setDiscount(Number(d.discount_amount));
      setPromoApplied(d.promo_code || code);
      Alert.alert('Promo applied', `You saved ৳${d.discount_amount}!`);
    } catch (e: any) {
      Alert.alert('Promo failed', e.message);
    }
  };

  const pay = async () => {
    if ((method === 'BKASH' || method === 'NAGAD') && (!phone || !pin)) {
      Alert.alert('Missing info', 'Enter your mobile wallet number and PIN.');
      return;
    }
    if (insufficient) {
      Alert.alert('Insufficient balance', `Your ${active?.provider} account has ৳${active?.balance}.`);
      return;
    }
    setBusy(true);
    try {
      const initBody: any = {
        booking_id: p.bookingId,
        trip_id: p.tripId,
        amount,
        method,
      };
      if (p.mode === 'transit') initBody.journey_id = p.journeyId;
      if (method === 'BKASH' || method === 'NAGAD') {
        initBody.mobile_number = phone.trim();
        initBody.pin = pin;
      }
      const init = await api.post('/api/payments/initiate', initBody);
      const paymentId = init.data.payment_id;

      if (p.mode === 'transit') {
        await api.post(`/api/bookings/journeys/${p.journeyId}/confirm-payment?payment_id=${paymentId}`);
      } else {
        await api.post(`/api/bookings/${p.bookingId}/confirm-payment?payment_id=${paymentId}`);
      }
      navigation.replace('Confirmation', {
        mode: p.mode,
        bookingId: p.bookingId,
        journeyId: p.journeyId,
        origin: p.origin,
        destination: p.destination,
        amount,
      });
    } catch (e: any) {
      // Definitive failures release the held seats server-side.
      if (e.status === 402 || e.status === 403 || e.status >= 500 || e.status === 0) {
        Alert.alert('Payment failed', `${e.message}\n\nYour held seats have been released — please book again.`, [
          { text: 'OK', onPress: () => navigation.popToTop() },
        ]);
      } else {
        Alert.alert('Payment failed', e.message);
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <Loading label="Preparing payment…" />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Card style={{ marginBottom: 14 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text }}>
              {p.origin} → {p.destination}
            </Text>
            {p.mode === 'transit' && <Badge tone="primary" text={`${p.legs?.length || 2}-bus journey · one payment`} />}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {discount > 0 && (
              <Text style={{ color: colors.faint, fontSize: 12, textDecorationLine: 'line-through' }}>
                ৳{amount + discount}
              </Text>
            )}
            <Text style={{ fontWeight: '900', fontSize: 22, color: colors.primary }}>৳{amount}</Text>
          </View>
        </Row>
        <Text style={{ fontSize: 11, color: colors.warn, marginTop: 8 }}>
          ⏱ Seats are held for 10 minutes. Complete payment to confirm.
        </Text>
      </Card>

      {/* Accounts */}
      {accounts.length > 0 && (
        <Card style={{ marginBottom: 14 }}>
          <Text style={{ fontWeight: '800', color: colors.text, marginBottom: 10 }}>Your accounts</Text>
          {accounts.map((a) => {
            const isActive = a.account_type === METHODS.find((m) => m.id === method)?.funds;
            const low = isActive && a.balance < amount;
            return (
              <Row key={a.id} style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                <View>
                  <Text style={{ fontWeight: '700', color: colors.text, fontSize: 13 }}>
                    {a.account_type === 'MOBILE' ? '📱' : '🏦'} {a.provider}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.faint }}>{a.account_number}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontWeight: '800', color: low ? colors.danger : colors.text }}>
                    ৳{a.balance.toLocaleString()}
                  </Text>
                  {isActive && (
                    <Text style={{ fontSize: 10, color: low ? colors.danger : colors.success }}>
                      {low ? 'Insufficient' : 'Will be charged'}
                    </Text>
                  )}
                </View>
              </Row>
            );
          })}
        </Card>
      )}

      {/* Method */}
      <Card style={{ marginBottom: 14 }}>
        <Text style={{ fontWeight: '800', color: colors.text, marginBottom: 10 }}>Payment method</Text>
        <Row style={{ gap: 8 }}>
          {METHODS.map((m) => (
            <Pressable
              key={m.id}
              onPress={() => setMethod(m.id)}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 12,
                borderRadius: radius.md,
                borderWidth: 2,
                borderColor: method === m.id ? colors.primary : colors.border,
                backgroundColor: method === m.id ? colors.primarySoft : '#fff',
              }}
            >
              <Text style={{ fontSize: 20 }}>{m.icon}</Text>
              <Text style={{ fontWeight: '800', fontSize: 12, marginTop: 4, color: method === m.id ? colors.primary : colors.text }}>
                {m.label}
              </Text>
            </Pressable>
          ))}
        </Row>

        {(method === 'BKASH' || method === 'NAGAD') && (
          <View style={{ marginTop: 14 }}>
            <Input
              label={`${method === 'BKASH' ? 'bKash' : 'Nagad'} number`}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="01XXXXXXXXX"
            />
            <Input label="PIN" value={pin} onChangeText={setPin} secureTextEntry keyboardType="number-pad" placeholder="Default: 1234" />
          </View>
        )}
        {method === 'CARD' && (
          <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 12 }}>
            Your linked bank account will be charged directly.
          </Text>
        )}
      </Card>

      {/* Promo — direct bookings only (journeys take the operator route discount) */}
      {p.mode === 'direct' && (
        <Card style={{ marginBottom: 14 }}>
          <Text style={{ fontWeight: '800', color: colors.text, marginBottom: 10 }}>Promo code</Text>
          {promoApplied ? (
            <Row style={{ justifyContent: 'space-between' }}>
              <Badge tone="success" text={`${promoApplied} applied — saved ৳${discount}`} />
            </Row>
          ) : (
            <Row style={{ gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Input value={promo} onChangeText={(v) => setPromo(v.toUpperCase())} placeholder="e.g. BUSGO20" autoCapitalize="characters" />
              </View>
              <Button title="Apply" variant="outline" onPress={applyPromo} style={{ paddingHorizontal: 18, height: 47 }} />
            </Row>
          )}
        </Card>
      )}

      <Button title={busy ? 'Processing…' : `Pay ৳${amount}`} onPress={pay} loading={busy} disabled={insufficient} />
      {insufficient && (
        <Text style={{ color: colors.danger, fontSize: 12, textAlign: 'center', marginTop: 8 }}>
          Insufficient balance in your {active?.provider} account.
        </Text>
      )}
    </ScrollView>
  );
}
