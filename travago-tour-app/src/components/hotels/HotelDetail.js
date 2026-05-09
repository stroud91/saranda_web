import React, { useState } from "react";
import styled from "styled-components";
import { motion } from "framer-motion";
import {
  FaBed,
  FaBath,
  FaUserFriends,
  FaMapMarkerAlt,
  FaStar,
  FaWhatsapp,
  FaCheckCircle,
} from "react-icons/fa";
import { Link } from "react-router-dom";

const Page = styled.div`
  padding-top: 70px;
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.background};
`;

const Hero = styled.div`
  width: 100%;
  height: 380px;
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.primary} 0%, #2d4a7a 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
`;

const HeroImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const HeroPlaceholder = styled.div`
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: 5rem;
  font-weight: 900;
  color: rgba(255, 255, 255, 0.2);
`;

const Content = styled.div`
  max-width: 1100px;
  margin: 0 auto;
  padding: 40px 24px;
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 48px;
  align-items: start;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const LeftCol = styled.div``;

const Badge = styled.span`
  display: inline-block;
  background: ${({ theme }) => theme.colors.accentLight};
  color: ${({ theme }) => theme.colors.primary};
  font-size: 0.78rem;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: ${({ theme }) => theme.radius.pill};
  margin-bottom: 12px;
`;

const AptName = styled.h1`
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: 1.9rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: 10px;
`;

const RatingRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 14px;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.9rem;

  svg {
    color: ${({ theme }) => theme.colors.gold};
  }
`;

const LocationRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.9rem;
  margin-bottom: 24px;

  svg {
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const SpecsRow = styled.div`
  display: flex;
  gap: 24px;
  margin-bottom: 28px;
  padding-bottom: 28px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  flex-wrap: wrap;
`;

const Spec = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.95rem;
  color: ${({ theme }) => theme.colors.text};

  svg {
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const Description = styled.p`
  color: ${({ theme }) => theme.colors.text};
  line-height: 1.75;
  font-size: 0.97rem;
  margin-bottom: 28px;
`;

const AmenitiesTitle = styled.h3`
  font-size: 1rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: 14px;
`;

const AmenitiesList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 32px;
`;

const AmenityTag = styled.span`
  background: ${({ theme }) => theme.colors.surfaceAlt};
  border: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.text};
  font-size: 0.82rem;
  padding: 5px 12px;
  border-radius: ${({ theme }) => theme.radius.pill};
  display: flex;
  align-items: center;
  gap: 5px;
`;

const ExternalLinks = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
`;

const ExtLink = styled.a`
  font-size: 0.85rem;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary};
  border: 1px solid ${({ theme }) => theme.colors.border};
  padding: 6px 14px;
  border-radius: ${({ theme }) => theme.radius.pill};
  transition: background 0.2s;

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceAlt};
  }
`;

/* ── Booking Widget ── */
const BookingCard = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.lg};
  padding: 28px;
  box-shadow: ${({ theme }) => theme.shadow.elevated};
  position: sticky;
  top: 90px;
`;

const PriceHeader = styled.div`
  margin-bottom: 20px;

  .price {
    font-size: 1.6rem;
    font-weight: 700;
    color: ${({ theme }) => theme.colors.primary};
  }

  .per-night {
    font-size: 0.9rem;
    color: ${({ theme }) => theme.colors.textMuted};
  }

  .rating {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
    font-size: 0.85rem;
    color: ${({ theme }) => theme.colors.textMuted};

    svg {
      color: ${({ theme }) => theme.colors.gold};
    }
  }
`;

const DateGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  overflow: hidden;
  margin-bottom: 10px;
`;

const DateField = styled.div`
  padding: 10px 12px;
  background: ${({ theme }) => theme.colors.background};

  label {
    display: block;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.text};
    margin-bottom: 3px;
  }

  input {
    width: 100%;
    border: none;
    background: transparent;
    font-size: 0.9rem;
    color: ${({ theme }) => theme.colors.text};
    outline: none;
    font-family: inherit;
  }
`;

const GuestsField = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  padding: 10px 12px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;

  label {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.text};
  }

  select {
    border: none;
    background: transparent;
    font-size: 0.9rem;
    color: ${({ theme }) => theme.colors.text};
    outline: none;
    cursor: pointer;
    font-family: inherit;
  }
`;

const CostBreakdown = styled.div`
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  margin-top: 10px;
  padding-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;

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
    font-size: 0.95rem;
    color: ${({ theme }) => theme.colors.text};
    padding-top: 8px;
    border-top: 1px solid ${({ theme }) => theme.colors.border};
    margin-top: 4px;
  }
`;

const BookBtn = styled(Link)`
  display: block;
  width: 100%;
  text-align: center;
  background-color: ${({ theme }) => theme.colors.primary};
  color: #fff;
  font-weight: 700;
  font-size: 1rem;
  padding: 0.9rem;
  border-radius: ${({ theme }) => theme.radius.pill};
  margin-bottom: 10px;
  transition: background-color 0.2s;

  &:hover {
    background-color: ${({ theme }) => theme.colors.primaryHover};
  }
`;

const WhatsAppBtn = styled.a`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  text-align: center;
  background-color: ${({ theme }) => theme.colors.whatsapp};
  color: #fff;
  font-weight: 600;
  font-size: 0.92rem;
  padding: 0.75rem;
  border-radius: ${({ theme }) => theme.radius.pill};
  transition: background-color 0.2s;

  &:hover {
    background-color: ${({ theme }) => theme.colors.whatsappHover};
  }
`;

const NoDatesMsg = styled.p`
  font-size: 0.8rem;
  color: ${({ theme }) => theme.colors.textMuted};
  text-align: center;
  margin-bottom: 12px;
`;

const today = new Date().toISOString().split("T")[0];

const WHATSAPP_URL =
  "https://wa.me/355000000000?text=Hello%2C%20I%27d%20like%20to%20book%20an%20apartment%20at%20Meg%27Rooms.";

const HotelDetail = ({ hotel }) => {
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(1);

  const price = Number(hotel.price_per_night);
  const cleaningFee = 25;

  const nights =
    checkIn && checkOut
      ? Math.max(
          0,
          (new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24)
        )
      : 0;
  const total = nights > 0 ? nights * price + cleaningFee : 0;

  return (
    <Page>
      <Hero>
        {hotel.image_urls && hotel.image_urls.length > 0 ? (
          <HeroImg src={hotel.image_urls[0]} alt={hotel.hotel_name} />
        ) : (
          <HeroPlaceholder>MEG</HeroPlaceholder>
        )}
      </Hero>

      <Content>
        <LeftCol>
          {hotel.tag && <Badge>{hotel.tag}</Badge>}
          <AptName>{hotel.hotel_name}</AptName>

          {hotel.airbnb_rating && (
            <RatingRow>
              <FaStar />
              <strong>{hotel.airbnb_rating}</strong>
              <span>on {hotel.rating_source}</span>
            </RatingRow>
          )}

          <LocationRow>
            <FaMapMarkerAlt />
            <span>{hotel.address}</span>
          </LocationRow>

          <SpecsRow>
            <Spec>
              <FaBed />
              {hotel.bedrooms} bedroom{hotel.bedrooms !== 1 ? "s" : ""}
            </Spec>
            <Spec>
              <FaBath />
              {hotel.bathrooms} bath
            </Spec>
            <Spec>
              <FaUserFriends />
              Up to {hotel.max_guests} guests
            </Spec>
          </SpecsRow>

          {hotel.description && (
            <Description>{hotel.description}</Description>
          )}

          {hotel.amenities && hotel.amenities.length > 0 && (
            <>
              <AmenitiesTitle>Amenities</AmenitiesTitle>
              <AmenitiesList>
                {hotel.amenities.map((a) => (
                  <AmenityTag key={a}>
                    <FaCheckCircle size={10} style={{ color: "#10B981" }} />
                    {a}
                  </AmenityTag>
                ))}
              </AmenitiesList>
            </>
          )}

          <ExternalLinks>
            <ExtLink href="https://www.airbnb.com" target="_blank" rel="noopener noreferrer">
              View on Airbnb ↗
            </ExtLink>
            <ExtLink href="https://www.booking.com" target="_blank" rel="noopener noreferrer">
              View on Booking.com ↗
            </ExtLink>
          </ExternalLinks>
        </LeftCol>

        {/* Booking Widget */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <BookingCard>
            <PriceHeader>
              <div>
                <span className="price">€{price.toFixed(0)}</span>
                <span className="per-night"> / night</span>
              </div>
              {hotel.airbnb_rating && (
                <div className="rating">
                  <FaStar />
                  {hotel.airbnb_rating} · {hotel.rating_source}
                </div>
              )}
            </PriceHeader>

            <DateGrid>
              <DateField>
                <label>Check-in</label>
                <input
                  type="date"
                  min={today}
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                />
              </DateField>
              <DateField>
                <label>Check-out</label>
                <input
                  type="date"
                  min={checkIn || today}
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                />
              </DateField>
            </DateGrid>

            <GuestsField>
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
            </GuestsField>

            {nights > 0 ? (
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
            ) : (
              <NoDatesMsg>Select dates to see total price</NoDatesMsg>
            )}

            <BookBtn
              to={nights > 0 ? `/hotels/${hotel.id}/book` : "#"}
              state={{ checkIn, checkOut, guests, hotel }}
              onClick={(e) => {
                if (nights < 1) e.preventDefault();
              }}
            >
              {nights > 0 ? `Reserve — €${total.toFixed(0)}` : "Select dates"}
            </BookBtn>

            <WhatsAppBtn
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaWhatsapp />
              Book via WhatsApp
            </WhatsAppBtn>
          </BookingCard>
        </motion.div>
      </Content>
    </Page>
  );
};

export default HotelDetail;
