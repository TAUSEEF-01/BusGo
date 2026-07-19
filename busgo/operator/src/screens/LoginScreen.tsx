import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../store/auth';
import { Button, Card, Row } from '../components/ui';
import { colors } from '../theme';

export default function LoginScreen() {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const signIn = async () => {
    setBusy(true);
    try { await signInWithGoogle(); }
    catch (error: any) { if (error?.message !== 'Google login was cancelled.') Alert.alert('Operator login failed', error?.message || 'Please try again.'); }
    finally { setBusy(false); }
  };
  return <ScrollView style={{ flex: 1, backgroundColor: colors.dark }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
    <StatusBar style="light" />
    <View style={{ alignItems: 'center', marginBottom: 28 }}>
      <View style={{ width: 76, height: 76, borderRadius: 22, backgroundColor: colors.darkSoft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="bus" size={42} color="#fff" /></View>
      <Text style={{ fontSize: 31, fontWeight: '900', color: '#fff', marginTop: 12 }}>BusGo</Text>
      <View style={{ backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 4, marginTop: 7 }}>
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12, letterSpacing: 2 }}>OPERATOR</Text>
      </View>
      <Text style={{ color: '#94a3b8', marginTop: 10 }}>Run your fleet from your pocket</Text>
    </View>
    <Card>
      <Text style={{ fontSize: 21, fontWeight: '900', color: colors.text }}>Operator sign-in</Text>
      <Text style={{ color: colors.subtext, lineHeight: 20, marginTop: 6, marginBottom: 20 }}>Sign in with the Google account registered as a BusGo operator. Passenger accounts cannot use this app.</Text>
      <Button title="Continue with Google" icon="logo-google" onPress={signIn} loading={busy} />
    </Card>
    <Row style={{ justifyContent: 'center', gap: 6, marginTop: 18 }}>
      <Ionicons name="shield-checkmark-outline" size={15} color="#64748b" />
      <Text style={{ color: '#64748b', fontSize: 11 }}>Google-secured sign-in · Operator accounts only</Text>
    </Row>
  </ScrollView>;
}
