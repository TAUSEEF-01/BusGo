import React, { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { useAuth } from '../store/auth';
import { Badge, Button, Card, Empty, ErrorState, Input, Loading, Row } from '../components/ui';
import { colors } from '../theme';
import type { RouteDef, RoutePoint } from '../types';

const EMPTY_FORM = { origin_city: '', destination_city: '', distance_km: '100', estimated_duration_hours: '4' };
const emptyPoint = (): RoutePoint => ({ name: '', address: '', lat: 0, lng: 0 });

export default function RoutesScreen() {
  const { user } = useAuth();
  const [routes, setRoutes] = useState<RouteDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [boardingPoints, setBoardingPoints] = useState<RoutePoint[]>([emptyPoint()]);
  const [droppingPoints, setDroppingPoints] = useState<RoutePoint[]>([emptyPoint()]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await api.get(`/api/operators/operators/${user?.id}/routes`);
      setRoutes(response.data || []);
    } catch (reason: any) { setError(reason.message || 'Could not load routes.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setBoardingPoints([emptyPoint()]); setDroppingPoints([emptyPoint()]); setFormOpen(true); };
  const openEdit = (route: RouteDef) => {
    setEditingId(route.id);
    setForm({ origin_city: route.origin_city, destination_city: route.destination_city, distance_km: String(route.distance_km), estimated_duration_hours: String(route.estimated_duration_hours) });
    setBoardingPoints(route.boarding_points?.length ? route.boarding_points : [emptyPoint()]);
    setDroppingPoints(route.dropping_points?.length ? route.dropping_points : [emptyPoint()]);
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.origin_city.trim() || !form.destination_city.trim()) return Alert.alert('Route', 'Enter both origin and destination cities.');
    if (form.origin_city.trim().toLowerCase() === form.destination_city.trim().toLowerCase()) return Alert.alert('Route', 'Origin and destination must differ.');
    const validBoarding = boardingPoints.filter((point) => point.name.trim());
    const validDropping = droppingPoints.filter((point) => point.name.trim());
    if (!validBoarding.length) return Alert.alert('Route', 'Add at least one boarding point.');
    if (!validDropping.length) return Alert.alert('Route', 'Add at least one dropping point.');
    setSaving(true);
    const payload = {
      origin_city: form.origin_city.trim(), destination_city: form.destination_city.trim(),
      distance_km: Number(form.distance_km) || 0, estimated_duration_hours: Number(form.estimated_duration_hours) || 0,
      boarding_points: validBoarding, dropping_points: validDropping,
    };
    try {
      if (editingId) await api.put(`/api/operators/routes/${editingId}`, payload);
      else await api.post(`/api/operators/operators/${user?.id}/routes`, payload);
      setFormOpen(false);
      setLoading(true); await load();
    } catch (reason: any) { Alert.alert('Could not save route', reason.message); }
    finally { setSaving(false); }
  };

  const remove = (route: RouteDef) => Alert.alert('Delete route?', `${route.origin_city} → ${route.destination_city} will be removed.`, [
    { text: 'Keep', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      try { await api.del(`/api/operators/routes/${route.id}`); setLoading(true); await load(); }
      catch (reason: any) { Alert.alert('Could not delete', reason.message); }
    } },
  ]);

  const editPoint = (kind: 'boarding' | 'dropping', index: number, patch: Partial<RoutePoint>) => {
    const setter = kind === 'boarding' ? setBoardingPoints : setDroppingPoints;
    setter((current) => current.map((point, position) => position === index ? { ...point, ...patch } : point));
  };

  const PointEditor = ({ kind, points }: { kind: 'boarding' | 'dropping'; points: RoutePoint[] }) => {
    const setter = kind === 'boarding' ? setBoardingPoints : setDroppingPoints;
    return <View style={{ marginBottom: 14 }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 7 }}>
        <Row style={{ gap: 6 }}>
          <Ionicons name="location" size={13} color={kind === 'boarding' ? colors.primary : colors.danger} />
          <Text style={{ fontSize: 12, fontWeight: '800', color: colors.subtext, letterSpacing: 0.5 }}>{kind === 'boarding' ? 'BOARDING POINTS' : 'DROPPING POINTS'}</Text>
        </Row>
        <Pressable onPress={() => setter((current) => [...current, emptyPoint()])}><Row style={{ gap: 3 }}><Ionicons name="add-circle" size={16} color={colors.primary} /><Text style={{ fontSize: 12, fontWeight: '800', color: colors.primary }}>Add</Text></Row></Pressable>
      </Row>
      {points.map((point, index) => <View key={index} style={styles.pointRow}>
        <View style={{ flex: 1 }}>
          <Input value={point.name} onChangeText={(value) => editPoint(kind, index, { name: value })} placeholder={`Point ${index + 1} name (e.g. terminal)`} style={{ marginBottom: 0 }} />
          <Input value={point.address || ''} onChangeText={(value) => editPoint(kind, index, { address: value })} placeholder="Address (optional)" />
        </View>
        {points.length > 1 ? <Pressable hitSlop={8} onPress={() => setter((current) => current.filter((_, position) => position !== index))} style={{ marginTop: 12 }}><Ionicons name="remove-circle-outline" size={20} color={colors.danger} /></Pressable> : null}
      </View>)}
    </View>;
  };

  return <View style={{ flex: 1, backgroundColor: colors.bg }}>
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 90 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      {loading ? <Loading label="Loading routes…" /> : error ? <ErrorState message={error} onRetry={() => { setLoading(true); load(); }} /> : null}
      {!loading && !error && !routes.length ? <Empty title="No routes yet" subtitle="Define a route with terminals so trips can be scheduled on it." icon="map-outline" /> : null}
      {routes.map((route) => <Card key={route.id} style={{ marginBottom: 10 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '900', color: colors.text }}>{route.origin_city} → {route.destination_city}</Text>
            <Row style={{ gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              <Badge tone="neutral" text={`${route.distance_km} km`} />
              <Badge tone="neutral" text={`~${route.estimated_duration_hours}h`} />
              <Badge tone="info" text={`${route.boarding_points?.length || 0} board · ${route.dropping_points?.length || 0} drop`} />
            </Row>
          </View>
          <Row style={{ gap: 8 }}>
            <Pressable hitSlop={8} onPress={() => openEdit(route)}><Ionicons name="create-outline" size={20} color={colors.subtext} /></Pressable>
            <Pressable hitSlop={8} onPress={() => remove(route)}><Ionicons name="trash-outline" size={19} color={colors.danger} /></Pressable>
          </Row>
        </Row>
      </Card>)}
    </ScrollView>

    <Pressable onPress={openCreate} style={styles.fab}><Ionicons name="add" size={26} color="#fff" /></Pressable>

    <Modal visible={formOpen} animationType="slide" transparent statusBarTranslucent onRequestClose={() => setFormOpen(false)}>
      <View style={styles.overlay}>
        <Pressable style={{ flex: 1 }} onPress={() => setFormOpen(false)} />
        <View style={styles.sheet}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 14 }}>
            <Text style={{ fontSize: 19, fontWeight: '900', color: colors.text }}>{editingId ? 'Edit route' : 'Add a route'}</Text>
            <Pressable onPress={() => setFormOpen(false)} style={styles.close}><Ionicons name="close" size={20} color={colors.text} /></Pressable>
          </Row>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Row style={{ gap: 10 }}>
              <View style={{ flex: 1 }}><Input label="Origin city" value={form.origin_city} onChangeText={(value) => setForm({ ...form, origin_city: value })} placeholder="Dhaka" autoCapitalize="words" /></View>
              <View style={{ flex: 1 }}><Input label="Destination city" value={form.destination_city} onChangeText={(value) => setForm({ ...form, destination_city: value })} placeholder="Chattogram" autoCapitalize="words" /></View>
            </Row>
            <Row style={{ gap: 10 }}>
              <View style={{ flex: 1 }}><Input label="Distance (km)" value={form.distance_km} onChangeText={(value) => setForm({ ...form, distance_km: value.replace(/[^\d.]/g, '') })} keyboardType="numeric" /></View>
              <View style={{ flex: 1 }}><Input label="Duration (hours)" value={form.estimated_duration_hours} onChangeText={(value) => setForm({ ...form, estimated_duration_hours: value.replace(/[^\d.]/g, '') })} keyboardType="numeric" /></View>
            </Row>
            <PointEditor kind="boarding" points={boardingPoints} />
            <PointEditor kind="dropping" points={droppingPoints} />
            <Button title={editingId ? 'Save changes' : 'Add route'} icon="checkmark" onPress={save} loading={saving} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', right: 18, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', maxHeight: '88%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  close: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  pointRow: { flexDirection: 'row', gap: 8, backgroundColor: '#f8fafc', borderRadius: 12, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: colors.borderSoft },
});
