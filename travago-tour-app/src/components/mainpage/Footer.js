import React from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { FaFacebook, FaInstagram, FaWhatsapp, FaMapMarkerAlt, FaEnvelope, FaPhone } from "react-icons/fa";

const FooterContainer = styled.footer`
  background-color: ${({ theme }) => theme.colors.footerBg};
  color: ${({ theme }) => theme.colors.footerText};
  padding: 64px 24px 32px;
`;

const FooterInner = styled.div`
  max-width: 1100px;
  margin: 0 auto;
`;

const TopGrid = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1.5fr;
  gap: 40px;
  margin-bottom: 48px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr 1fr;
  }

  @media (max-width: 500px) {
    grid-template-columns: 1fr;
  }
`;

const Brand = styled.div``;

const BrandName = styled.div`
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: 1.5rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 6px;
`;

const BrandTagline = styled.div`
  font-family: ${({ theme }) => theme.fonts.script};
  font-size: 1.1rem;
  color: ${({ theme }) => theme.colors.gold};
  margin-bottom: 16px;
`;

const BrandDesc = styled.p`
  font-size: 0.87rem;
  line-height: 1.65;
  color: rgba(255, 255, 255, 0.65);
  margin-bottom: 20px;
`;

const SocialRow = styled.div`
  display: flex;
  gap: 10px;
`;

const SocialBtn = styled.a`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.7);
  transition: background 0.2s, color 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }
`;

const FooterCol = styled.div``;

const ColTitle = styled.h4`
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 16px;
`;

const FooterLink = styled(Link)`
  display: block;
  font-size: 0.88rem;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 9px;
  transition: color 0.2s;

  &:hover {
    color: ${({ theme }) => theme.colors.gold};
  }
`;

const ContactItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 12px;
  font-size: 0.87rem;
  color: rgba(255, 255, 255, 0.7);

  svg {
    color: ${({ theme }) => theme.colors.gold};
    margin-top: 2px;
    flex-shrink: 0;
  }
`;

const Divider = styled.div`
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin-bottom: 24px;
`;

const BottomRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
`;

const Copyright = styled.p`
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.4);
`;

const LegalLinks = styled.div`
  display: flex;
  gap: 16px;
`;

const LegalLink = styled(Link)`
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.4);
  transition: color 0.2s;

  &:hover {
    color: rgba(255, 255, 255, 0.7);
  }
`;

const WhatsAppInline = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: ${({ theme }) => theme.colors.whatsapp};
  font-size: 0.88rem;
  font-weight: 600;
  margin-bottom: 10px;

  &:hover {
    text-decoration: underline;
  }
`;

const Footer = () => (
  <FooterContainer>
    <FooterInner>
      <TopGrid>
        <Brand>
          <BrandName>Meg'Rooms</BrandName>
          <BrandTagline>Feels Like Home</BrandTagline>
          <BrandDesc>
            Beachfront apartments in Sarandë on the Albanian Riviera. Modern
            comforts, stunning Adriatic views, and warm Albanian hospitality.
          </BrandDesc>
          <SocialRow>
            <SocialBtn
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
            >
              <FaInstagram size={14} />
            </SocialBtn>
            <SocialBtn
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
            >
              <FaFacebook size={14} />
            </SocialBtn>
            <SocialBtn
              href="https://wa.me/355000000000"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
            >
              <FaWhatsapp size={14} />
            </SocialBtn>
          </SocialRow>
        </Brand>

        <FooterCol>
          <ColTitle>Explore</ColTitle>
          <FooterLink to="/hotels">Apartments</FooterLink>
          <FooterLink to="/tours">Tours</FooterLink>
          <FooterLink to="/car-rentals">Car Rentals</FooterLink>
          <FooterLink to="/#amenities">Amenities</FooterLink>
          <FooterLink to="/#reviews">Reviews</FooterLink>
        </FooterCol>

        <FooterCol>
          <ColTitle>Company</ColTitle>
          <FooterLink to="/about-us">About Us</FooterLink>
          <FooterLink to="/contact">Contact</FooterLink>
          <FooterLink to="/privacy-policy">Privacy Policy</FooterLink>
          <FooterLink to="/terms">Terms & Conditions</FooterLink>
        </FooterCol>

        <FooterCol>
          <ColTitle>Contact</ColTitle>
          <ContactItem>
            <FaMapMarkerAlt size={13} />
            <span>Rruga Gjergj Araniti, Sarandë, Albanian Riviera</span>
          </ContactItem>
          <ContactItem>
            <FaEnvelope size={13} />
            <span>bookings@megrooms.com</span>
          </ContactItem>
          <ContactItem>
            <FaPhone size={13} />
            <span>+355 68 000 0000</span>
          </ContactItem>
          <WhatsAppInline
            href="https://wa.me/355000000000"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaWhatsapp size={15} />
            Chat on WhatsApp
          </WhatsAppInline>
        </FooterCol>
      </TopGrid>

      <Divider />

      <BottomRow>
        <Copyright>© 2025 Meg'Rooms. All rights reserved.</Copyright>
        <LegalLinks>
          <LegalLink to="/privacy-policy">Privacy</LegalLink>
          <LegalLink to="/terms">Terms</LegalLink>
        </LegalLinks>
      </BottomRow>
    </FooterInner>
  </FooterContainer>
);

export default Footer;
