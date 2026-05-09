import React, { useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { FaStar, FaBed, FaBath, FaUserFriends, FaChevronLeft, FaChevronRight } from "react-icons/fa";

/* ── Image Carousel ── */
const CarouselWrapper = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: ${({ theme }) => theme.radius.md} ${({ theme }) => theme.radius.md} 0 0;
  overflow: hidden;
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.primary} 0%, #2d4a7a 100%);
`;

const CarouselImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
`;

const PlaceholderLabel = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.85rem;
  font-family: ${({ theme }) => theme.fonts.display};

  span:first-child {
    font-size: 2.5rem;
    font-weight: 900;
    color: rgba(255, 255, 255, 0.9);
    margin-bottom: 4px;
  }
`;

const CarouselBtn = styled.button`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  ${({ $side }) => ($side === "left" ? "left: 8px;" : "right: 8px;")}
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  color: ${({ theme }) => theme.colors.primary};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 2;
`;

const Dots = styled.div`
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 5px;
  z-index: 2;
`;

const Dot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${({ $active, theme }) =>
    $active ? "#fff" : "rgba(255,255,255,0.45)"};
  transition: background 0.2s;
`;

const Badge = styled.span`
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 2;
  background: rgba(255, 255, 255, 0.92);
  color: ${({ theme }) => theme.colors.primary};
  font-size: 0.72rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: ${({ theme }) => theme.radius.pill};
  backdrop-filter: blur(4px);
`;

/* ── Card ── */
const Card = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  overflow: hidden;
  box-shadow: ${({ theme }) => theme.shadow.card};
  transition: box-shadow 0.2s, transform 0.2s;
  display: flex;
  flex-direction: column;

  &:hover {
    box-shadow: ${({ theme }) => theme.shadow.elevated};
    transform: translateY(-4px);
  }

  &:hover ${CarouselBtn} {
    opacity: 1;
  }
`;

const CardBody = styled.div`
  padding: 16px 18px 18px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const NameRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
`;

const AptName = styled.h3`
  font-size: 1rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
  line-height: 1.3;
`;

const RatingBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  flex-shrink: 0;

  svg {
    color: ${({ theme }) => theme.colors.gold};
    font-size: 0.8rem;
  }

  span {
    font-weight: 700;
    font-size: 0.85rem;
    color: ${({ theme }) => theme.colors.text};
  }
`;

const Source = styled.span`
  font-size: 0.72rem;
  color: ${({ theme }) => theme.colors.textMuted};
  font-weight: 400;
`;

const SpecsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.82rem;
`;

const Spec = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;

  svg {
    font-size: 0.78rem;
  }
`;

const PriceRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-top: auto;
`;

const Price = styled.span`
  font-size: 1.2rem;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.primary};
`;

const PerNight = styled.span`
  font-size: 0.85rem;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const BookLink = styled(Link)`
  display: block;
  text-align: center;
  background-color: ${({ theme }) => theme.colors.primary};
  color: #fff;
  font-weight: 600;
  font-size: 0.9rem;
  padding: 0.65rem;
  border-radius: ${({ theme }) => theme.radius.pill};
  transition: background-color 0.2s;

  &:hover {
    background-color: ${({ theme }) => theme.colors.primaryHover};
  }
`;

/* ── Component ── */
const ImageCarousel = ({ images, name }) => {
  const [idx, setIdx] = useState(0);
  const hasImages = images && images.length > 0;

  const prev = (e) => {
    e.preventDefault();
    setIdx((i) => (i === 0 ? images.length - 1 : i - 1));
  };
  const next = (e) => {
    e.preventDefault();
    setIdx((i) => (i === images.length - 1 ? 0 : i + 1));
  };

  return (
    <CarouselWrapper>
      {hasImages ? (
        <>
          <CarouselImg src={images[idx]} alt={name} />
          {images.length > 1 && (
            <>
              <CarouselBtn $side="left" onClick={prev} aria-label="Previous">
                <FaChevronLeft />
              </CarouselBtn>
              <CarouselBtn $side="right" onClick={next} aria-label="Next">
                <FaChevronRight />
              </CarouselBtn>
              <Dots>
                {images.map((_, i) => (
                  <Dot key={i} $active={i === idx} />
                ))}
              </Dots>
            </>
          )}
        </>
      ) : (
        <PlaceholderLabel>
          <span>MEG</span>
          <span>{name?.split("—")[1]?.trim() || "Apartment"}</span>
        </PlaceholderLabel>
      )}
    </CarouselWrapper>
  );
};

const HotelCard = ({ hotel }) => {
  const {
    id,
    hotel_name,
    bedrooms = 1,
    bathrooms = 1,
    max_guests = 2,
    price_per_night,
    airbnb_rating,
    rating_source = "Airbnb",
    tag,
    image_urls = [],
  } = hotel;

  return (
    <Card>
      <CarouselWrapper as="div" style={{ position: "relative" }}>
        <ImageCarousel images={image_urls} name={hotel_name} />
        {tag && <Badge>{tag}</Badge>}
      </CarouselWrapper>

      <CardBody>
        <NameRow>
          <AptName>{hotel_name}</AptName>
          {airbnb_rating && (
            <RatingBadge>
              <FaStar />
              <span>{airbnb_rating}</span>
              <Source>{rating_source}</Source>
            </RatingBadge>
          )}
        </NameRow>

        <SpecsRow>
          <Spec>
            <FaBed />
            {bedrooms} bed{bedrooms !== 1 ? "s" : ""}
          </Spec>
          <Spec>
            <FaBath />
            {bathrooms} bath
          </Spec>
          <Spec>
            <FaUserFriends />
            {max_guests} guests
          </Spec>
        </SpecsRow>

        <PriceRow>
          <Price>€{Number(price_per_night).toFixed(0)}</Price>
          <PerNight>/ night</PerNight>
        </PriceRow>

        <BookLink to={`/hotels/${id}`}>View Details</BookLink>
      </CardBody>
    </Card>
  );
};

export default HotelCard;
