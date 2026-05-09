import React from "react";
import styled, { keyframes } from "styled-components";
import { FaWhatsapp } from "react-icons/fa";

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(37, 211, 102, 0.5); }
  70% { box-shadow: 0 0 0 14px rgba(37, 211, 102, 0); }
  100% { box-shadow: 0 0 0 0 rgba(37, 211, 102, 0); }
`;

const Btn = styled.a`
  position: fixed;
  bottom: 28px;
  right: 28px;
  z-index: 9000;
  width: 58px;
  height: 58px;
  border-radius: 50%;
  background-color: ${({ theme }) => theme.colors.whatsapp};
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(37, 211, 102, 0.45);
  animation: ${pulse} 2.2s infinite;
  transition: background-color 0.2s, transform 0.15s;

  &:hover {
    background-color: ${({ theme }) => theme.colors.whatsappHover};
    transform: scale(1.08);
  }

  @media (max-width: 600px) {
    bottom: 20px;
    right: 20px;
    width: 52px;
    height: 52px;
  }
`;

const WHATSAPP_URL =
  "https://wa.me/355000000000?text=Hello%2C%20I%27m%20interested%20in%20booking%20a%20Meg%27Rooms%20apartment.";

const WhatsAppButton = () => (
  <Btn
    href={WHATSAPP_URL}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Chat on WhatsApp"
  >
    <FaWhatsapp size={28} />
  </Btn>
);

export default WhatsAppButton;
