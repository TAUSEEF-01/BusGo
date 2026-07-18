import io
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

class PDFGenerator:
    @staticmethod
    def generate_ticket_pdf(booking: dict, qr_bytes: bytes) -> bytes:
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=letter)
        width, height = letter
        
        # Header
        c.setFont("Helvetica-Bold", 24)
        c.drawCentredString(width / 2.0, height - 50, "BusGo E-Ticket")
        
        c.setFont("Helvetica", 14)
        c.drawString(50, height - 100, f"Booking Reference: {booking.get('id', 'N/A')}")
        if booking.get('journey_id'):
            c.drawString(50, height - 120, f"Transit Journey: Bus {booking.get('leg_number', 'N/A')} ticket")
        
        passenger_details = booking.get('passenger_details') or []
        if isinstance(passenger_details, dict):
            passenger_details = [passenger_details]
        passenger_names = ", ".join(
            str(passenger.get('name') or passenger.get('full_name') or 'Passenger')
            for passenger in passenger_details
        ) or 'N/A'
        seat_numbers = booking.get('seat_numbers', [])
        passenger_seats = ", ".join(
            f"{passenger.get('name') or passenger.get('full_name') or 'Passenger'} (Seat {seat_numbers[index] if index < len(seat_numbers) else passenger.get('seat', 'N/A')})"
            for index, passenger in enumerate(passenger_details)
        ) or 'N/A'

        c.setFont("Helvetica", 12)
        y = height - (160 if booking.get('journey_id') else 140)
        c.drawString(50, y, f"Passengers: {passenger_names}")
        c.setFont("Helvetica", 9)
        c.drawString(50, y - 20, f"Passenger Seats: {passenger_seats}")
        c.setFont("Helvetica", 12)
        c.drawString(50, y - 60, f"Route: {booking.get('origin', 'N/A')} to {booking.get('destination', 'N/A')}")
        c.drawString(50, y - 80, f"Departure: {booking.get('departure_time', 'N/A')}")
        c.drawString(50, y - 100, f"Arrival: {booking.get('arrival_time', 'N/A')}")
        c.drawString(50, y - 120, f"Boarding Point: {booking.get('boarding_point', 'N/A')}")
        c.drawString(50, y - 140, f"Operator: {booking.get('operator_name', 'N/A')} ({booking.get('bus_type', 'N/A')})")
        c.drawString(50, y - 160, f"Coach / Bus: {booking.get('bus_registration_no') or 'To be assigned'}")
        
        # QR Code
        qr_image = ImageReader(io.BytesIO(qr_bytes))
        c.drawImage(qr_image, width / 2.0 - 90, y - 380, width=180, height=180)
        
        # Footer
        c.setFont("Helvetica-Oblique", 10)
        footer = "Valid only for this bus leg. Present this QR code and use the separate ticket for each connecting bus." if booking.get('journey_id') else "Valid for single journey only. Please present this QR code at boarding."
        c.drawCentredString(width / 2.0, 50, footer)
        
        c.showPage()
        c.save()
        
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes
