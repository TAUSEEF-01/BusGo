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
        
        c.setFont("Helvetica", 12)
        y = height - 140
        c.drawString(50, y, f"Passenger Name: {booking.get('passenger_details', {}).get('name', 'N/A')}")
        c.drawString(50, y - 20, f"Seats: {', '.join(booking.get('seat_numbers', []))}")
        
        c.drawString(50, y - 60, f"Route: {booking.get('origin', 'N/A')} to {booking.get('destination', 'N/A')}")
        c.drawString(50, y - 80, f"Departure: {booking.get('departure_time', 'N/A')}")
        c.drawString(50, y - 100, f"Boarding Point: {booking.get('boarding_point', 'N/A')}")
        c.drawString(50, y - 120, f"Operator: {booking.get('operator_name', 'N/A')} ({booking.get('bus_type', 'N/A')})")
        
        # QR Code
        qr_image = ImageReader(io.BytesIO(qr_bytes))
        c.drawImage(qr_image, width / 2.0 - 100, y - 350, width=200, height=200)
        
        # Footer
        c.setFont("Helvetica-Oblique", 10)
        c.drawCentredString(width / 2.0, 50, "Valid for single journey only. Please present this QR code at boarding.")
        
        c.showPage()
        c.save()
        
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes
