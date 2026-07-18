import React, { useEffect, useState } from 'react';
import { Alert, Image, Linking, ScrollView, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { api } from '../api/client';
import { Badge, Button, Card, ErrorState, Loading, Row } from '../components/ui';
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
    <Card style={{ alignItems: 'center', marginBottom: 14 }}><Text style={{ color: colors.subtext, fontSize: 11 }}>E-TICKET</Text><Text style={{ fontWeight: '900', fontSize: 22, color: colors.text, marginTop: 2 }}>{reference(ticket.id)}</Text><View style={{ marginTop: 8 }}><Badge tone={ticket.status === 'ACTIVE' ? 'success' : 'neutral'} text={ticket.status} /></View>
      {ticket.qr_code_url ? <Image source={{ uri: assetUrl(ticket.qr_code_url)! }} resizeMode="contain" style={{ width: 230, height: 230, marginVertical: 16 }} /> : <View style={{ width: 230, height: 180, marginVertical: 16, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.subtext }}>QR image is being generated</Text></View>}
      <Text style={{ color: colors.subtext, fontSize: 12, textAlign: 'center' }}>Show this QR code when boarding. Do not share it publicly.</Text>
    </Card>
    <Card style={{ marginBottom: 14 }}><Row style={{ justifyContent: 'space-between', marginBottom: 8 }}><Text style={{ color: colors.subtext }}>Seats</Text><Text style={{ fontWeight: '800', color: colors.text }}>{ticket.seat_numbers.join(', ')}</Text></Row><Row style={{ justifyContent: 'space-between', marginBottom: 8 }}><Text style={{ color: colors.subtext }}>Booking</Text><Text style={{ fontWeight: '800', color: colors.text }}>{reference(ticket.booking_id)}</Text></Row><Row style={{ justifyContent: 'space-between' }}><Text style={{ color: colors.subtext }}>Issued</Text><Text style={{ fontWeight: '700', color: colors.text }}>{dateTime(ticket.issued_at)}</Text></Row></Card>
    <Button title="Copy ticket reference" variant="outline" icon="copy-outline" onPress={async () => { await Clipboard.setStringAsync(ticket.id); Alert.alert('Copied', 'Ticket reference copied.'); }} style={{ marginBottom: 10 }} />
    {ticket.pdf_url ? <Button title="Open PDF ticket" icon="document-text-outline" onPress={() => Linking.openURL(assetUrl(ticket.pdf_url)!)} /> : null}
  </ScrollView>;
}
