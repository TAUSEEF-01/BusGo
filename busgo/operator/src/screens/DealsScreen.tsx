import React, { useCallback, useState } from 'react';
import { Alert, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { useAuth } from '../store/auth';
import { Badge, Button, Card, Empty, ErrorState, Input, Loading, Row } from '../components/ui';
import { colors, radius } from '../theme';
import { money, shortDate } from '../utils/format';
import type { FlashSale, Promo } from '../types';

type Segment = 'promos' | 'sales';

const EMPTY_PROMO = { code: '', title: '', description: '', discount_type: 'PERCENTAGE' as 'PERCENTAGE' | 'FLAT', discount_value: '10', min_fare: '0', max_uses: '100', valid_until: null as Date | null };
const EMPTY_SALE = { name: '', description: '', discount_percentage: '10', start_time: new Date(), end_time: new Date(Date.now() + 3 * 86400000) };

export default function DealsScreen() {
  const { user } = useAuth();
  const [segment, setSegment] = useState<Segment>('promos');
  const [promos, setPromos] = useState<Promo[]>([]);
  const [sales, setSales] = useState<FlashSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [promoOpen, setPromoOpen] = useState(false);
  const [promoEditId, setPromoEditId] = useState<string | null>(null);
  const [promoForm, setPromoForm] = useState(EMPTY_PROMO);
  const [showPromoDate, setShowPromoDate] = useState(false);

  const [saleOpen, setSaleOpen] = useState(false);
  const [saleEditId, setSaleEditId] = useState<string | null>(null);
  const [saleForm, setSaleForm] = useState(EMPTY_SALE);
  const [showSaleDate, setShowSaleDate] = useState<'start' | 'end' | null>(null);

  const load = useCallback(async () => {
    setError('');
    const [promosR, salesR] = await Promise.allSettled([
      api.get<Promo[]>(`/api/deals/promos/?operator_id=${user?.id}`),
      api.get<FlashSale[]>(`/api/deals/flash-sales?operator_id=${user?.id}`),
    ]);
    if (promosR.status === 'fulfilled') setPromos(Array.isArray(promosR.value) ? promosR.value : []);
    else setError((promosR.reason as any)?.message || 'Could not load deals.');
    if (salesR.status === 'fulfilled') setSales(Array.isArray(salesR.value) ? salesR.value : []);
    setLoading(false); setRefreshing(false);
  }, [user]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openPromo = (promo?: Promo) => {
    if (promo) {
      setPromoEditId(promo.id);
      setPromoForm({ code: promo.code, title: promo.title || '', description: promo.description || '', discount_type: promo.discount_type === 'FLAT' ? 'FLAT' : 'PERCENTAGE', discount_value: String(promo.discount_value), min_fare: String(promo.min_fare), max_uses: String(promo.max_uses), valid_until: promo.valid_until ? new Date(promo.valid_until) : null });
    } else { setPromoEditId(null); setPromoForm(EMPTY_PROMO); }
    setPromoOpen(true);
  };

  const savePromo = async () => {
    if (!promoForm.code.trim() || promoForm.code.trim().length < 3) return Alert.alert('Promo', 'Enter a promo code (3+ characters).');
    const value = Number(promoForm.discount_value);
    if (!value || value <= 0) return Alert.alert('Promo', 'Enter a valid discount value.');
    if (promoForm.discount_type === 'PERCENTAGE' && value > 90) return Alert.alert('Promo', 'Percentage discount cannot exceed 90%.');
    setSaving(true);
    const payload: any = {
      code: promoForm.code.trim().toUpperCase(), title: promoForm.title.trim() || null, description: promoForm.description.trim() || null,
      discount_type: promoForm.discount_type, discount_value: value, min_fare: Number(promoForm.min_fare) || 0,
      max_uses: Number(promoForm.max_uses) || 100, is_active: true, operator_id: user?.id,
      valid_until: promoForm.valid_until ? promoForm.valid_until.toISOString() : null,
    };
    try {
      if (promoEditId) await api.put(`/api/deals/promos/${promoEditId}`, payload);
      else await api.post('/api/deals/promos/', payload);
      setPromoOpen(false); setLoading(true); await load();
    } catch (reason: any) { Alert.alert('Could not save promo', reason.message); }
    finally { setSaving(false); }
  };

  const togglePromo = async (promo: Promo) => {
    try { await api.put(`/api/deals/promos/${promo.id}`, { is_active: !promo.is_active }); load(); }
    catch (reason: any) { Alert.alert('Could not update promo', reason.message); }
  };

  const removePromo = (promo: Promo) => Alert.alert('Delete promo?', `${promo.code} will be removed.`, [
    { text: 'Keep', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { try { await api.del(`/api/deals/promos/${promo.id}`); load(); } catch (reason: any) { Alert.alert('Could not delete', reason.message); } } },
  ]);

  const openSale = (sale?: FlashSale) => {
    if (sale) { setSaleEditId(sale.id); setSaleForm({ name: sale.name, description: sale.description || '', discount_percentage: String(sale.discount_percentage), start_time: new Date(sale.start_time), end_time: new Date(sale.end_time) }); }
    else { setSaleEditId(null); setSaleForm(EMPTY_SALE); }
    setSaleOpen(true);
  };

  const saveSale = async () => {
    if (!saleForm.name.trim()) return Alert.alert('Flash sale', 'Enter a sale name.');
    const pct = Number(saleForm.discount_percentage);
    if (!pct || pct <= 0 || pct > 90) return Alert.alert('Flash sale', 'Discount must be between 1% and 90%.');
    if (saleForm.end_time.getTime() <= saleForm.start_time.getTime()) return Alert.alert('Flash sale', 'End time must be after start time.');
    setSaving(true);
    const payload: any = {
      name: saleForm.name.trim(), description: saleForm.description.trim() || null, discount_percentage: pct,
      start_time: saleForm.start_time.toISOString(), end_time: saleForm.end_time.toISOString(), is_active: true, operator_id: user?.id,
    };
    try {
      if (saleEditId) await api.put(`/api/deals/flash-sales/${saleEditId}`, payload);
      else await api.post('/api/deals/flash-sales/', payload);
      setSaleOpen(false); setLoading(true); await load();
    } catch (reason: any) { Alert.alert('Could not save flash sale', reason.message); }
    finally { setSaving(false); }
  };

  const removeSale = (sale: FlashSale) => Alert.alert('Delete flash sale?', `${sale.name} will be removed.`, [
    { text: 'Keep', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { try { await api.del(`/api/deals/flash-sales/${sale.id}`); load(); } catch (reason: any) { Alert.alert('Could not delete', reason.message); } } },
  ]);

  return <View style={{ flex: 1, backgroundColor: colors.bg }}>
    <View style={styles.segment}>{(['promos', 'sales'] as Segment[]).map((item) => <Pressable key={item} onPress={() => setSegment(item)} style={[styles.segmentButton, segment === item && styles.segmentActive]}>
      <Text style={{ fontWeight: '800', fontSize: 13, color: segment === item ? '#fff' : colors.subtext }}>{item === 'promos' ? `Promo codes (${promos.length})` : `Flash sales (${sales.length})`}</Text>
    </Pressable>)}</View>

    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 90 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      {loading ? <Loading label="Loading deals…" /> : error ? <ErrorState message={error} onRetry={() => { setLoading(true); load(); }} /> : null}

      {!loading && !error && segment === 'promos' ? (!promos.length ? <Empty title="No promo codes" subtitle="Create a code your passengers can apply at checkout." icon="pricetags-outline" /> : promos.map((promo) => <Card key={promo.id} style={{ marginBottom: 10 }}>
        <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ fontWeight: '900', fontSize: 16, letterSpacing: 1.5, color: colors.primaryDark }}>{promo.code}</Text>
          <Badge tone={promo.discount_type === 'PERCENTAGE' ? 'primary' : 'info'} text={promo.discount_type === 'PERCENTAGE' ? `${promo.discount_value}% OFF` : `${money(promo.discount_value)} OFF`} />
        </Row>
        {promo.title ? <Text style={{ fontWeight: '700', color: colors.text }}>{promo.title}</Text> : null}
        <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 2 }}>{promo.current_uses}/{promo.max_uses} used · min {money(promo.min_fare)}{promo.valid_until ? ` · until ${shortDate(promo.valid_until)}` : ''}</Text>
        <Row style={{ justifyContent: 'space-between', marginTop: 10, borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: 9 }}>
          <Row style={{ gap: 7 }}>
            <Switch value={promo.is_active} onValueChange={() => togglePromo(promo)} trackColor={{ true: colors.primary }} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: promo.is_active ? colors.success : colors.faint }}>{promo.is_active ? 'Active' : 'Paused'}</Text>
          </Row>
          <Row style={{ gap: 12 }}>
            <Pressable hitSlop={8} onPress={() => openPromo(promo)}><Ionicons name="create-outline" size={20} color={colors.subtext} /></Pressable>
            <Pressable hitSlop={8} onPress={() => removePromo(promo)}><Ionicons name="trash-outline" size={19} color={colors.danger} /></Pressable>
          </Row>
        </Row>
      </Card>)) : null}

      {!loading && !error && segment === 'sales' ? (!sales.length ? <Empty title="No flash sales" subtitle="Run a limited-time percentage discount across your trips." icon="flash-outline" /> : sales.map((sale) => <Card key={sale.id} style={{ marginBottom: 10 }}>
        <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontWeight: '900', color: colors.text, flex: 1, marginRight: 8 }}>{sale.name}</Text>
          <Badge tone="warn" text={`${sale.discount_percentage}% OFF`} />
        </Row>
        {sale.description ? <Text style={{ fontSize: 12, color: colors.subtext }}>{sale.description}</Text> : null}
        <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 3 }}>{shortDate(sale.start_time)} → {shortDate(sale.end_time)}</Text>
        <Row style={{ justifyContent: 'flex-end', gap: 12, marginTop: 10, borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: 9 }}>
          <Pressable hitSlop={8} onPress={() => openSale(sale)}><Ionicons name="create-outline" size={20} color={colors.subtext} /></Pressable>
          <Pressable hitSlop={8} onPress={() => removeSale(sale)}><Ionicons name="trash-outline" size={19} color={colors.danger} /></Pressable>
        </Row>
      </Card>)) : null}
    </ScrollView>

    <Pressable onPress={() => segment === 'promos' ? openPromo() : openSale()} style={styles.fab}><Ionicons name="add" size={26} color="#fff" /></Pressable>

    {/* Promo sheet */}
    <Modal visible={promoOpen} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setPromoOpen(false)}>
      <View style={styles.overlay}>
        <Pressable style={{ flex: 1 }} onPress={() => setPromoOpen(false)} />
        <View style={styles.sheet}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 14 }}>
            <Text style={{ fontSize: 19, fontWeight: '900', color: colors.text }}>{promoEditId ? 'Edit promo' : 'New promo code'}</Text>
            <Pressable onPress={() => setPromoOpen(false)} style={styles.close}><Ionicons name="close" size={20} color={colors.text} /></Pressable>
          </Row>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Input label="Code" value={promoForm.code} onChangeText={(value) => setPromoForm({ ...promoForm, code: value.toUpperCase() })} placeholder="EID25" autoCapitalize="characters" />
            <Input label="Title (optional)" value={promoForm.title} onChangeText={(value) => setPromoForm({ ...promoForm, title: value })} placeholder="Eid special" />
            <Input label="Description (optional)" value={promoForm.description} onChangeText={(value) => setPromoForm({ ...promoForm, description: value })} placeholder="Save on every route this Eid" />
            <Text style={styles.label}>Discount type</Text>
            <Row style={{ gap: 8, marginBottom: 12 }}>
              {(['PERCENTAGE', 'FLAT'] as const).map((type) => <Pressable key={type} onPress={() => setPromoForm({ ...promoForm, discount_type: type })} style={[styles.typeChip, promoForm.discount_type === type && styles.typeChipActive]}>
                <Text style={{ fontWeight: '800', fontSize: 12, color: promoForm.discount_type === type ? '#fff' : colors.text }}>{type === 'PERCENTAGE' ? 'Percentage %' : 'Flat ৳'}</Text>
              </Pressable>)}
            </Row>
            <Row style={{ gap: 10 }}>
              <View style={{ flex: 1 }}><Input label={promoForm.discount_type === 'PERCENTAGE' ? 'Discount (%)' : 'Discount (৳)'} value={promoForm.discount_value} onChangeText={(value) => setPromoForm({ ...promoForm, discount_value: value.replace(/\D/g, '') })} keyboardType="number-pad" /></View>
              <View style={{ flex: 1 }}><Input label="Minimum fare (৳)" value={promoForm.min_fare} onChangeText={(value) => setPromoForm({ ...promoForm, min_fare: value.replace(/\D/g, '') })} keyboardType="number-pad" /></View>
            </Row>
            <Row style={{ gap: 10 }}>
              <View style={{ flex: 1 }}><Input label="Max uses" value={promoForm.max_uses} onChangeText={(value) => setPromoForm({ ...promoForm, max_uses: value.replace(/\D/g, '') })} keyboardType="number-pad" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Valid until</Text>
                <Pressable onPress={() => setShowPromoDate(true)} style={styles.dateField}><Text style={{ fontWeight: '700', color: promoForm.valid_until ? colors.text : colors.faint }}>{promoForm.valid_until ? shortDate(promoForm.valid_until.toISOString()) : 'No expiry'}</Text></Pressable>
              </View>
            </Row>
            <Button title={promoEditId ? 'Save changes' : 'Create promo'} icon="checkmark" onPress={savePromo} loading={saving} style={{ marginTop: 4 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>

    {/* Flash sale sheet */}
    <Modal visible={saleOpen} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setSaleOpen(false)}>
      <View style={styles.overlay}>
        <Pressable style={{ flex: 1 }} onPress={() => setSaleOpen(false)} />
        <View style={styles.sheet}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 14 }}>
            <Text style={{ fontSize: 19, fontWeight: '900', color: colors.text }}>{saleEditId ? 'Edit flash sale' : 'New flash sale'}</Text>
            <Pressable onPress={() => setSaleOpen(false)} style={styles.close}><Ionicons name="close" size={20} color={colors.text} /></Pressable>
          </Row>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Input label="Name" value={saleForm.name} onChangeText={(value) => setSaleForm({ ...saleForm, name: value })} placeholder="Weekend rush sale" />
            <Input label="Description (optional)" value={saleForm.description} onChangeText={(value) => setSaleForm({ ...saleForm, description: value })} placeholder="All routes discounted" />
            <Input label="Discount (%)" value={saleForm.discount_percentage} onChangeText={(value) => setSaleForm({ ...saleForm, discount_percentage: value.replace(/\D/g, '') })} keyboardType="number-pad" maxLength={2} />
            <Row style={{ gap: 10, marginBottom: 12 }}>
              <Pressable onPress={() => setShowSaleDate('start')} style={[styles.dateField, { flex: 1 }]}><Text style={{ fontSize: 10, fontWeight: '800', color: colors.faint }}>STARTS</Text><Text style={{ fontWeight: '700', color: colors.text }}>{shortDate(saleForm.start_time.toISOString())}</Text></Pressable>
              <Pressable onPress={() => setShowSaleDate('end')} style={[styles.dateField, { flex: 1 }]}><Text style={{ fontSize: 10, fontWeight: '800', color: colors.faint }}>ENDS</Text><Text style={{ fontWeight: '700', color: colors.text }}>{shortDate(saleForm.end_time.toISOString())}</Text></Pressable>
            </Row>
            <Button title={saleEditId ? 'Save changes' : 'Launch flash sale'} icon="flash" onPress={saveSale} loading={saving} />
          </ScrollView>
        </View>
      </View>
    </Modal>

    {showPromoDate && <DateTimePicker value={promoForm.valid_until || new Date()} minimumDate={new Date()} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(_, selected) => { setShowPromoDate(false); if (selected) setPromoForm({ ...promoForm, valid_until: selected }); }} />}
    {showSaleDate && <DateTimePicker value={showSaleDate === 'start' ? saleForm.start_time : saleForm.end_time} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(_, selected) => { const which = showSaleDate; setShowSaleDate(null); if (selected && which) setSaleForm((current) => ({ ...current, [which === 'start' ? 'start_time' : 'end_time']: selected })); }} />}
  </View>;
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', margin: 16, marginBottom: 0, backgroundColor: '#e2e8f0', borderRadius: 12, padding: 4, gap: 4 },
  segmentButton: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.primary },
  fab: { position: 'absolute', right: 18, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', maxHeight: '88%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  close: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6 },
  typeChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: '#fff' },
  typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
  dateField: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff' },
});
