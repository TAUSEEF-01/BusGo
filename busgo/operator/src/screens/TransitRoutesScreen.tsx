import React, { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { useAuth } from '../store/auth';
import { Badge, Button, Card, Empty, ErrorState, Input, Loading, Row } from '../components/ui';
import { colors } from '../theme';
import type { Bus, RouteDef, TransitRoute } from '../types';

const EMPTY_FORM = { name: '', origin_city: '', via_cities: [''], destination_city: '', combined_discount_pct: '0', leg_assignments: [{ bus_id: '', route_id: '' }, { bus_id: '', route_id: '' }] };

export default function TransitRoutesScreen() {
  const { user } = useAuth();
  const [transitRoutes, setTransitRoutes] = useState<TransitRoute[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [routes, setRoutes] = useState<RouteDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [pickingLeg, setPickingLeg] = useState<{ index: number; kind: 'bus' | 'route' } | null>(null);

  const load = useCallback(async () => {
    setError('');
    const [transitR, busesR, routesR] = await Promise.allSettled([
      api.get('/api/operators/transit-routes/mine'),
      api.get(`/api/operators/operators/${user?.id}/buses`),
      api.get(`/api/operators/operators/${user?.id}/routes`),
    ]);
    if (transitR.status === 'fulfilled') setTransitRoutes(transitR.value.data || []);
    else setError((transitR.reason as any)?.message || 'Could not load transit routes.');
    if (busesR.status === 'fulfilled') setBuses(busesR.value.data || []);
    if (routesR.status === 'fulfilled') setRoutes(routesR.value.data || []);
    setLoading(false); setRefreshing(false);
  }, [user]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cityStops = () => [form.origin_city, ...form.via_cities, form.destination_city];

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setFormOpen(true); };
  const openEdit = (route: TransitRoute) => {
    setEditingId(route.id);
    setForm({
      name: route.name, origin_city: route.origin_city, destination_city: route.destination_city,
      via_cities: route.via_cities.length ? route.via_cities : [''],
      combined_discount_pct: String(route.combined_discount_pct),
      leg_assignments: route.leg_assignments.length ? route.leg_assignments : [{ bus_id: '', route_id: '' }, { bus_id: '', route_id: '' }],
    });
    setFormOpen(true);
  };

  const setVia = (index: number, value: string) => setForm((current) => {
    const via = current.via_cities.map((city, position) => position === index ? value : city);
    return { ...current, via_cities: via, leg_assignments: normalizeLegs(via, current.leg_assignments) };
  });
  const normalizeLegs = (via: string[], legs: { bus_id: string; route_id: string }[]) => {
    const count = via.length + 1;
    const next = [...legs];
    while (next.length < count) next.push({ bus_id: '', route_id: '' });
    return next.slice(0, count);
  };

  const save = async () => {
    if (!form.name.trim()) return Alert.alert('Transit route', 'Give the route a name.');
    if (!form.origin_city.trim() || !form.destination_city.trim()) return Alert.alert('Transit route', 'Enter origin and destination cities.');
    const via = form.via_cities.map((city) => city.trim()).filter(Boolean);
    if (!via.length) return Alert.alert('Transit route', 'Add at least one via city — transit journeys change buses there.');
    const legs = form.leg_assignments.slice(0, via.length + 1);
    if (legs.some((leg) => !leg.bus_id || !leg.route_id)) return Alert.alert('Transit route', 'Assign a bus and a route to every leg.');
    const discount = Number(form.combined_discount_pct);
    if (discount < 0 || discount > 50) return Alert.alert('Transit route', 'Discount must be between 0% and 50%.');
    setSaving(true);
    const payload = {
      name: form.name.trim(), origin_city: form.origin_city.trim(), destination_city: form.destination_city.trim(),
      via_cities: via, leg_assignments: legs, combined_discount_pct: discount,
      ...(!editingId ? { operator_id: user?.id } : {}),
    };
    try {
      if (editingId) await api.put(`/api/operators/transit-routes/${editingId}`, payload);
      else await api.post('/api/operators/transit-routes/', payload);
      setFormOpen(false); setLoading(true); await load();
    } catch (reason: any) { Alert.alert('Could not save transit route', reason.message); }
    finally { setSaving(false); }
  };

  const remove = (route: TransitRoute) => Alert.alert('Delete transit route?', `${route.name} will be removed.`, [
    { text: 'Keep', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { try { await api.del(`/api/operators/transit-routes/${route.id}`); load(); } catch (reason: any) { Alert.alert('Could not delete', reason.message); } } },
  ]);

  const busLabel = (id: string) => buses.find((bus) => bus.id === id)?.registration_no || 'Pick bus';
  const routeLabel = (id: string) => { const route = routes.find((item) => item.id === id); return route ? `${route.origin_city} → ${route.destination_city}` : 'Pick route'; };

  return <View style={{ flex: 1, backgroundColor: colors.bg }}>
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 90 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      {loading ? <Loading label="Loading transit routes…" /> : error ? <ErrorState message={error} onRetry={() => { setLoading(true); load(); }} /> : null}
      {!loading && !error && !transitRoutes.length ? <Empty title="No transit routes" subtitle="Publish a multi-leg route so passengers can book connecting journeys with one payment." icon="git-branch-outline" /> : null}
      {transitRoutes.map((route) => <Card key={route.id} style={{ marginBottom: 10 }}>
        <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ fontWeight: '900', color: colors.text, flex: 1, marginRight: 8 }}>{route.name}</Text>
          {route.combined_discount_pct > 0 ? <Badge tone="success" text={`${route.combined_discount_pct}% off`} /> : null}
        </Row>
        <Row style={{ gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
          {[route.origin_city, ...route.via_cities, route.destination_city].map((city, index, list) => <Row key={`${city}-${index}`} style={{ gap: 5 }}>
            <Badge tone={index === 0 || index === list.length - 1 ? 'primary' : 'warn'} text={city} />
            {index < list.length - 1 ? <Ionicons name="arrow-forward" size={12} color={colors.faint} /> : null}
          </Row>)}
        </Row>
        <Text style={{ fontSize: 12, color: colors.subtext }}>{route.leg_assignments.length} buses assigned</Text>
        <Row style={{ justifyContent: 'flex-end', gap: 12, marginTop: 9, borderTopWidth: 1, borderTopColor: colors.borderSoft, paddingTop: 9 }}>
          <Pressable hitSlop={8} onPress={() => openEdit(route)}><Ionicons name="create-outline" size={20} color={colors.subtext} /></Pressable>
          <Pressable hitSlop={8} onPress={() => remove(route)}><Ionicons name="trash-outline" size={19} color={colors.danger} /></Pressable>
        </Row>
      </Card>)}
    </ScrollView>

    <Pressable onPress={openCreate} style={styles.fab}><Ionicons name="add" size={26} color="#fff" /></Pressable>

    <Modal visible={formOpen} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setFormOpen(false)}>
      <View style={styles.overlay}>
        <Pressable style={{ flex: 1 }} onPress={() => setFormOpen(false)} />
        <View style={styles.sheet}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 14 }}>
            <Text style={{ fontSize: 19, fontWeight: '900', color: colors.text }}>{editingId ? 'Edit transit route' : 'New transit route'}</Text>
            <Pressable onPress={() => setFormOpen(false)} style={styles.close}><Ionicons name="close" size={20} color={colors.text} /></Pressable>
          </Row>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Input label="Route name" value={form.name} onChangeText={(value) => setForm({ ...form, name: value })} placeholder="Dhaka – Cox's Bazar via Chattogram" />
            <Row style={{ gap: 10 }}>
              <View style={{ flex: 1 }}><Input label="Origin" value={form.origin_city} onChangeText={(value) => setForm({ ...form, origin_city: value })} placeholder="Dhaka" autoCapitalize="words" /></View>
              <View style={{ flex: 1 }}><Input label="Destination" value={form.destination_city} onChangeText={(value) => setForm({ ...form, destination_city: value })} placeholder="Cox's Bazar" autoCapitalize="words" /></View>
            </Row>
            <Row style={{ justifyContent: 'space-between', marginBottom: 7 }}>
              <Text style={styles.label}>Via cities (transfer stops)</Text>
              <Pressable onPress={() => setForm((current) => { const via = [...current.via_cities, '']; return { ...current, via_cities: via, leg_assignments: normalizeLegs(via, current.leg_assignments) }; })}><Row style={{ gap: 3 }}><Ionicons name="add-circle" size={16} color={colors.primary} /><Text style={{ fontSize: 12, fontWeight: '800', color: colors.primary }}>Add</Text></Row></Pressable>
            </Row>
            {form.via_cities.map((city, index) => <Row key={index} style={{ gap: 8 }}>
              <View style={{ flex: 1 }}><Input value={city} onChangeText={(value) => setVia(index, value)} placeholder={`Via city ${index + 1}`} autoCapitalize="words" /></View>
              {form.via_cities.length > 1 ? <Pressable hitSlop={8} style={{ marginTop: 12 }} onPress={() => setForm((current) => { const via = current.via_cities.filter((_, position) => position !== index); return { ...current, via_cities: via, leg_assignments: normalizeLegs(via, current.leg_assignments) }; })}><Ionicons name="remove-circle-outline" size={20} color={colors.danger} /></Pressable> : null}
            </Row>)}

            <Text style={styles.label}>Leg assignments</Text>
            {form.leg_assignments.map((leg, index) => {
              const stops = cityStops();
              return <View key={index} style={styles.legCard}>
                <Text style={{ fontSize: 12, fontWeight: '900', color: colors.primary, marginBottom: 6 }}>Bus {index + 1}: {(stops[index] || '?') + ' → ' + (stops[index + 1] || '?')}</Text>
                <Row style={{ gap: 8 }}>
                  <Pressable style={[styles.legPick, { flex: 1 }]} onPress={() => setPickingLeg({ index, kind: 'bus' })}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: colors.faint }}>BUS</Text>
                    <Text style={{ fontWeight: '700', color: leg.bus_id ? colors.text : colors.faint }} numberOfLines={1}>{busLabel(leg.bus_id)}</Text>
                  </Pressable>
                  <Pressable style={[styles.legPick, { flex: 1.4 }]} onPress={() => setPickingLeg({ index, kind: 'route' })}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: colors.faint }}>SCHEDULED ROUTE</Text>
                    <Text style={{ fontWeight: '700', color: leg.route_id ? colors.text : colors.faint }} numberOfLines={1}>{routeLabel(leg.route_id)}</Text>
                  </Pressable>
                </Row>
              </View>;
            })}
            <Input label="Combined discount (%)" value={form.combined_discount_pct} onChangeText={(value) => setForm({ ...form, combined_discount_pct: value.replace(/\D/g, '') })} keyboardType="number-pad" maxLength={2} />
            <Text style={{ fontSize: 11, color: colors.faint, marginBottom: 12 }}>Through-ticket price = the existing fares of the scheduled legs, minus this discount. No extra transit fee is added.</Text>
            <Button title={editingId ? 'Save changes' : 'Publish transit route'} icon="checkmark" onPress={save} loading={saving} />
          </ScrollView>
        </View>
      </View>
    </Modal>

    {/* Leg bus/route picker */}
    <Modal visible={!!pickingLeg} animationType="fade" transparent statusBarTranslucent onRequestClose={() => setPickingLeg(null)}>
      <View style={styles.overlay}>
        <Pressable style={{ flex: 1 }} onPress={() => setPickingLeg(null)} />
        <View style={[styles.sheet, { maxHeight: '60%' }]}>
          <Text style={{ fontSize: 17, fontWeight: '900', color: colors.text, marginBottom: 10 }}>Pick a {pickingLeg?.kind === 'bus' ? 'bus' : 'route'} for Bus {(pickingLeg?.index ?? 0) + 1}</Text>
          <ScrollView>
            {pickingLeg?.kind === 'bus'
              ? buses.filter((bus) => bus.allow_transit || bus.is_active).map((bus) => <Pressable key={bus.id} style={styles.pickOption} onPress={() => { setForm((current) => ({ ...current, leg_assignments: current.leg_assignments.map((leg, position) => position === pickingLeg.index ? { ...leg, bus_id: bus.id } : leg) })); setPickingLeg(null); }}>
                  <Text style={{ fontWeight: '800', color: colors.text }}>{bus.registration_no}</Text>
                  <Text style={{ fontSize: 11, color: colors.subtext }}>{bus.bus_type} · {bus.total_seats} seats{bus.allow_transit ? ' · transit enabled' : ''}</Text>
                </Pressable>)
              : routes.map((route) => <Pressable key={route.id} style={styles.pickOption} onPress={() => { setForm((current) => ({ ...current, leg_assignments: current.leg_assignments.map((leg, position) => position === pickingLeg!.index ? { ...leg, route_id: route.id } : leg) })); setPickingLeg(null); }}>
                  <Text style={{ fontWeight: '800', color: colors.text }}>{route.origin_city} → {route.destination_city}</Text>
                  <Text style={{ fontSize: 11, color: colors.subtext }}>{route.distance_km} km · ~{route.estimated_duration_hours}h</Text>
                </Pressable>)}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', right: 18, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', maxHeight: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  close: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6 },
  legCard: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 12, padding: 10, marginBottom: 8 },
  legPick: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fff' },
  pickOption: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
});
