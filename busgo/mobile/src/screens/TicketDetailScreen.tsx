import React, { useEffect, useState } from 'react';
import { Alert, Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { api } from '../api/client';
import { Badge, Button, Card, ErrorState, Loading, Row, TicketDivider } from '../components/ui';
import { Ticket } from '../types/api';
import { colors } from '../theme';
import { dateTime, reference } from '../utils/format';
import { ScreenProps } from '../nav';
import { API_URL } from '../config';

const assetUrl = (value?: string | null) => value
  ? (value.startsWith('http://') || value.startsWith('https://') ? value : `${API_URL}${value.startsWith('/') ? '' : '/'}${value}`)
  : null;

export default function TicketDetailScreen({ route }: ScreenProps<'TicketDetail'>) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => { setError(''); try { const response = await api.get(`/api/tickets/${route.params.ticketId}`); setTicket(response.data); } catch (reason: any) { setError(reason.message); } finally { setLoading(false); } };
  useEffect(() => { load(); }, [route.params.ticketId]);
  if (loading) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}><Loading label="Loading e-ticket…" /></View>;
  if (error || !ticket) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}><ErrorState message={error || 'Ticket not found.'} onRetry={() => { setLoading(true); load(); }} /></View>;

  return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
    {/* Boarding-pass style ticket */}
    <Card style={{ marginBottom: 14, padding: 0, overflow: 'hidden' }}>
      {/* Ticket header strip */}
      <View style={styles.ticketHeader}>
        <Row style={{ gap: 8 }}>
          <View style={styles.logoBox}><Ionicons name="bus" size={16} color="#fff" /></View>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>BusGo</Text>
        </Row>
        <Badge tone={ticket.status === 'ACTIVE' ? 'success' : 'neutral'} text={ticket.status} />
      </View>

      <View style={{ padding: 18, alignItems: 'center' }}>
        <Text style={{ color: colors.faint, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 }}>E-TICKET</Text>
        <Text style={{ fontWeight: '900', fontSize: 24, color: colors.text, marginTop: 2, letterSpacing: 1 }}>{reference(ticket.id)}</Text>

        {ticket.qr_code_url
          ? <View style={styles.qrFrame}><Image source={{ uri: assetUrl(ticket.qr_code_url)! }} resizeMode="contain" style={{ width: 210, height: 210 }} /></View>
          : <View style={[styles.qrFrame, { width: 230, height: 180, alignItems: 'center', justifyContent: 'center' }]}><Ionicons name="hourglass-outline" size={26} color={colors.faint} /><Text style={{ color: colors.subtext, fontSize: 12, marginTop: 6 }}>QR image is being generated</Text></View>}

        <Row style={{ gap: 5 }}>
          <Ionicons name="scan-outline" size={13} color={colors.subtext} />
          <Text style={{ color: colors.subtext, fontSize: 12, textAlign: 'center' }}>Show this QR code when boarding. Do not share it publicly.</Text>
        </Row>

        <View style={{ alignSelf: 'stretch', paddingHorizontal: 8 }}><TicketDivider notchColor={colors.bg} /></View>

        <Row style={{ alignSelf: 'stretch', justifyContent: 'space-between', paddingHorizontal: 8 }}>
          <View>
            <Text style={styles.metaLabel}>SEATS</Text>
            <Text style={styles.metaValue}>{ticket.seat_numbers.join(', ')}</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.metaLabel}>BOOKING</Text>
            <Text style={styles.metaValue}>{reference(ticket.booking_id)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.metaLabel}>ISSUED</Text>
            <Text style={[styles.metaValue, { fontSize: 12 }]}>{dateTime(ticket.issued_at)}</Text>
          </View>
        </Row>
      </View>
    </Card>

    <Button title="Copy ticket reference" variant="outline" icon="copy-outline" onPress={async () => { await Clipboard.setStringAsync(ticket.id); Alert.alert('Copied', 'Ticket reference copied.'); }} style={{ marginBottom: 10 }} />
    {ticket.pdf_url ? <Button title="Open PDF ticket" icon="document-text-outline" onPress={() => Linking.openURL(assetUrl(ticket.pdf_url)!)} /> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  ticketHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 12 },
  logoBox: { width: 28, height: 28, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  qrFrame: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 18, padding: 10, marginVertical: 16, backgroundColor: '#fff' },
  metaLabel: { fontSize: 9, fontWeight: '800', color: colors.faint, letterSpacing: 1 },
  metaValue: { fontSize: 14, fontWeight: '900', color: colors.text, marginTop: 2 },
});
