import qrcode
import io

class QRGenerator:
    @staticmethod
    def generate_qr(data: str) -> bytes:
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=4,
        )
        qr.add_data(data)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        
        byte_stream = io.BytesIO()
        img.save(byte_stream, format='PNG')
        return byte_stream.getvalue()
