import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../store/auth';
import { Button, Card, Row } from '../components/ui';
import { colors } from '../theme';
import { ScreenProps } from '../nav';

export default function LoginScreen({ navigation, route }: ScreenProps<'Login'>) {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const resumeCheckout = route.params?.resumeCheckout;
  const signIn = async () => { setBusy(true); try { const nextUser = await signInWithGoogle(); if (!nextUser.phone?.trim()) navigation.replace('PhoneSetup', { resumeCheckout }); else if (resumeCheckout) navigation.replace('Passenger', resumeCheckout); else navigation.popToTop(); } catch (error: any) { if (error?.message !== 'Google login was cancelled.') Alert.alert('Google login failed', error?.message || 'Please try again.'); } finally { setBusy(false); } };
  return <ScrollView style={{ flex: 1, backgroundColor: colors.dark }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
    <View style={{ alignItems: 'center', marginBottom: 28 }}><View style={{ width: 76, height: 76, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="bus" size={42} color="#fff" /></View><Text style={{ fontSize: 31, fontWeight: '900', color: '#fff', marginTop: 12 }}>BusGo</Text><Text style={{ color: '#94a3b8', marginTop: 4 }}>One secure account for every journey</Text></View>
    <Card><Text style={{ fontSize: 21, fontWeight: '900', color: colors.text }}>Welcome back</Text><Text style={{ color: colors.subtext, lineHeight: 20, marginTop: 6, marginBottom: 20 }}>{resumeCheckout ? 'Sign in to keep your selected seats and continue checkout.' : 'Sign in with the Google account connected to BusGo. Your bookings and tickets are restored automatically.'}</Text><Button title="Continue with Google" icon="logo-google" onPress={signIn} loading={busy} /><Button title="Create a passenger account" variant="ghost" onPress={() => navigation.navigate('Register', { resumeCheckout })} style={{ marginTop: 6 }} /><Button title="Continue browsing" variant="ghost" onPress={() => navigation.popToTop()} /></Card>
    <Row style={{ justifyContent: 'center', gap: 6, marginTop: 18 }}><Ionicons name="shield-checkmark-outline" size={15} color="#64748b" /><Text style={{ color: '#64748b', fontSize: 11 }}>Google-secured sign-in · No BusGo password</Text></Row>
  </ScrollView>;
}
