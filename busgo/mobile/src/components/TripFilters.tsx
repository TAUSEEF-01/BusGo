import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Chip, Row } from './ui';
import { colors } from '../theme';
import { money } from '../utils/format';
import type { DirectTrip } from '../nav';

export type TripSort = 'time-asc' | 'time-desc' | 'duration' | 'price-asc' | 'price-desc';

export interface TripFilterState {
  busTypes: string[];
  operators: string[];
  maxFare: number | null;
  sort: TripSort;
}

export const DEFAULT_TRIP_FILTERS: TripFilterState = { busTypes: [], operators: [], maxFare: null, sort: 'time-asc' };

const SORTS: { id: TripSort; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'time-asc', label: 'Earliest', icon: 'sunny-outline' },
  { id: 'time-desc', label: 'Latest', icon: 'moon-outline' },
  { id: 'duration', label: 'Shortest', icon: 'flash-outline' },
  { id: 'price-asc', label: 'Cheapest', icon: 'trending-down-outline' },
  { id: 'price-desc', label: 'Premium', icon: 'trending-up-outline' },
];

const FARE_CAPS = [500, 800, 1200, 1600, 2500];

function durationMinutes(trip: DirectTrip): number {
  const start = new Date(trip.departure_datetime).getTime();
  const end = new Date(trip.arrival_datetime).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return Number.MAX_SAFE_INTEGER;
  return (end - start) / 60000;
}

/** Pure filter+sort used by Results and Routes so both behave identically. */
export function applyTripFilters(trips: DirectTrip[], filters: TripFilterState): DirectTrip[] {
  return trips
    .filter((trip) => !filters.busTypes.length || (trip.bus_type && filters.busTypes.includes(trip.bus_type)))
    .filter((trip) => !filters.operators.length || (trip.operator_name && filters.operators.includes(trip.operator_name)))
    .filter((trip) => filters.maxFare == null || Number(trip.fare_amount) <= filters.maxFare)
    .sort((a, b) => {
      switch (filters.sort) {
        case 'price-asc': return a.fare_amount - b.fare_amount;
        case 'price-desc': return b.fare_amount - a.fare_amount;
        case 'duration': return durationMinutes(a) - durationMinutes(b);
        case 'time-desc': return new Date(b.departure_datetime).getTime() - new Date(a.departure_datetime).getTime();
        default: return new Date(a.departure_datetime).getTime() - new Date(b.departure_datetime).getTime();
      }
    });
}

export function countActiveTripFilters(filters: TripFilterState): number {
  return filters.busTypes.length + filters.operators.length + (filters.maxFare != null ? 1 : 0);
}

function RowLabel({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return <View style={styles.rowLabel}>
    <Ionicons name={icon} size={12} color={colors.primary} />
    <Text style={styles.rowLabelText}>{text}</Text>
  </View>;
}

/** Labeled, grouped sort + filter chip bars shared by Results and Routes. */
export function TripFilterBar({ trips, filters, onChange }: {
  trips: DirectTrip[];
  filters: TripFilterState;
  onChange: (next: TripFilterState) => void;
}) {
  const busTypes = [...new Set(trips.map((trip) => trip.bus_type).filter(Boolean))] as string[];
  const operators = [...new Set(trips.map((trip) => trip.operator_name).filter(Boolean))] as string[];
  const toggle = (list: string[], value: string) => list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  const active = countActiveTripFilters(filters);

  return <View style={styles.panel}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      <RowLabel icon="swap-vertical" text="SORT" />
      {SORTS.map((sort) => <Chip key={sort.id} icon={sort.icon} label={sort.label} active={filters.sort === sort.id} onPress={() => onChange({ ...filters, sort: sort.id })} />)}
    </ScrollView>
    <View style={styles.panelDivider} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      <RowLabel icon="options-outline" text={active ? `FILTER · ${active}` : 'FILTER'} />
      {busTypes.map((type) => <Chip key={`bt-${type}`} icon="bus-outline" label={type} active={filters.busTypes.includes(type)} onPress={() => onChange({ ...filters, busTypes: toggle(filters.busTypes, type) })} />)}
      {operators.map((operator) => <Chip key={`op-${operator}`} icon="business-outline" label={operator} active={filters.operators.includes(operator)} onPress={() => onChange({ ...filters, operators: toggle(filters.operators, operator) })} />)}
      {FARE_CAPS.map((cap) => <Chip key={`fare-${cap}`} icon="pricetag-outline" label={`≤ ${money(cap)}`} active={filters.maxFare === cap} onPress={() => onChange({ ...filters, maxFare: filters.maxFare === cap ? null : cap })} />)}
      {active ? <Pressable onPress={() => onChange({ ...DEFAULT_TRIP_FILTERS, sort: filters.sort })} style={styles.clearChip}>
        <Ionicons name="close-circle" size={13} color={colors.danger} />
        <Text style={{ fontSize: 12, fontWeight: '800', color: colors.danger }}>Clear</Text>
      </Pressable> : null}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  panel: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 16, marginHorizontal: 16, paddingVertical: 10 },
  chipRow: { gap: 7, paddingHorizontal: 12, alignItems: 'center' },
  panelDivider: { height: 1, backgroundColor: colors.borderSoft, marginVertical: 9, marginHorizontal: 12 },
  rowLabel: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, marginRight: 3 },
  rowLabelText: { fontSize: 10, fontWeight: '900', color: colors.primary, letterSpacing: 0.6 },
  clearChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.dangerSoft },
});
