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

const SORTS: { id: TripSort; label: string }[] = [
  { id: 'time-asc', label: 'Earliest' },
  { id: 'time-desc', label: 'Latest' },
  { id: 'duration', label: 'Shortest' },
  { id: 'price-asc', label: 'Cheapest' },
  { id: 'price-desc', label: 'Premium' },
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

function FilterRow({ label, children, divider = true }: { label: string; children: React.ReactNode; divider?: boolean }) {
  return <>
    <View style={styles.row}>
      <View style={styles.rowLabelBox}><Text style={styles.rowLabelText}>{label}</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>{children}</ScrollView>
    </View>
    {divider ? <View style={styles.panelDivider} /> : null}
  </>;
}

/**
 * Sort + filter panel shared by Results and Routes: one labeled row per
 * dimension — sort, bus type, operator, price — so nothing competes for the
 * same line.
 */
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
    <FilterRow label="SORT">
      {SORTS.map((sort) => <Chip key={sort.id} label={sort.label} active={filters.sort === sort.id} onPress={() => onChange({ ...filters, sort: sort.id })} />)}
    </FilterRow>
    {busTypes.length ? <FilterRow label="TYPE">
      {busTypes.map((type) => <Chip key={type} label={type} active={filters.busTypes.includes(type)} onPress={() => onChange({ ...filters, busTypes: toggle(filters.busTypes, type) })} />)}
    </FilterRow> : null}
    {operators.length ? <FilterRow label="OPERATOR">
      {operators.map((operator) => <Chip key={operator} label={operator} active={filters.operators.includes(operator)} onPress={() => onChange({ ...filters, operators: toggle(filters.operators, operator) })} />)}
    </FilterRow> : null}
    <FilterRow label="PRICE" divider={!!active}>
      {FARE_CAPS.map((cap) => <Chip key={cap} label={`≤ ${money(cap)}`} active={filters.maxFare === cap} onPress={() => onChange({ ...filters, maxFare: filters.maxFare === cap ? null : cap })} />)}
    </FilterRow>
    {active ? <Row style={{ justifyContent: 'space-between', paddingHorizontal: 12 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.subtext }}>{active} filter{active > 1 ? 's' : ''} applied</Text>
      <Pressable onPress={() => onChange({ ...DEFAULT_TRIP_FILTERS, sort: filters.sort })} style={styles.clearChip}>
        <Ionicons name="close-circle" size={13} color={colors.danger} />
        <Text style={{ fontSize: 12, fontWeight: '800', color: colors.danger }}>Clear all</Text>
      </Pressable>
    </Row> : null}
  </View>;
}

const styles = StyleSheet.create({
  panel: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 16, marginHorizontal: 16, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowLabelBox: { width: 74, paddingLeft: 14 },
  rowLabelText: { fontSize: 10, fontWeight: '900', color: colors.faint, letterSpacing: 0.8 },
  chipRow: { gap: 6, paddingRight: 12, alignItems: 'center' },
  panelDivider: { height: 1, backgroundColor: colors.borderSoft, marginVertical: 9, marginLeft: 14, marginRight: 12 },
  clearChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.dangerSoft },
});
