import React, { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { useAuth } from '../store/auth';
import { Badge, Button, Card, Empty, ErrorState, Input, Loading, Row } from '../components/ui';
import { colors, radius } from '../theme';
import type { Bus } from '../types';

const BUS_TYPES: Bus['bus_type'][] = ['AC', 'NON_AC', 'SLEEPER'];
const EMPTY_FORM = { registration_no: '', bus_type: 'AC' as Bus['bus_type'], total_seats: '40', is_active: true, allow_transit: false };

export default function BusesScreen() {
  const { user } = useAuth();
  const [buses, setBuses] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await api.get(`/api/operators/operators/${user?.id}/buses`);
      setBuses(response.data || []);
    } catch (reason: any) { setError(reason.message || 'Could not load buses.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setFormOpen(true); };
  const openEdit = (bus: Bus) => {
    setEditingId(bus.id);
    setForm({ registration_no: bus.registration_no, bus_type: bus.bus_type, total_seats: String(bus.total_seats), is_active: bus.is_active, allow_transit: !!bus.allow_transit });
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.registration_no.trim()) return Alert.alert('Bus', 'Enter the registration number.');
    const totalSeats = Number(form.total_seats);
    if (!Number.isInteger(totalSeats) || totalSeats < 10 || totalSeats > 60) return Alert.alert('Bus', 'Total seats must be between 10 and 60.');
    setSaving(true);
    // Same payload the web portal submits.
    const payload = { registration_no: form.registration_no.trim(), bus_type: form.bus_type, total_seats: totalSeats, is_active: form.is_active, allow_transit: form.allow_transit, seat_layout: {}, amenities: ['WiFi', 'Water'] };
    try {
      if (editingId) await api.put(`/api/operators/buses/${editingId}`, payload);
      else await api.post(`/api/operators/operators/${user?.id}/buses`, payload);
      setFormOpen(false);
      setLoading(true); await load();
    } catch (reason: any) { Alert.alert('Could not save bus', reason.message); }
    finally { setSaving(false); }
  };

  const remove = (bus: Bus) => Alert.alert('Delete bus?', `${bus.registration_no} will be removed. Scheduled trips using it may fail.`, [
    { text: 'Keep', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      try { await api.del(`/api/operators/buses/${bus.id}`); setLoading(true); await load(); }
      catch (reason: any) { Alert.alert('Could not delete', reason.message); }
    } },
  ]);

  return <View style={{ flex: 1, backgroundColor: colors.bg }}>
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 90 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
      {loading ? <Loading label="Loading buses…" /> : error ? <ErrorState message={error} onRetry={() => { setLoading(true); load(); }} /> : null}
      {!loading && !error && !buses.length ? <Empty title="No buses yet" subtitle="Add your first coach to start scheduling trips." icon="bus-outline" /> : null}
      {buses.map((bus) => <Card key={bus.id} style={{ marginBottom: 10 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row style={{ gap: 11, flex: 1 }}>
            <View style={styles.busIcon}><Ionicons name="bus" size={19} color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '900', color: colors.text }}>{bus.registration_no}</Text>
              <Row style={{ gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                <Badge tone="neutral" text={bus.bus_type} />
                <Badge tone="neutral" text={`${bus.total_seats} seats`} />
                <Badge tone={bus.is_active ? 'success' : 'danger'} text={bus.is_active ? 'Active' : 'Inactive'} />
                {bus.allow_transit ? <Badge tone="info" text="Transit" /> : null}
              </Row>
            </View>
          </Row>
          <Row style={{ gap: 8 }}>
            <Pressable hitSlop={8} onPress={() => openEdit(bus)}><Ionicons name="create-outline" size={20} color={colors.subtext} /></Pressable>
            <Pressable hitSlop={8} onPress={() => remove(bus)}><Ionicons name="trash-outline" size={19} color={colors.danger} /></Pressable>
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
            <Text style={{ fontSize: 19, fontWeight: '900', color: colors.text }}>{editingId ? 'Edit bus' : 'Add a bus'}</Text>
            <Pressable onPress={() => setFormOpen(false)} style={styles.close}><Ionicons name="close" size={20} color={colors.text} /></Pressable>
          </Row>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Input label="Registration number" value={form.registration_no} onChangeText={(value) => setForm({ ...form, registration_no: value })} placeholder="DHK-METRO-1234" autoCapitalize="characters" />
            <Text style={styles.label}>Bus type</Text>
            <Row style={{ gap: 8, marginBottom: 14 }}>
              {BUS_TYPES.map((type) => <Pressable key={type} onPress={() => setForm({ ...form, bus_type: type })} style={[styles.typeChip, form.bus_type === type && styles.typeChipActive]}>
                <Text style={{ fontWeight: '800', fontSize: 12, color: form.bus_type === type ? '#fff' : colors.text }}>{type.replace('_', ' ')}</Text>
              </Pressable>)}
            </Row>
            <Input label="Total seats" value={form.total_seats} onChangeText={(value) => setForm({ ...form, total_seats: value.replace(/\D/g, '') })} keyboardType="number-pad" maxLength={2} />
            <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ fontWeight: '700', color: colors.text }}>Active (bookable)</Text>
              <Switch value={form.is_active} onValueChange={(value) => setForm({ ...form, is_active: value })} trackColor={{ true: colors.primary }} />
            </Row>
            <Row style={{ justifyContent: 'space-between', marginBottom: 16 }}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={{ fontWeight: '700', color: colors.text }}>Allow transit journeys</Text>
                <Text style={{ fontSize: 11, color: colors.subtext }}>Let this bus serve legs of connecting journeys.</Text>
              </View>
              <Switch value={form.allow_transit} onValueChange={(value) => setForm({ ...form, allow_transit: value })} trackColor={{ true: colors.primary }} />
            </Row>
            <Button title={editingId ? 'Save changes' : 'Add bus'} icon="checkmark" onPress={save} loading={saving} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  busIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', right: 18, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', maxHeight: '86%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  close: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6 },
  typeChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: '#fff' },
  typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
});
