import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";
import { FaLock, FaWhatsapp, FaArrowLeft } from "react-icons/fa";

const Page = styled.div`
  min-height: 100vh;
  padding-top: 70px;
  background: ${({ theme }) => theme.colors.background};
`;

const Inner = styled.div`
  max-width: 880px;
  margin: 0 auto;
  padding: 40px 24px;
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 40px;
  align-items: start;

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

const BackLink = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.9rem;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  margin-bottom: 24px;

  &:hover {
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const FormSection = styled.div``;

const StepTitle = styled.h2`
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: 1.5rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: 24px;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 14px;

  @media (max-width: 500px) {
    grid-template-columns: 1fr;
  }
`;

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;

  label {
    font-size: 0.8rem;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  input,
  textarea,
  select {
    padding: 10px 12px;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.radius.sm};
    font-size: 0.95rem;
    font-family: inherit;
    color: ${({ theme }) => theme.colors.text};
    background: ${({ theme }) => theme.colors.surface};
    outline: none;
    transition: border-color 0.2s;

    &:focus {
      border-color: ${({ theme }) => theme.colors.primary};
    }
  }

  textarea {
    resize: vertical;
    min-height: 80px;
  }
`;

const FullWidth = styled(FieldGroup)`
  grid-column: 1 / -1;
`;

const Divider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.colors.border};
  margin: 24px 0;
`;

const PaymentNote = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  background: ${({ theme }) => theme.colors.surfaceAlt};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  padding: 14px 16px;
  font-size: 0.88rem;
  color: ${({ theme }) => theme.colors.textMuted};
  margin-bottom: 20px;

  svg {
    color: ${({ theme }) => theme.colors.primary};
    flex-shrink: 0;
  }
`;

const SubmitBtn = styled.button`
  width: 100%;
  background-color: ${({ theme }) => theme.colors.primary};
  color: #fff;
  font-weight: 700;
  font-size: 1rem;
  padding: 0.95rem;
  border-radius: ${({ theme }) => theme.radius.pill};
  transition: background-color 0.2s;
  border: none;
  cursor: pointer;
  margin-bottom: 10px;

  &:hover:not(:disabled) {
    background-color: ${({ theme }) => theme.colors.primaryHover};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const WhatsAppAlt = styled.a`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  background: ${({ theme }) => theme.colors.whatsapp};
  color: #fff;
  font-weight: 600;
  font-size: 0.92rem;
  padding: 0.8rem;
  border-radius: ${({ theme }) => theme.radius.pill};
  transition: background-color 0.2s;

  &:hover {
    background-color: ${({ theme }) => theme.colors.whatsappHover};
  }
`;

const OrDivider = styled.div`
  text-align: center;
  font-size: 0.82rem;
  color: ${({ theme }) => theme.colors.textMuted};
  margin: 10px 0;
`;

/* ── Summary Card ── */
const SummaryCard = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.lg};
  padding: 24px;
  box-shadow: ${({ theme }) => theme.shadow.card};
  position: sticky;
  top: 90px;
`;

const SummaryImg = styled.div`
  width: 100%;
  height: 160px;
  border-radius: ${({ theme }) => theme.radius.md};
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.primary} 0%, #2d4a7a 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  span {
    font-family: ${({ theme }) => theme.fonts.display};
    font-size: 2.5rem;
    font-weight: 900;
    color: rgba(255, 255, 255, 0.3);
  }
`;

const SummaryName = styled.h3`
  font-size: 0.95rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: 4px;
`;

const SummaryMeta = styled.p`
  font-size: 0.82rem;
  color: ${({ theme }) => theme.colors.textMuted};
  margin-bottom: 16px;
`;

const CostBreakdown = styled.div`
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  padding-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  .row {
    display: flex;
    justify-content: space-between;
    font-size: 0.88rem;
    color: ${({ theme }) => theme.colors.textMuted};
  }

  .total {
    display: flex;
    justify-content: space-between;
    font-weight: 700;
    font-size: 1rem;
    color: ${({ theme }) => theme.colors.text};
    padding-top: 10px;
    border-top: 1px solid ${({ theme }) => theme.colors.border};
    margin-top: 4px;
  }
`;

const WHATSAPP_URL =
  "https://wa.me/355000000000?text=Hello%2C%20I%27d%20like%20to%20book%20an%20apartment%20at%20Meg%27Rooms.";

const BookingPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const stateData = location.state || {};
  const [hotel, setHotel] = useState(stateData.hotel || null);
  const [checkIn, setCheckIn] = useState(stateData.checkIn || "");
  const [checkOut, setCheckOut] = useState(stateData.checkOut || "");
  const [guests, setGuests] = useState(stateData.guests || 1);

  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hotel) {
      fetch(`/api/hotels/${id}`)
        .then((r) => r.json())
        .then(setHotel)
        .catch(() => {});
    }
  }, [id, hotel]);

  const price = hotel ? Number(hotel.price_per_night) : 0;
  const cleaningFee = 25;
  const nights =
    checkIn && checkOut
      ? Math.max(0, (new Date(checkOut) - new Date(checkIn)) / 86400000)
      : 0;
  const total = nights > 0 ? nights * price + cleaningFee : 0;
  const amountCents = Math.round(total * 100);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (nights < 1) return setError("Please select valid check-in and check-out dates.");
    if (!guestName.trim() || !guestEmail.trim())
      return setError("Name and email are required.");

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotel_id: hotel.id,
          start_date: checkIn,
          end_date: checkOut,
          guest_name: guestName,
          guest_email: guestEmail,
          guest_phone: guestPhone,
          guest_count: guests,
          notes,
          amount_cents: amountCents,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Booking failed");

      navigate(`/booking/confirmation/${data.booking.id}`, {
        state: {
          booking: data.booking,
          hotel,
          total,
          nights,
          clientSecret: data.clientSecret,
        },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!hotel) return null;

  const today = new Date().toISOString().split("T")[0];

  return (
    <Page>
      <Inner>
        <FormSection>
          <BackLink onClick={() => navigate(-1)}>
            <FaArrowLeft /> Back to apartment
          </BackLink>

          <StepTitle>Complete Your Booking</StepTitle>

          <form onSubmit={handleSubmit}>
            <FormGrid>
              <FieldGroup>
                <label>Check-in</label>
                <input
                  type="date"
                  min={today}
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  required
                />
              </FieldGroup>
              <FieldGroup>
                <label>Check-out</label>
                <input
                  type="date"
                  min={checkIn || today}
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  required
                />
              </FieldGroup>
              <FieldGroup>
                <label>Guests</label>
                <select
                  value={guests}
                  onChange={(e) => setGuests(Number(e.target.value))}
                >
                  {[...Array(hotel.max_guests || 6)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1} guest{i > 0 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </FieldGroup>
            </FormGrid>

            <Divider />

            <FormGrid>
              <FieldGroup>
                <label>First & Last Name</label>
                <input
                  type="text"
                  placeholder="Jane Smith"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  required
                />
              </FieldGroup>
              <FieldGroup>
                <label>Email</label>
                <input
                  type="email"
                  placeholder="jane@example.com"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  required
                />
              </FieldGroup>
              <FieldGroup>
                <label>Phone (optional)</label>
                <input
                  type="tel"
                  placeholder="+1 555 000 0000"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                />
              </FieldGroup>
              <FullWidth>
                <label>Special requests (optional)</label>
                <textarea
                  placeholder="Early check-in, extra pillows, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </FullWidth>
            </FormGrid>

            <Divider />

            <PaymentNote>
              <FaLock />
              <span>
                Clicking "Reserve" creates your booking. You'll receive a
                confirmation email. Payment is secured via Stripe.
              </span>
            </PaymentNote>

            {error && (
              <p style={{ color: "#EF4444", fontSize: "0.88rem", marginBottom: "12px" }}>
                {error}
              </p>
            )}

            <SubmitBtn type="submit" disabled={loading || nights < 1}>
              {loading
                ? "Processing…"
                : `Reserve — €${total > 0 ? total.toFixed(0) : "—"}`}
            </SubmitBtn>

            <OrDivider>or</OrDivider>

            <WhatsAppAlt
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaWhatsapp />
              Book via WhatsApp instead
            </WhatsAppAlt>
          </form>
        </FormSection>

        {/* Summary sidebar */}
        <SummaryCard>
          <SummaryImg>
            {hotel.image_urls && hotel.image_urls[0] ? (
              <img src={hotel.image_urls[0]} alt={hotel.hotel_name} />
            ) : (
              <span>MEG</span>
            )}
          </SummaryImg>
          <SummaryName>{hotel.hotel_name}</SummaryName>
          <SummaryMeta>
            {hotel.bedrooms} bedroom · {hotel.max_guests} guests · {hotel.city}
          </SummaryMeta>

          {nights > 0 && (
            <CostBreakdown>
              <div className="row">
                <span>
                  €{price.toFixed(0)} × {nights} night{nights !== 1 ? "s" : ""}
                </span>
                <span>€{(price * nights).toFixed(0)}</span>
              </div>
              <div className="row">
                <span>Cleaning fee</span>
                <span>€{cleaningFee}</span>
              </div>
              <div className="total">
                <span>Total</span>
                <span>€{total.toFixed(0)}</span>
              </div>
            </CostBreakdown>
          )}
        </SummaryCard>
      </Inner>
    </Page>
  );
};

export default BookingPage;
