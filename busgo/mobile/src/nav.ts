import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/** A leg inside a transit itinerary as returned by transit-service. */
export interface ItineraryLeg {
  leg_number: number;
  trip_id: string;
  bus_id?: string | null;
  route_id?: string | null;
  bus_registration_no?: string;
  operator_id: string | null;
  operator_name?: string;
  origin_city: string;
  destination_city: string;
  departure_datetime: string;
  arrival_datetime: string;
  fare_amount: number;
  bus_type?: string;
  available_seats: number;
}

export interface Itinerary {
  itinerary_id: string;
  legs: ItineraryLeg[];
  transfers: { city: string; wait_minutes: number; arrive: string; depart: string }[];
  total_fare: number;
  operator_discount_amount: number;
  final_fare: number;
  total_duration_minutes: number;
  leg_count: number;
  is_direct: boolean;
  source: 'operator' | 'auto';
  transit_route_id: string | null;
  transit_route_name: string | null;
}

export interface DirectTrip {
  id?: string;
  trip_id?: string;
  operator_id: string;
  operator_name?: string;
  origin_city: string;
  destination_city: string;
  departure_datetime: string;
  arrival_datetime: string;
  fare_amount: number;
  available_seats?: number;
  bus_type?: string;
  bus_name?: string | null;
  bus_registration_no?: string | null;
  amenities?: string[];
  boarding_points?: { name: string; address?: string }[];
  dropping_points?: { name: string; address?: string }[];
}

export type PassengerParams = {
  mode: 'direct' | 'transit';
  origin: string;
  destination: string;
  date: string;
  trip?: DirectTrip;
  seats?: string[];
  boardingPoint?: string;
  droppingPoint?: string;
  itinerary?: Itinerary;
  seatsByLeg?: string[][];
};

export type PaymentParams = {
  mode: 'direct' | 'transit';
  bookingId: string;
  tripId: string;
  amount: number;
  expiresAt?: string;
  journeyId?: string;
  legs?: { leg_number: number; boarding_point: string; dropping_point: string; seat_numbers: string[]; fare: number }[];
  origin: string;
  destination: string;
};

export type RootStackParamList = {
  Tabs: undefined;
  Login: { resumeCheckout?: PassengerParams } | undefined;
  Register: { resumeCheckout?: PassengerParams } | undefined;
  PhoneSetup: { resumeCheckout?: PassengerParams; resumePayment?: PaymentParams } | undefined;
  Results: { origin: string; destination: string; date: string };
  Seats: { trip: DirectTrip; origin: string; destination: string; date: string };
  TransitSeats: { itinerary: Itinerary; origin: string; destination: string; date: string };
  Passenger: PassengerParams;
  Payment: PaymentParams;
  Confirmation: {
    mode: 'direct' | 'transit';
    bookingId: string;
    journeyId?: string;
    origin: string;
    destination: string;
    amount: number;
  };
  BookingDetail: { bookingId: string; journeyId?: string | null };
  TicketDetail: { ticketId: string };
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
