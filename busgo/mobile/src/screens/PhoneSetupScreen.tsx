import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../store/auth';
import { Button, Card, Input, Row } from '../components/ui';
import { colors } from '../theme';
import { ScreenProps } from '../nav';

export default function PhoneSetupScreen({ navigation, route }: ScreenProps<'PhoneSetup'>) {
  const { user, updateProfile } = useAuth();
  const [phone, setPhone] = useState(user?.phone || '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const digits = phone.replace(/\D/g, '');
    const normalizedPhone = digits.startsWith('880') && digits.length === 13 ? `0${digits.slice(3)}` : digits;
    if (!/^01\d{9}$/.test(normalizedPhone)) {
      Alert.alert('Phone number', 'Enter a valid 11-digit Bangladeshi phone number.');
      return;
    }
    setBusy(true);
    try {
      await updateProfile(user?.full_name || 'BusGo Traveller', normalizedPhone);
      if (route.params?.resumePayment) navigation.replace('Payment', route.params.resumePayment);
      else if (route.params?.resumeCheckout) navigation.replace('Passenger', route.params.resumeCheckout);
      else navigation.replace('Tabs');
    } catch (reason: any) {
      Alert.alert('Could not save phone', reason.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }} keyboardShouldPersistTaps="handled">
    <View style={{ alignItems: 'center', marginBottom: 18 }}><View style={{ width: 66, height: 66, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="call" size={32} color="#fff" /></View></View>
    <Card>
      <Text style={{ fontSize: 21, fontWeight: '900', color: colors.text }}>Add your phone number</Text>
      <Text style={{ color: colors.subtext, lineHeight: 20, marginTop: 7, marginBottom: 18 }}>Google does not provide it to BusGo. We need it once to register your payment wallet and process ticket purchases.</Text>
      <Input label="Bangladeshi mobile number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="01XXXXXXXXX" autoFocus maxLength={17} />
      <Button title="Save and continue" icon="checkmark-circle-outline" onPress={save} loading={busy} />
      <Row style={{ justifyContent: 'center', gap: 6, marginTop: 14 }}><Ionicons name="shield-checkmark-outline" size={15} color={colors.faint} /><Text style={{ color: colors.faint, fontSize: 11 }}>Saved securely to your BusGo account</Text></Row>
    </Card>
  </ScrollView>;
}
