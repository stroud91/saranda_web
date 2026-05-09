import React, { useState } from "react";
import styled from "styled-components";
import { FaWhatsapp, FaEnvelope, FaMapMarkerAlt, FaPhone } from "react-icons/fa";

const Section = styled.section`
  background: ${({ theme }) => theme.colors.primary};
  padding: 80px 24px;
  color: #fff;
`;

const Inner = styled.div`
  max-width: 1100px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 64px;
  align-items: start;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 40px;
  }
`;

const LeftCol = styled.div``;

const Title = styled.h2`
  font-family: ${({ theme }) => theme.fonts.display};
  font-size: 2rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 8px;
`;

const Subtitle = styled.p`
  color: rgba(255, 255, 255, 0.7);
  font-size: 1rem;
  margin-bottom: 32px;
`;

const WhatsAppBtn = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background-color: ${({ theme }) => theme.colors.whatsapp};
  color: #fff;
  font-weight: 700;
  font-size: 1.05rem;
  padding: 1rem 2rem;
  border-radius: ${({ theme }) => theme.radius.pill};
  margin-bottom: 32px;
  transition: background-color 0.2s, transform 0.15s;
  width: 100%;
  justify-content: center;

  &:hover {
    background-color: ${({ theme }) => theme.colors.whatsappHover};
    transform: translateY(-2px);
  }
`;

const ContactInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const ContactItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.95rem;

  svg {
    color: ${({ theme }) => theme.colors.gold};
    flex-shrink: 0;
    font-size: 1.1rem;
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const FormRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

const Input = styled.input`
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: ${({ theme }) => theme.radius.sm};
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.2s;

  &::placeholder {
    color: rgba(255, 255, 255, 0.45);
  }

  &:focus {
    border-color: ${({ theme }) => theme.colors.gold};
  }
`;

const Textarea = styled.textarea`
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: ${({ theme }) => theme.radius.sm};
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 0.95rem;
  outline: none;
  resize: vertical;
  min-height: 120px;
  font-family: inherit;
  transition: border-color 0.2s;

  &::placeholder {
    color: rgba(255, 255, 255, 0.45);
  }

  &:focus {
    border-color: ${({ theme }) => theme.colors.gold};
  }
`;

const SubmitBtn = styled.button`
  background-color: ${({ theme }) => theme.colors.gold};
  color: ${({ theme }) => theme.colors.primary};
  font-weight: 700;
  font-size: 1rem;
  padding: 0.85rem;
  border-radius: ${({ theme }) => theme.radius.pill};
  transition: background-color 0.2s, transform 0.15s;

  &:hover {
    background-color: #b8933e;
    transform: translateY(-1px);
  }
`;

const Success = styled.p`
  color: ${({ theme }) => theme.colors.gold};
  font-weight: 600;
  text-align: center;
  padding: 1rem;
`;

const WHATSAPP_URL =
  "https://wa.me/355000000000?text=Hello%2C%20I%27d%20like%20to%20inquire%20about%20Meg%27Rooms.";

const ContactSection = () => {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState(false);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setSent(true);
    setForm({ name: "", email: "", message: "" });
  };

  return (
    <Section id="contact">
      <Inner>
        <LeftCol>
          <Title>Get in Touch</Title>
          <Subtitle>
            We're happy to answer questions about availability, pricing, or
            anything else. The fastest way to reach us is WhatsApp.
          </Subtitle>
          <WhatsAppBtn
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaWhatsapp size={22} />
            Chat on WhatsApp
          </WhatsAppBtn>
          <ContactInfo>
            <ContactItem>
              <FaMapMarkerAlt />
              <span>Rruga Gjergj Araniti, Sarandë, Albanian Riviera</span>
            </ContactItem>
            <ContactItem>
              <FaEnvelope />
              <span>bookings@megrooms.com</span>
            </ContactItem>
            <ContactItem>
              <FaPhone />
              <span>+355 68 000 0000</span>
            </ContactItem>
          </ContactInfo>
        </LeftCol>

        <div>
          {sent ? (
            <Success>
              Thank you! We'll get back to you as soon as possible.
            </Success>
          ) : (
            <Form onSubmit={handleSubmit}>
              <FormRow>
                <Input
                  type="text"
                  name="name"
                  placeholder="Your name"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
                <Input
                  type="email"
                  name="email"
                  placeholder="Email address"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </FormRow>
              <Textarea
                name="message"
                placeholder="Your message..."
                value={form.message}
                onChange={handleChange}
                required
              />
              <SubmitBtn type="submit">Send Message</SubmitBtn>
            </Form>
          )}
        </div>
      </Inner>
    </Section>
  );
};

export default ContactSection;
