import click
from flask.cli import AppGroup

from .bookings import undo_bookings
from .car_rentals import seed_car_rentals, undo_car_rentals
from .guides import seed_guides, undo_guides
from .hotels import seed_hotels, undo_hotels
from .tours import seed_tours, undo_tours

seed_commands = AppGroup("seed")


def _counts():
    from app.models import Booking, Guide, GuideBooking, Hotel

    return {"stays": Hotel.query.count(), "guides": Guide.query.count(),
            "bookings": Booking.query.count(), "guide requests": GuideBooking.query.count()}


def _confirm_wipe(yes):
    """Never delete real bookings without the operator saying so explicitly."""
    counts = _counts()
    real = counts["bookings"] + counts["guide requests"]
    if real and not yes:
        click.confirm(f"This permanently deletes {counts['bookings']} booking(s) and "
                      f"{counts['guide requests']} guide request(s), including paid ones. Continue?", abort=True)


@seed_commands.command("all")
@click.option("--reset", is_flag=True, help="Delete existing stays, guides, experiences, cars and ALL bookings first.")
@click.option("--yes", is_flag=True, help="Don't ask before deleting bookings (for scripts).")
def seed(reset, yes):
    """Seed stays, guides, experiences and rental cars into an empty database."""
    counts = _counts()
    if counts["stays"] or counts["guides"]:
        if not reset:
            raise click.ClickException(
                "This database already has data, so nothing was changed. Seeding is for a new, empty database. "
                "To wipe everything (including bookings) and start again, run: flask seed all --reset")
        _confirm_wipe(yes)
        undo()
    seed_hotels()
    seed_guides()
    seed_tours()
    seed_car_rentals()
    click.echo("Seeded stays, guides, experiences and cars.")


@seed_commands.command("undo")
@click.option("--yes", is_flag=True, help="Don't ask before deleting bookings (for scripts).")
def undo_command(yes):
    """Delete all seeded data and ALL bookings."""
    _confirm_wipe(yes)
    undo()


def undo():
    undo_bookings()
    undo_tours()
    undo_guides()
    undo_car_rentals()
    undo_hotels()
