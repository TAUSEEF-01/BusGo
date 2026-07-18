import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../store/auth';
import { Button } from '../components/ui';
import { colors } from '../theme';
import { ScreenProps } from '../nav';

export default function RegisterScreen({ navigation }: ScreenProps<'Register'>) {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);

  const register = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      Alert.alert('Registration failed', error?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.dark }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <Text style={{ fontSize: 26, fontWeight: '900', color: '#fff' }}>Create your BusGo account</Text>
        <Text style={{ color: '#94a3b8', marginTop: 6, textAlign: 'center' }}>Google securely provides your verified name and email.</Text>
      </View>
      <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 20 }}>
        <Text style={{ color: '#64748b', lineHeight: 20, marginBottom: 20 }}>Mobile registrations create a passenger account. Bus operators can select the operator role from the BusGo website.</Text>
        <Button title="Create account with Google" onPress={register} loading={busy} />
        <Button title="Already registered? Sign in" variant="ghost" onPress={() => navigation.goBack()} style={{ marginTop: 6 }} />
      </View>
    </ScrollView>
  );
}
