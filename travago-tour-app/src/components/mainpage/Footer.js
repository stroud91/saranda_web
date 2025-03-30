import React from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";

const FooterContainer = styled.footer`
  background-color: ${({ theme }) => theme.colors.footerBg};
  color: ${({ theme }) => theme.colors.footerText};
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.md};
  text-align: center;
  transition: background-color 0.3s ease, color 0.3s ease;
  font-size: 1rem;
`;

const FooterInner = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
`;

const FooterLogo = styled.div`
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

const FooterLinks = styled.ul`
  list-style: none;
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  margin: 0;
  padding: 0;

  li a {
    color: inherit;
    text-decoration: none;
    font-weight: 500;
    transition: color 0.3s ease;
    &:hover {
      color: ${({ theme }) => theme.colors.secondary};
    }
  }

  @media (max-width: 768px) {
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    margin-bottom: ${({ theme }) => theme.spacing.sm};
  }
`;

const FooterContact = styled.div`
  font-size: 0.9rem;
  margin-top: ${({ theme }) => theme.spacing.sm};
`;

const Footer = () => {
  return (
    <FooterContainer>
      <FooterInner>
        <FooterLogo>Meg Rooms</FooterLogo>
        <FooterLinks>
          <li>
            <Link to="/about-us">About Us</Link>
          </li>
          <li>
            <Link to="/privacy-policy">Privacy Policy</Link>
          </li>
          <li>
            <Link to="/terms">Terms & Conditions</Link>
          </li>
        </FooterLinks>
        <FooterContact>
          <p>Email: bookings@example.com</p>
          <p>Phone: +33 321-654-987</p>
        </FooterContact>
      </FooterInner>
    </FooterContainer>
  );
};

export default Footer;
