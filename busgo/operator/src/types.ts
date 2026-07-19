export interface RoutePoint { name: string; address?: string; lat?: number; lng?: number }

export interface Bus {
  id: string; operator_id: string; registration_no: string;
  bus_type: 'AC' | 'NON_AC' | 'SLEEPER'; total_seats: number;
  is_active: boolean; allow_transit?: boolean; amenities?: string[];
}

export interface RouteDef {
  id: string; operator_id: string; origin_city: string; destination_city: string;
  distance_km: number; estimated_duration_hours: number;
  boarding_points?: RoutePoint[]; dropping_points?: RoutePoint[];
}

export interface Trip {
  id: string; trip_id?: string; operator_id: string; bus_id: string; route_id: string;
  departure_datetime: string; arrival_datetime: string; fare_amount: number;
  available_seats?: number; status: string; allow_transit?: boolean;
  origin_city?: string; destination_city?: string; bus_registration_no?: string; bus_type?: string;
  operator_name?: string;
}

export interface Seat { seat_number: string; status: 'AVAILABLE' | 'LOCKED' | 'BOOKED' }

export interface OperatorBooking {
  id: string; trip_id: string; user_id: string; status: string; total_fare: number;
  seat_numbers: string[]; passenger_details?: { name: string; age: number; gender: string; seat: string }[];
  boarding_point: string; dropping_point: string; origin_city?: string | null; destination_city?: string | null;
  journey_date: string; departure_time: string; created_at: string;
  operator_name?: string | null; bus_registration_no?: string | null; bus_type?: string | null;
}

export interface Promo {
  id: string; code: string; title?: string | null; description?: string | null;
  discount_type: 'PERCENTAGE' | 'FLAT'; discount_value: number; min_fare: number;
  max_discount?: number | null; max_uses: number; current_uses: number;
  valid_from?: string | null; valid_until?: string | null; is_active: boolean;
  operator_id?: string | null;
}

export interface FlashSale {
  id: string; name: string; description?: string | null; discount_percentage: number;
  start_time: string; end_time: string; is_active: boolean; operator_id?: string | null;
}

export interface TransitLegAssignment { bus_id: string; route_id: string }

export interface TransitRoute {
  id: string; operator_id: string; name: string; origin_city: string; destination_city: string;
  via_cities: string[]; leg_assignments: TransitLegAssignment[];
  combined_discount_pct: number; is_active?: boolean;
}

export interface FillCandidate {
  user_id: string; full_name?: string | null; email?: string | null;
  score?: number; trips_on_route?: number; last_travelled?: string | null;
}
