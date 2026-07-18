import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../store/auth';
import { Button } from '../components/ui';
import { colors } from '../theme';
import { ScreenProps } from '../nav';

export default function LoginScreen({ navigation }: ScreenProps<'Login'>) {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      Alert.alert('Google login failed', error?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.dark }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
      <View style={{ alignItems: 'center', marginBottom: 28 }}>
        <Text style={{ fontSize: 52 }}>🚌</Text>
        <Text style={{ fontSize: 30, fontWeight: '900', color: '#fff' }}>BusGo</Text>
        <Text style={{ color: '#94a3b8', marginTop: 4 }}>One secure account for every journey</Text>
      </View>
      <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 20 }}>
        <Text style={{ fontSize: 21, fontWeight: '900', color: colors.text, marginBottom: 8 }}>Welcome back</Text>
        <Text style={{ color: '#64748b', lineHeight: 20, marginBottom: 20 }}>Sign in with the Google account connected to BusGo. Your bookings and profile will be restored automatically.</Text>
        <Button title="Continue with Google" onPress={signIn} loading={busy} />
        <Button title="New here? Create an account" variant="ghost" onPress={() => navigation.navigate('Register')} style={{ marginTop: 6 }} />
      </View>
    </ScrollView>
  );
}
