import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
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
  { id: 'price-asc', label: 'Price ↑' },
  { id: 'price-desc', label: 'Price ↓' },
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

/** Horizontal chip bars: sort, bus type, operator, and fare cap. */
export function TripFilterBar({ trips, filters, onChange }: {
  trips: DirectTrip[];
  filters: TripFilterState;
  onChange: (next: TripFilterState) => void;
}) {
  const busTypes = [...new Set(trips.map((trip) => trip.bus_type).filter(Boolean))] as string[];
  const operators = [...new Set(trips.map((trip) => trip.operator_name).filter(Boolean))] as string[];
  const toggle = (list: string[], value: string) => list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  const active = countActiveTripFilters(filters);

  return <View style={{ gap: 8 }}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingHorizontal: 16 }}>
      <Row style={{ gap: 4, marginRight: 2 }}><Ionicons name="swap-vertical" size={13} color={colors.subtext} /><Text style={{ fontSize: 11, fontWeight: '800', color: colors.subtext }}>Sort</Text></Row>
      {SORTS.map((sort) => <Chip key={sort.id} label={sort.label} active={filters.sort === sort.id} onPress={() => onChange({ ...filters, sort: sort.id })} />)}
    </ScrollView>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingHorizontal: 16 }}>
      <Row style={{ gap: 4, marginRight: 2 }}><Ionicons name="options-outline" size={13} color={colors.subtext} /><Text style={{ fontSize: 11, fontWeight: '800', color: colors.subtext }}>Filter{active ? ` (${active})` : ''}</Text></Row>
      {busTypes.map((type) => <Chip key={`bt-${type}`} label={type} active={filters.busTypes.includes(type)} onPress={() => onChange({ ...filters, busTypes: toggle(filters.busTypes, type) })} />)}
      {operators.map((operator) => <Chip key={`op-${operator}`} label={operator} active={filters.operators.includes(operator)} onPress={() => onChange({ ...filters, operators: toggle(filters.operators, operator) })} />)}
      {FARE_CAPS.map((cap) => <Chip key={`fare-${cap}`} label={`≤ ${money(cap)}`} active={filters.maxFare === cap} onPress={() => onChange({ ...filters, maxFare: filters.maxFare === cap ? null : cap })} />)}
      {active ? <Pressable onPress={() => onChange({ ...DEFAULT_TRIP_FILTERS, sort: filters.sort })}><Row style={{ gap: 3, paddingHorizontal: 8, paddingVertical: 6 }}><Ionicons name="close-circle" size={14} color={colors.danger} /><Text style={{ fontSize: 12, fontWeight: '800', color: colors.danger }}>Clear</Text></Row></Pressable> : null}
    </ScrollView>
  </View>;
}
