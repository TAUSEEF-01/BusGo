import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Card } from './ui';
import { colors } from '../theme';
import type { PassengerParams, RootStackParamList } from '../nav';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function GuestAccess({
  title = 'Sign in to continue',
  message = 'Log in or create a free passenger account to access this section.',
  resumeCheckout,
}: {
  title?: string;
  message?: string;
  resumeCheckout?: PassengerParams;
}) {
  const navigation = useNavigation<Nav>();
  return <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: colors.bg }}>
    <Card style={{ alignItems: 'center' }}>
      <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}><Ionicons name="person-circle-outline" size={38} color={colors.primary} /></View>
      <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text, textAlign: 'center' }}>{title}</Text>
      <Text style={{ color: colors.subtext, textAlign: 'center', lineHeight: 20, marginTop: 7, marginBottom: 18 }}>{message}</Text>
      <Button title="Log in with Google" icon="logo-google" onPress={() => navigation.navigate('Login', { resumeCheckout })} style={{ width: '100%' }} />
      <Button title="Create account" variant="outline" icon="person-add-outline" onPress={() => navigation.navigate('Register', { resumeCheckout })} style={{ width: '100%', marginTop: 9 }} />
    </Card>
  </View>;
}
