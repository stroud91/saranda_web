import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FaBars, FaTimes } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import styled, { css } from "styled-components";
import megLogo from "../../images/megg.png";

const Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2rem;
  height: 70px;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  transition: background-color 0.3s ease, box-shadow 0.3s ease;

  ${({ $scrolled }) =>
    $scrolled
      ? css`
          background-color: ${({ theme }) => theme.colors.navBgScrolled};
          box-shadow: ${({ theme }) => theme.shadow.nav};
        `
      : css`
          background-color: transparent;
        `}
`;

const Logo = styled(Link)`
  display: flex;
  align-items: center;

  img {
    height: 42px;
    width: auto;
    filter: brightness(0) invert(1);
    transition: opacity 0.2s;
    &:hover {
      opacity: 0.85;
    }
  }
`;

const Nav = styled.nav`
  display: flex;
  align-items: center;
  gap: 0.25rem;

  @media (max-width: 900px) {
    display: none;
  }
`;

const NavLink = styled(Link)`
  color: #fff;
  font-weight: 500;
  font-size: 0.95rem;
  padding: 0.5rem 0.75rem;
  border-radius: ${({ theme }) => theme.radius.sm};
  transition: background-color 0.2s;

  &:hover {
    background-color: rgba(255, 255, 255, 0.15);
  }
`;

const BookNowBtn = styled(Link)`
  display: inline-flex;
  align-items: center;
  background-color: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.primary};
  font-weight: 700;
  font-size: 0.9rem;
  padding: 0.55rem 1.25rem;
  border-radius: ${({ theme }) => theme.radius.pill};
  margin-left: 0.75rem;
  transition: background-color 0.2s, transform 0.15s;

  &:hover {
    background-color: #b8933e;
    transform: translateY(-1px);
  }
`;

const MenuToggle = styled.button`
  display: none;
  color: #fff;
  font-size: 1.4rem;
  padding: 0.5rem;
  background: none;
  border: none;

  @media (max-width: 900px) {
    display: block;
  }
`;

const MobileMenu = styled(motion.div)`
  position: fixed;
  top: 70px;
  left: 0;
  right: 0;
  background-color: ${({ theme }) => theme.colors.primary};
  padding: 1.5rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  z-index: 999;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
`;

const MobileNavLink = styled(Link)`
  color: #fff;
  font-weight: 500;
  font-size: 1.05rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: block;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    color: ${({ theme }) => theme.colors.accent};
  }
`;

const MobileBookBtn = styled(Link)`
  display: block;
  text-align: center;
  background-color: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.primary};
  font-weight: 700;
  font-size: 1rem;
  padding: 0.85rem;
  border-radius: ${({ theme }) => theme.radius.pill};
  margin-top: 1rem;

  &:hover {
    background-color: #b8933e;
  }
`;

const navLinks = [
  { label: "Apartments", to: "/hotels" },
  { label: "Tours", to: "/tours" },
  { label: "Car Rentals", to: "/car-rentals" },
  { label: "Amenities", to: "/#amenities" },
  { label: "Reviews", to: "/#reviews" },
  { label: "Contact", to: "/contact" },
];

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeMenu = () => setIsOpen(false);

  return (
    <>
      <Header $scrolled={scrolled}>
        <Logo to="/" onClick={closeMenu}>
          <img src={megLogo} alt="Meg'Rooms" />
        </Logo>

        <Nav>
          {navLinks.map((link) => (
            <NavLink key={link.to} to={link.to}>
              {link.label}
            </NavLink>
          ))}
          <BookNowBtn to="/hotels">Book Now</BookNowBtn>
        </Nav>

        <MenuToggle
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label="Toggle menu"
        >
          {isOpen ? <FaTimes /> : <FaBars />}
        </MenuToggle>
      </Header>

      <AnimatePresence>
        {isOpen && (
          <MobileMenu
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            {navLinks.map((link) => (
              <MobileNavLink key={link.to} to={link.to} onClick={closeMenu}>
                {link.label}
              </MobileNavLink>
            ))}
            <MobileBookBtn to="/hotels" onClick={closeMenu}>
              Book Now
            </MobileBookBtn>
          </MobileMenu>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
