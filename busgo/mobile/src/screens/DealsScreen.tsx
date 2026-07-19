import React, { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { Badge, Card, Empty, ErrorState, Loading, Row, SectionTitle } from '../components/ui';
import { FlashSale, Promo } from '../types/api';
import { colors } from '../theme';
import { money, shortDate } from '../utils/format';

export default function DealsScreen() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [sales, setSales] = useState<FlashSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      const [promoResponse, saleResponse] = await Promise.all([api.get<Promo[]>('/api/deals/promos/'), api.get<FlashSale[]>('/api/deals/flash-sales/active')]);
      // Web parity: the website lists every active promo without hiding ones
      // past valid_until, so the app shows the same set.
      setPromos((Array.isArray(promoResponse) ? promoResponse : []).filter((promo) => promo.is_active));
      setSales(Array.isArray(saleResponse) ? saleResponse : []);
    } catch (reason: any) { setError(reason.message || 'Could not load current deals.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const copy = async (code: string) => { await Clipboard.setStringAsync(code); Alert.alert('Promo copied', `${code} is ready to use at payment.`); };
  return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 30 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
    <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }}>Deals and promo codes</Text><Text style={{ color: colors.subtext, fontSize: 13, marginTop: 3, marginBottom: 16 }}>Copy a code and apply it before payment.</Text>
    {loading ? <Loading label="Loading deals…" /> : error ? <ErrorState message={error} onRetry={() => { setLoading(true); load(); }} /> : null}
    {!loading && !error && sales.length > 0 ? <><SectionTitle title="Flash sales" />{sales.map((sale) => <Card key={sale.id} style={{ marginBottom: 12, backgroundColor: '#fff7ed', borderColor: '#fed7aa' }}><Row style={{ justifyContent: 'space-between' }}><View style={{ flex: 1 }}><Text style={{ fontWeight: '900', color: colors.text }}>{sale.name}</Text>{sale.description ? <Text style={{ color: colors.subtext, fontSize: 12, marginTop: 3 }}>{sale.description}</Text> : null}</View><Badge tone="warn" text={`${sale.discount_percentage}% OFF`} /></Row><Text style={{ color: colors.warn, fontSize: 11, marginTop: 8 }}>Ends {shortDate(sale.end_time)}</Text></Card>)}</> : null}
    {!loading && !error ? <SectionTitle title="Promo codes" /> : null}
    {!loading && !error && !promos.length && !sales.length ? <Empty title="No active deals" subtitle="New offers will appear here automatically." /> : null}
    {promos.map((promo) => { const remaining = Math.max(0, promo.max_uses - promo.current_uses); return <Card key={promo.id} style={{ marginBottom: 12 }}><Row style={{ justifyContent: 'space-between', marginBottom: 8 }}><Badge tone="primary" text={promo.discount_type === 'PERCENTAGE' ? `${promo.discount_value}% OFF` : `${money(promo.discount_value)} OFF`} /><Text style={{ fontSize: 11, color: colors.faint }}>{remaining} uses left</Text></Row><Text style={{ fontWeight: '900', color: colors.text }}>{promo.title || 'BusGo discount'}</Text>{promo.description ? <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 3 }}>{promo.description}</Text> : null}<Pressable accessibilityLabel={`Copy promo ${promo.code}`} onPress={() => copy(promo.code)} style={{ borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primary, backgroundColor: colors.primarySoft, borderRadius: 10, paddingVertical: 11, marginVertical: 10 }}><Row style={{ justifyContent: 'center', gap: 8 }}><Text style={{ fontWeight: '900', fontSize: 18, letterSpacing: 2, color: colors.primaryDark }}>{promo.code}</Text><Ionicons name="copy-outline" size={18} color={colors.primary} /></Row></Pressable><Row style={{ justifyContent: 'space-between' }}><Text style={{ fontSize: 11, color: colors.subtext }}>{promo.min_fare > 0 ? `Minimum ${money(promo.min_fare)}` : 'No minimum fare'}</Text><Text style={{ fontSize: 11, color: colors.subtext }}>Until {shortDate(promo.valid_until)}</Text></Row></Card>; })}
  </ScrollView>;
}
