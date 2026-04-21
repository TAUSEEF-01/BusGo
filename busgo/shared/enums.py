from enum import Enum

class BookingStatus(str, Enum):
    INITIATED = 'INITIATED'
    SEAT_LOCKED = 'SEAT_LOCKED'
    PAYMENT_PENDING = 'PAYMENT_PENDING'
    CONFIRMED = 'CONFIRMED'
    CANCELLED = 'CANCELLED'
    REFUNDED = 'REFUNDED'
    EXPIRED = 'EXPIRED'

class PaymentMethod(str, Enum):
    BKASH = 'BKASH'
    NAGAD = 'NAGAD'
    CARD = 'CARD'
    INTERNET_BANKING = 'INTERNET_BANKING'

class UserRole(str, Enum):
    CUSTOMER = 'CUSTOMER'
    OPERATOR = 'OPERATOR'
    ADMIN = 'ADMIN'

class TicketStatus(str, Enum):
    ACTIVE = 'ACTIVE'
    USED = 'USED'
    CANCELLED = 'CANCELLED'
    EXPIRED = 'EXPIRED'
