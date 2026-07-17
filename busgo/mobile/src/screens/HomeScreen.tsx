import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api/client';
import { useAuth } from '../store/auth';
import { Button, Card, Row } from '../components/ui';
import { colors, radius } from '../theme';
import type { RootStackParamList } from '../nav';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const [cities, setCities] = useState<string[]>([]);
  const [origin, setOrigin] = useState<string>('');
  const [destination, setDestination] = useState<string>('');
  const [date, setDate] = useState<string>(fmtDate(new Date()));
  const [picking, setPicking] = useState<'origin' | 'destination' | null>(null);

  useEffect(() => {
    api
      .get('/api/search/cities')
      .then((r) => {
        const list: string[] = (r.data || []).sort();
        setCities(list);
        if (list.length >= 2) {
          setOrigin((o) => o || list[0]);
          setDestination((d) => d || list[1]);
        }
      })
      .catch(() => {});
  }, []);

  const dateChips = useMemo(() => {
    const out: { label: string; value: string }[] = [];
    const names = ['Today', 'Tomorrow'];
    for (let i = 0; i < 5; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      out.push({
        label: names[i] || d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
        value: fmtDate(d),
      });
    }
    return out;
  }, []);

  const swap = () => {
    setOrigin(destination);
    setDestination(origin);
  };

  const search = () => {
    if (!origin || !destination) {
      Alert.alert('Pick cities', 'Choose an origin and a destination.');
      return;
    }
    if (origin === destination) {
      Alert.alert('Same city', 'Origin and destination must differ.');
      return;
    }
    navigation.navigate('Results', { origin, destination, date });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.hero}>
        <Text style={{ color: '#fca5b3', fontWeight: '700', fontSize: 13 }}>
          Hey {user?.full_name?.split(' ')[0] || 'traveller'} 👋
        </Text>
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 24, marginTop: 2 }}>
          Where are you going?
        </Text>
        <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
          Direct buses and connecting journeys — one payment, tickets per bus.
        </Text>
      </View>

      <Card style={{ marginTop: -26, marginHorizontal: 4 }}>
        {/* Origin / destination */}
        <CityField label="From" value={origin} onPress={() => setPicking('origin')} />
        <Row style={{ justifyContent: 'center', marginVertical: 2 }}>
          <Pressable onPress={swap} style={styles.swap}>
            <Text style={{ fontSize: 16 }}>⇅</Text>
          </Pressable>
        </Row>
        <CityField label="To" value={destination} onPress={() => setPicking('destination')} />

        {/* City picker */}
        {picking && (
          <View style={styles.picker}>
            <Text style={{ fontWeight: '800', marginBottom: 8, color: colors.text }}>
              Select {picking === 'origin' ? 'origin' : 'destination'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(cities.length ? cities : ['Dhaka', 'Comilla', 'Sylhet']).map((c) => (
                <Pressable
                  key={c}
                  onPress={() => {
                    if (picking === 'origin') setOrigin(c);
                    else setDestination(c);
                    setPicking(null);
                  }}
                  style={styles.cityChip}
                >
                  <Text style={{ fontWeight: '700', color: colors.text }}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Date */}
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 12, marginBottom: 8 }}>
          Journey date
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Row style={{ gap: 8 }}>
            {dateChips.map((c) => (
              <Pressable
                key={c.value}
                onPress={() => setDate(c.value)}
                style={[styles.dateChip, date === c.value && styles.dateChipActive]}
              >
                <Text style={{ fontWeight: '700', fontSize: 13, color: date === c.value ? '#fff' : colors.text }}>
                  {c.label}
                </Text>
                <Text style={{ fontSize: 10, color: date === c.value ? '#ffe4e6' : colors.faint }}>{c.value}</Text>
              </Pressable>
            ))}
          </Row>
        </ScrollView>

        <Button title="Search buses" onPress={search} style={{ marginTop: 16 }} />
      </Card>

      <Card style={{ marginTop: 16, marginHorizontal: 4 }}>
        <Text style={{ fontWeight: '800', color: colors.text, marginBottom: 6 }}>🔀 Connecting journeys</Text>
        <Text style={{ color: colors.subtext, fontSize: 13, lineHeight: 19 }}>
          No direct bus? BusGo finds routes where you change buses at an intermediate city — booked
          together, one payment, and a ticket for each bus. Operator-guaranteed connections are ranked first.
        </Text>
      </Card>
    </ScrollView>
  );
}

function CityField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.cityField}>
      <Text style={{ fontSize: 11, color: colors.faint, fontWeight: '700' }}>{label}</Text>
      <Text style={{ fontSize: 18, fontWeight: '800', color: value ? colors.text : colors.faint }}>
        {value || 'Select city'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.dark,
    borderRadius: radius.xl,
    padding: 20,
    paddingBottom: 44,
  },
  cityField: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  swap: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  picker: {
    marginTop: 10,
    backgroundColor: '#f8fafc',
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cityChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  dateChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  dateChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
});
