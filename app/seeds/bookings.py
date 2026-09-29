from ._util import truncate


def undo_bookings():
    truncate("guide_bookings")
    truncate("bookings")
