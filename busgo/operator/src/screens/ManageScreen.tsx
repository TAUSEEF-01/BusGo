import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../store/auth';
import { Badge, Button, Card, Row, SectionTitle } from '../components/ui';
import { colors } from '../theme';
import type { OperatorStackParamList } from '../../App';

type Nav = NativeStackNavigationProp<OperatorStackParamList>;

const LINKS: { icon: keyof typeof Ionicons.glyphMap; label: string; sub: string; screen: keyof OperatorStackParamList }[] = [
  { icon: 'bus-outline', label: 'Buses', sub: 'Fleet, seat counts, transit permission', screen: 'Buses' },
  { icon: 'map-outline', label: 'Routes', sub: 'City pairs with boarding & dropping terminals', screen: 'Routes' },
  { icon: 'git-branch-outline', label: 'Transit routes', sub: 'Multi-leg connecting journeys with one payment', screen: 'TransitRoutes' },
  { icon: 'pricetags-outline', label: 'Deals & promos', sub: 'Promo codes and flash sales', screen: 'Deals' },
  { icon: 'rocket-outline', label: 'Fill empty seats', sub: 'Offer discounts to likely travellers', screen: 'FillSeats' },
  { icon: 'megaphone-outline', label: 'Message passengers', sub: 'Send a notification to your customers', screen: 'Notify' },
];

export default function ManageScreen() {
  const navigation = useNavigation<Nav>();
  const { user, logout } = useAuth();
  const initials = (user?.full_name || 'O').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const confirmLogout = () => Alert.alert('Log out?', 'You will need your Google account to sign in again.', [
    { text: 'Stay signed in', style: 'cancel' },
    { text: 'Log out', style: 'destructive', onPress: logout },
  ]);

  return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
    <Card style={{ marginBottom: 14 }}>
      <Row style={{ gap: 12 }}>
        <View style={styles.avatar}><Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>{initials}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '900', color: colors.text, fontSize: 16 }}>{user?.full_name || 'Operator'}</Text>
          <Text style={{ fontSize: 12, color: colors.subtext }} numberOfLines={1}>{user?.email}</Text>
          <View style={{ marginTop: 4 }}><Badge tone="primary" text={user?.role || 'OPERATOR'} /></View>
        </View>
      </Row>
    </Card>

    <SectionTitle title="Manage" />
    {LINKS.map((link) => <Pressable key={link.screen} onPress={() => navigation.navigate(link.screen)}>
      <Card style={{ marginBottom: 10 }}>
        <Row style={{ gap: 12 }}>
          <View style={styles.linkIcon}><Ionicons name={link.icon} size={20} color={colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '800', color: colors.text }}>{link.label}</Text>
            <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 1 }}>{link.sub}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        </Row>
      </Card>
    </Pressable>)}

    <Button title="Log out" variant="outline" icon="log-out-outline" onPress={confirmLogout} style={{ marginTop: 8 }} />
  </ScrollView>;
}

const styles = StyleSheet.create({
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center' },
  linkIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
