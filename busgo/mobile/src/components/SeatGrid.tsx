import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export interface SeatCell {
  id: string; // e.g. "A1"
  row: number;
  col: number;
  taken: boolean;
}

/** Map inventory-service seat docs into a 10x4 grid model. */
export function toSeatCells(dbSeats: any[]): SeatCell[] {
  if (!dbSeats || dbSeats.length === 0) return [];
  return dbSeats.map((s: any) => {
    const rowChar = String(s.seat_number).charAt(0).toUpperCase();
    return {
      id: s.seat_number,
      row: rowChar.charCodeAt(0) - 65,
      col: parseInt(String(s.seat_number).substring(1), 10) - 1,
      taken: s.status === 'BOOKED' || s.status === 'LOCKED',
    };
  });
}

export function SeatGrid({
  seats,
  selected,
  onToggle,
}: {
  seats: SeatCell[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const rows = Array.from(new Set(seats.map((s) => s.row))).sort((a, b) => a - b);
  return (
    <View style={styles.bus}>
      <View style={styles.front}>
        <Text style={styles.frontText}>FRONT</Text>
        <Text style={{ fontSize: 18 }}>🚍</Text>
      </View>
      {rows.map((row) => {
        const rowSeats = seats.filter((s) => s.row === row).sort((a, b) => a.col - b.col);
        return (
          <View key={row} style={styles.row}>
            <View style={styles.pair}>
              {rowSeats.slice(0, 2).map((s) => (
                <Seat key={s.id} seat={s} isSelected={selected.includes(s.id)} onToggle={onToggle} />
              ))}
            </View>
            <View style={{ width: 26 }} />
            <View style={styles.pair}>
              {rowSeats.slice(2, 4).map((s) => (
                <Seat key={s.id} seat={s} isSelected={selected.includes(s.id)} onToggle={onToggle} />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Seat({
  seat,
  isSelected,
  onToggle,
}: {
  seat: SeatCell;
  isSelected: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <Pressable
      disabled={seat.taken}
      onPress={() => onToggle(seat.id)}
      style={[
        styles.seat,
        seat.taken && styles.seatTaken,
        isSelected && styles.seatSelected,
      ]}
    >
      <Text
        style={[
          styles.seatText,
          seat.taken && { color: colors.faint },
          isSelected && { color: '#fff' },
        ]}
      >
        {seat.id}
      </Text>
    </Pressable>
  );
}

export function SeatLegend() {
  return (
    <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'center', marginBottom: 12 }}>
      <LegendItem style={styles.seat} label="Available" />
      <LegendItem style={[styles.seat, styles.seatSelected]} label="Selected" />
      <LegendItem style={[styles.seat, styles.seatTaken]} label="Taken" />
    </View>
  );
}

function LegendItem({ style, label }: { style: any; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={[style, { width: 18, height: 18, borderRadius: 4 }]} />
      <Text style={{ fontSize: 12, color: colors.subtext }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bus: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#fbfcfe',
    alignSelf: 'center',
  },
  front: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  frontText: { fontSize: 10, color: colors.faint, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'center', marginBottom: 8 },
  pair: { flexDirection: 'row', gap: 8 },
  seat: {
    width: 42,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatTaken: {
    backgroundColor: '#e2e8f0',
    borderColor: colors.border,
  },
  seatSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  seatText: { fontSize: 11, fontWeight: '800', color: colors.subtext },
});
