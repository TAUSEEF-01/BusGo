import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../store/auth';
import { Button, Input } from '../components/ui';
import { colors } from '../theme';
import { ScreenProps } from '../nav';

export default function RegisterScreen({ navigation }: ScreenProps<'Register'>) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name || !phone || !email || !password) {
      Alert.alert('Missing info', 'All fields are required.');
      return;
    }
    setBusy(true);
    try {
      await register(name.trim(), phone.trim(), email.trim(), password);
    } catch (e: any) {
      Alert.alert('Registration failed', e.message);
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
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <Text style={{ fontSize: 26, fontWeight: '900', color: '#fff' }}>Create your account</Text>
          <Text style={{ color: '#94a3b8', marginTop: 4 }}>Book buses in minutes</Text>
        </View>
        <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 20 }}>
          <Input label="Full name" value={name} onChangeText={setName} placeholder="As per NID" />
          <Input
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="01XXXXXXXXX"
          />
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Choose a password"
          />
          <Button title="Create account" onPress={submit} loading={busy} />
          <Button
            title="Already have an account? Log in"
            variant="ghost"
            onPress={() => navigation.goBack()}
            style={{ marginTop: 6 }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
