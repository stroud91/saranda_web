from flask.cli import AppGroup

from app.models.db import environment

from .bookings import undo_bookings
from .car_rentals import seed_car_rentals, undo_car_rentals
from .guides import seed_guides, undo_guides
from .hotels import seed_hotels, undo_hotels
from .tours import seed_tours, undo_tours

seed_commands = AppGroup("seed")


@seed_commands.command("all")
def seed():
    """Seed stays, guides, experiences and rental cars."""
    if environment == "production":
        undo()
    seed_hotels()
    seed_guides()
    seed_tours()
    seed_car_rentals()


@seed_commands.command("undo")
def undo_command():
    undo()


def undo():
    undo_bookings()
    undo_tours()
    undo_guides()
    undo_car_rentals()
    undo_hotels()
