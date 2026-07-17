import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../store/auth';
import { Button, Input } from '../components/ui';
import { colors } from '../theme';
import { ScreenProps } from '../nav';
import { API_URL } from '../config';

export default function LoginScreen({ navigation }: ScreenProps<'Login'>) {
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!phone || !password) {
      Alert.alert('Missing info', 'Enter your phone (or email) and password.');
      return;
    }
    setBusy(true);
    try {
      await login(phone.trim(), password);
      // AuthProvider flips user → RootNav swaps to the app automatically.
    } catch (e: any) {
      Alert.alert('Login failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.dark }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
        <View style={{ alignItems: 'center', marginBottom: 28 }}>
          <Text style={{ fontSize: 52 }}>🚌</Text>
          <Text style={{ fontSize: 30, fontWeight: '900', color: '#fff' }}>BusGo</Text>
          <Text style={{ color: '#94a3b8', marginTop: 4 }}>Bus tickets, on your phone</Text>
        </View>

        <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 20 }}>
          <Input
            label="Phone or email"
            value={phone}
            onChangeText={setPhone}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="01XXXXXXXXX"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
          />
          <Button title="Log in" onPress={submit} loading={busy} />
          <Button
            title="New here? Create an account"
            variant="ghost"
            onPress={() => navigation.navigate('Register')}
            style={{ marginTop: 6 }}
          />
        </View>

        <Text style={{ color: '#475569', fontSize: 11, textAlign: 'center', marginTop: 18 }}>
          Server: {API_URL}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
