import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { API_URL } from '../config';
import { Badge, Card, Empty, Loading, Row } from '../components/ui';
import { colors } from '../theme';

export default function DealsScreen() {
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      // deals-service returns a RAW array (no BaseResponse envelope)
      const res = await fetch(`${API_URL}/api/deals/promos/`);
      const list = await res.json();
      setPromos((Array.isArray(list) ? list : []).filter((p: any) => p.is_active));
    } catch {
      setPromos([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
        />
      }
    >
      <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text, marginBottom: 4 }}>Deals & promo codes</Text>
      <Text style={{ color: colors.subtext, fontSize: 13, marginBottom: 16 }}>
        Enter a code on the payment screen to get the discount.
      </Text>

      {loading && <Loading label="Loading deals…" />}
      {!loading && promos.length === 0 && <Empty title="No active deals" subtitle="Check back soon!" />}

      {promos.map((p) => {
        const remaining = Math.max(0, (p.max_uses || 0) - (p.current_uses || 0));
        return (
          <Card key={p.id} style={{ marginBottom: 12 }}>
            <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <Badge
                tone="primary"
                text={p.discount_type === 'PERCENTAGE' ? `${p.discount_value}% OFF` : `৳${p.discount_value} OFF`}
              />
              <Text style={{ fontSize: 11, color: colors.faint }}>{remaining} left</Text>
            </Row>
            {p.title ? <Text style={{ fontWeight: '800', color: colors.text, marginBottom: 2 }}>{p.title}</Text> : null}
            {p.description ? (
              <Text style={{ fontSize: 12, color: colors.subtext, marginBottom: 8 }}>{p.description}</Text>
            ) : null}
            <View
              style={{
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: colors.primary,
                backgroundColor: colors.primarySoft,
                borderRadius: 10,
                paddingVertical: 10,
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <Text style={{ fontWeight: '900', fontSize: 18, letterSpacing: 3, color: colors.primaryDark }}>
                {p.code}
              </Text>
            </View>
            <Row style={{ justifyContent: 'space-between' }}>
              {p.min_fare > 0 ? (
                <Text style={{ fontSize: 11, color: colors.subtext }}>Min fare ৳{p.min_fare}</Text>
              ) : (
                <View />
              )}
              {p.valid_until ? (
                <Text style={{ fontSize: 11, color: colors.subtext }}>
                  Until {new Date(p.valid_until).toLocaleDateString()}
                </Text>
              ) : null}
            </Row>
          </Card>
        );
      })}
    </ScrollView>
  );
}
