import React from "react";
import { useLocation, Link } from "react-router-dom";
import styled, { keyframes } from "styled-components";
import { FaCheckCircle, FaWhatsapp, FaHome, FaCalendarAlt, FaUser } from "react-icons/fa";

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Page = styled.div`
  min-height: 100vh;
  padding-top: 70px;
  background: ${({ theme }) => theme.colors.background};
  display: flex;
  align-items: flex-start;
  justify-content: center;
`;

const Card = styled.div`
  max-width: 560px;
  width: 100%;
  margin: 60px 24px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.lg};
  padding: 48px 40px;
  box-shadow: ${({ theme }) => theme.shadow.elevated};
  text-align: center;
  animation: ${fadeIn} 0.5s ease both;
`;

const CheckIcon = styled.div`
  color: #10B981;
  font-size: 4rem;
  margin-bottom: 16px;
`;

const Title = styled.h1`
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: 1.8rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: 8px;
`;

const Subtitle = styled.p`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.95rem;
  margin-bottom: 32px;
`;

const ConfirmationNum = styled.div`
  background: ${({ theme }) => theme.colors.surfaceAlt};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  padding: 14px 20px;
  margin-bottom: 24px;
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.textMuted};

  strong {
    display: block;
    font-size: 1.1rem;
    color: ${({ theme }) => theme.colors.primary};
    font-family: monospace;
    letter-spacing: 1px;
  }
`;

const DetailsList = styled.div`
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 32px;
`;

const DetailItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: ${({ theme }) => theme.colors.surfaceAlt};
  border-radius: ${({ theme }) => theme.radius.sm};

  svg {
    color: ${({ theme }) => theme.colors.primary};
    flex-shrink: 0;
  }

  div {
    span:first-child {
      display: block;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: ${({ theme }) => theme.colors.textMuted};
      margin-bottom: 2px;
    }
    span:last-child {
      font-size: 0.95rem;
      font-weight: 600;
      color: ${({ theme }) => theme.colors.text};
    }
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const PrimaryBtn = styled(Link)`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  font-weight: 700;
  padding: 0.85rem;
  border-radius: ${({ theme }) => theme.radius.pill};
  transition: background 0.2s;

  &:hover {
    background: ${({ theme }) => theme.colors.primaryHover};
  }
`;

const WhatsAppBtn = styled.a`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: ${({ theme }) => theme.colors.whatsapp};
  color: #fff;
  font-weight: 600;
  padding: 0.75rem;
  border-radius: ${({ theme }) => theme.radius.pill};
  transition: background 0.2s;

  &:hover {
    background: ${({ theme }) => theme.colors.whatsappHover};
  }
`;

const WHATSAPP_URL =
  "https://wa.me/355000000000?text=Hello%2C%20I%27ve%20just%20made%20a%20booking%20at%20Meg%27Rooms%20and%20I%27d%20like%20to%20confirm.";

const formatDate = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const BookingConfirmation = () => {
  const location = useLocation();

  const { booking, hotel, total, nights } = location.state || {};

  if (!booking) {
    return (
      <Page>
        <Card>
          <CheckIcon><FaCheckCircle /></CheckIcon>
          <Title>Booking Submitted</Title>
          <Subtitle>
            Your booking request has been received. Check your email for
            confirmation details.
          </Subtitle>
          <ButtonGroup>
            <PrimaryBtn to="/">
              <FaHome /> Back to Home
            </PrimaryBtn>
          </ButtonGroup>
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      <Card>
        <CheckIcon>
          <FaCheckCircle />
        </CheckIcon>
        <Title>Booking Confirmed!</Title>
        <Subtitle>
          Thank you, {booking.guest_name?.split(" ")[0]}! A confirmation has
          been sent to {booking.guest_email}.
        </Subtitle>

        <ConfirmationNum>
          Confirmation reference
          <strong>MR-{String(booking.id).padStart(5, "0")}</strong>
        </ConfirmationNum>

        <DetailsList>
          {hotel && (
            <DetailItem>
              <FaHome size={16} />
              <div>
                <span>Apartment</span>
                <span>{hotel.hotel_name}</span>
              </div>
            </DetailItem>
          )}
          <DetailItem>
            <FaCalendarAlt size={16} />
            <div>
              <span>Dates</span>
              <span>
                {formatDate(booking.start_date)} → {formatDate(booking.end_date)}
                {nights ? ` · ${nights} night${nights !== 1 ? "s" : ""}` : ""}
              </span>
            </div>
          </DetailItem>
          <DetailItem>
            <FaUser size={16} />
            <div>
              <span>Guests</span>
              <span>
                {booking.guest_count} guest{booking.guest_count !== 1 ? "s" : ""}
              </span>
            </div>
          </DetailItem>
          {total && (
            <DetailItem>
              <FaCheckCircle size={16} />
              <div>
                <span>Total Paid</span>
                <span>€{Number(total).toFixed(0)}</span>
              </div>
            </DetailItem>
          )}
        </DetailsList>

        <ButtonGroup>
          <WhatsAppBtn
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaWhatsapp /> Message us on WhatsApp
          </WhatsAppBtn>
          <PrimaryBtn to="/hotels">
            <FaHome /> Browse More Apartments
          </PrimaryBtn>
        </ButtonGroup>
      </Card>
    </Page>
  );
};

export default BookingConfirmation;
