export interface Passenger { name: string; age: number; gender: string; seat: string }

export interface Booking {
  id: string; trip_id: string; journey_id?: string | null; leg_number?: number | null;
  operator_id: string; operator_name?: string | null; status: string; total_fare: number;
  discount_amount?: number; seat_numbers: string[]; passenger_details?: Passenger[];
  boarding_point: string; dropping_point: string; origin_city?: string | null;
  destination_city?: string | null; journey_date: string; departure_time: string;
  departure_datetime?: string | null; arrival_datetime?: string | null;
  bus_type?: string | null; bus_registration_no?: string | null; bus_name?: string | null;
  amenities?: string[]; promo_code?: string | null;
  expires_at: string; created_at: string;
}

/** One bus inside a multi-leg journey, as serialized by booking-service. */
export interface JourneyLeg {
  leg_number: number; booking_id: string; trip_id: string;
  operator_id?: string | null; operator_name?: string;
  bus_registration_no?: string | null; bus_type?: string | null; bus_name?: string | null;
  origin_city: string; destination_city: string;
  boarding_point: string; dropping_point: string;
  journey_date?: string | null; departure_time?: string | null;
  departure_datetime?: string | null; arrival_datetime?: string | null;
  amenities?: string[]; seat_numbers: string[]; passenger_details?: Passenger[];
  fare: number; status: string;
}

export interface Journey {
  journey_id: string; user_id: string; origin: string; destination: string;
  leg_count: number; status: string; total_fare: number; discount_amount: number;
  final_fare: number; promo_code?: string | null; transit_route_id?: string | null;
  payment_id?: string | null; created_at?: string | null; expires_at?: string | null;
  transfers: { city: string; wait_minutes?: number | null; arrival_datetime?: string | null; departure_datetime?: string | null }[];
  legs: JourneyLeg[];
}

export interface Payment {
  id: string; booking_id?: string | null; user_id: string; amount: number;
  method: string; status: string; transaction_ref?: string | null;
  created_at: string; completed_at?: string | null;
}

export interface Ticket {
  id: string; booking_id: string; trip_id: string; seat_numbers: string[];
  passenger_details: Passenger[] | Record<string, unknown>; qr_code_url?: string | null;
  pdf_url?: string | null; status: string; issued_at: string; used_at?: string | null;
  expires_at?: string | null;
}

export interface NotificationItem {
  id: string; type: string; title: string; message: string; is_read: boolean;
  metadata?: Record<string, any> | null; created_at: string;
}

export interface Promo {
  id: string; code: string; title?: string | null; description?: string | null;
  discount_type: 'PERCENTAGE' | 'FIXED'; discount_value: number; min_fare: number;
  max_discount?: number | null; max_uses: number; current_uses: number;
  valid_from?: string | null; valid_until?: string | null; is_active: boolean;
}

export interface FlashSale {
  id: string; name: string; description?: string | null;
  discount_percentage: number; start_time: string; end_time: string; is_active: boolean;
}
