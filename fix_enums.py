import glob
import re

enum_map = {
    'UserRole': 'user_role',
    'BookingStatus': 'booking_status',
    'PaymentMethod': 'payment_method',
    'PaymentStatus': 'payment_status',
    'RefundStatus': 'refund_status',
    'TicketStatus': 'ticket_status',
    'SeatType': 'seat_type',
    'SeatStatus': 'seat_status',
    'BusType': 'bus_type',
    'TripStatus': 'trip_status',
    'CancellationStatus': 'cancellation_status',
    'DiscountType': 'discount_type',
    'NotificationChannel': 'notification_channel',
    'NotificationStatus': 'notification_status'
}

for filepath in glob.glob('busgo/services/*/models/*.py') + glob.glob('busgo/services/*/models.py'):
    with open(filepath, 'r') as f:
        content = f.read()
        
    original = content
    for class_name, db_name in enum_map.items():
        # Match Enum(ClassName) and replace with Enum(ClassName, name="db_name")
        pattern = r'Enum\(\s*' + class_name + r'\s*\)'
        replacement = f'Enum({class_name}, name="{db_name}")'
        content = re.sub(pattern, replacement, content)
        
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f'Updated enums in {filepath}')
