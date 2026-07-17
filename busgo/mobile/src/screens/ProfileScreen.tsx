import React from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../store/auth';
import { Button, Card, Row } from '../components/ui';
import { colors } from '../theme';
import { API_URL } from '../config';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const confirmLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const initials =
    (user?.full_name || 'U')
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <View style={{ alignItems: 'center', paddingVertical: 24 }}>
        <View
          style={{
            width: 84,
            height: 84,
            borderRadius: 999,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900' }}>{initials}</Text>
        </View>
        <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text, marginTop: 12 }}>
          {user?.full_name || 'Traveller'}
        </Text>
        <Text style={{ color: colors.subtext, fontSize: 13 }}>{user?.role || 'CUSTOMER'}</Text>
      </View>

      <Card style={{ marginBottom: 14 }}>
        <InfoRow label="Phone" value={user?.phone || '—'} />
        <InfoRow label="Email" value={user?.email || '—'} />
        <InfoRow label="User ID" value={user?.id ? `${user.id.slice(0, 8)}…` : '—'} />
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <Text style={{ fontWeight: '800', color: colors.text, marginBottom: 6 }}>Connection</Text>
        <Text style={{ fontSize: 12, color: colors.subtext }}>Backend: {API_URL}</Text>
        <Text style={{ fontSize: 11, color: colors.faint, marginTop: 4 }}>
          The app talks to the BusGo gateway (Kong) on your PC. Phone and PC must be on the same Wi-Fi.
        </Text>
      </Card>

      <Button title="Log out" variant="outline" onPress={confirmLogout} />
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
      <Text style={{ color: colors.subtext, fontSize: 13 }}>{label}</Text>
      <Text style={{ fontWeight: '700', color: colors.text, fontSize: 13 }}>{value}</Text>
    </Row>
  );
}
