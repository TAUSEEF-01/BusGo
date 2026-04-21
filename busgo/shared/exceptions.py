class BaseCustomException(Exception):
    pass

class BookingNotFound(BaseCustomException):
    pass

class SeatAlreadyLocked(BaseCustomException):
    pass

class PaymentFailed(BaseCustomException):
    pass

class UnauthorizedAccess(BaseCustomException):
    pass
