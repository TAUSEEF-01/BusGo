import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/** A leg inside a transit itinerary as returned by transit-service. */
export interface ItineraryLeg {
  leg_number: number;
  trip_id: string;
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
}

export type RootStackParamList = {
  Tabs: undefined;
  Login: undefined;
  Register: undefined;
  Results: { origin: string; destination: string; date: string };
  Seats: { trip: DirectTrip; origin: string; destination: string; date: string };
  TransitSeats: { itinerary: Itinerary; origin: string; destination: string; date: string };
  Passenger: {
    mode: 'direct' | 'transit';
    origin: string;
    destination: string;
    date: string;
    // direct
    trip?: DirectTrip;
    seats?: string[];
    // transit
    itinerary?: Itinerary;
    seatsByLeg?: string[][];
  };
  Payment: {
    mode: 'direct' | 'transit';
    bookingId: string; // first leg's booking for transit
    tripId: string;
    amount: number;
    journeyId?: string;
    legs?: { leg_number: number; boarding_point: string; dropping_point: string; seat_numbers: string[]; fare: number }[];
    origin: string;
    destination: string;
  };
  Confirmation: {
    mode: 'direct' | 'transit';
    bookingId: string;
    journeyId?: string;
    origin: string;
    destination: string;
    amount: number;
  };
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
