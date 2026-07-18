import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../store/auth';
import { Button, Card, Row } from '../components/ui';
import { colors } from '../theme';
import { ScreenProps } from '../nav';

export default function RegisterScreen({ navigation, route }: ScreenProps<'Register'>) {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const resumeCheckout = route.params?.resumeCheckout;
  const register = async () => { setBusy(true); try { const nextUser = await signInWithGoogle(); if (!nextUser.phone?.trim()) navigation.replace('PhoneSetup', { resumeCheckout }); else if (resumeCheckout) navigation.replace('Passenger', resumeCheckout); else navigation.popToTop(); } catch (error: any) { if (error?.message !== 'Google login was cancelled.') Alert.alert('Registration failed', error?.message || 'Please try again.'); } finally { setBusy(false); } };
  return <ScrollView style={{ flex: 1, backgroundColor: colors.dark }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
    <View style={{ alignItems: 'center', marginBottom: 24 }}><Ionicons name="person-add-outline" size={46} color="#fff" /><Text style={{ fontSize: 26, fontWeight: '900', color: '#fff', marginTop: 10 }}>Create your account</Text><Text style={{ color: '#94a3b8', marginTop: 6, textAlign: 'center' }}>Your verified Google name and email are used securely.</Text></View>
    <Card><Row style={{ gap: 10, marginBottom: 18 }}><Ionicons name="ticket-outline" size={24} color={colors.primary} /><View style={{ flex: 1 }}><Text style={{ fontWeight: '800', color: colors.text }}>Passenger account</Text><Text style={{ fontSize: 12, color: colors.subtext, marginTop: 2 }}>Search routes, book seats, pay, manage trips, and access e-tickets.</Text></View></Row><Button title="Create account with Google" icon="logo-google" onPress={register} loading={busy} /><Button title="Already registered? Sign in" variant="ghost" onPress={() => navigation.navigate('Login', { resumeCheckout })} style={{ marginTop: 6 }} /><Button title="Continue browsing" variant="ghost" onPress={() => navigation.popToTop()} /></Card>
  </ScrollView>;
}
