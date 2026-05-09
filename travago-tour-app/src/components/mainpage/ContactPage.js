import React from "react";
import styled from "styled-components";
import ContactSection from "./ContactSection";

const PageHeader = styled.div`
  background: ${({ theme }) => theme.colors.primary};
  padding: 120px 24px 48px;
  text-align: center;
`;

const PageTitle = styled.h1`
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: 2.5rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 8px;
`;

const PageSubtitle = styled.p`
  color: rgba(255, 255, 255, 0.7);
  font-size: 1.05rem;
`;

const ContactPage = () => (
  <>
    <PageHeader>
      <PageTitle>Contact Us</PageTitle>
      <PageSubtitle>We'd love to hear from you</PageSubtitle>
    </PageHeader>
    <ContactSection />
  </>
);

export default ContactPage;
