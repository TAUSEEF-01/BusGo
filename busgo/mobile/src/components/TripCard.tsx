import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, OperatorLogo, Row, TripTimeline } from './ui';
import { colors } from '../theme';
import { busDisplayName, durationBetween, money, shortTime } from '../utils/format';
import type { DirectTrip } from '../nav';

export const AMENITY_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  ac: { icon: 'snow-outline', label: 'AC' },
  wifi: { icon: 'wifi-outline', label: 'WiFi' },
  usb: { icon: 'flash-outline', label: 'USB' },
};

/**
 * Direct-trip card shared by Results and Routes. No fabricated ratings: a
 * rating renders only when the API supplies one (P1.4).
 */
export function TripCard({ trip, onSelect, selectLabel = 'Select seats' }: {
  trip: DirectTrip; onSelect: () => void; selectLabel?: string;
}) {
  const seatsLeft = trip.available_seats;
  const amenities = (trip.amenities || []).map((a) => AMENITY_META[a.toLowerCase()]).filter(Boolean);
  const rating = (trip as any).rating as number | undefined;
  return <Card style={{ marginBottom: 12 }}>
    {/* Operator header */}
    <Row style={{ gap: 11, marginBottom: 13 }}>
      <OperatorLogo name={trip.operator_name || 'Bus operator'} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '800', fontSize: 15, color: colors.text }} numberOfLines={1}>{trip.operator_name || 'Bus operator'}</Text>
        <Row style={{ gap: 4, marginTop: 2 }}>
          <Ionicons name="bus-outline" size={12} color={colors.primary} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }} numberOfLines={1}>{busDisplayName(trip)}</Text>
        </Row>
        <Row style={{ gap: 8, marginTop: 3 }}>
          {trip.bus_type ? <Badge tone="neutral" text={trip.bus_type} /> : null}
          {typeof rating === 'number' ? <Row style={{ gap: 3 }}><Ionicons name="star" size={12} color={colors.accent} /><Text style={{ fontSize: 12, fontWeight: '700', color: colors.subtext }}>{rating.toFixed(1)}</Text></Row> : null}
        </Row>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontWeight: '900', fontSize: 19, color: colors.primary }}>{money(trip.fare_amount)}</Text>
        <Text style={{ fontSize: 10, color: colors.faint }}>per seat</Text>
      </View>
    </Row>

    <TripTimeline
      depTime={shortTime(trip.departure_datetime)} depCity={trip.origin_city}
      arrTime={shortTime(trip.arrival_datetime)} arrCity={trip.destination_city}
      centerLabel={durationBetween(trip.departure_datetime, trip.arrival_datetime) || 'Direct'}
    />

    <Row style={{ justifyContent: 'space-between', marginTop: 13, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.borderSoft }}>
      <Row style={{ gap: 10 }}>
        {amenities.length ? amenities.map((amenity) => <Row key={amenity.label} style={{ gap: 3 }}><Ionicons name={amenity.icon} size={13} color={colors.subtext} /><Text style={{ fontSize: 11, color: colors.subtext }}>{amenity.label}</Text></Row>)
          : <Text style={{ fontSize: 11, color: colors.faint }}>Standard amenities</Text>}
      </Row>
      {typeof seatsLeft === 'number' ? <Row style={{ gap: 4 }}>
        <Ionicons name="people-outline" size={13} color={seatsLeft <= 5 ? colors.danger : seatsLeft <= 12 ? colors.warn : colors.success} />
        <Text style={{ fontSize: 12, fontWeight: '700', color: seatsLeft <= 5 ? colors.danger : seatsLeft <= 12 ? colors.warn : colors.success }}>{seatsLeft} seats left</Text>
      </Row> : null}
    </Row>

    <Button title={selectLabel} icon="grid-outline" onPress={onSelect} style={{ marginTop: 13 }} />
  </Card>;
}
