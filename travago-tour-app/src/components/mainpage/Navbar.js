import React, { useState } from "react";
import { Link } from "react-router-dom";
import { FaBars, FaTimes, FaUserCircle, FaSun, FaMoon } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import styled from "styled-components";

const Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  background-color: ${({ theme }) => theme.colors.navBg || theme.colors.primary};
  color: ${({ theme }) => theme.colors.navText || theme.colors.text};
  position: sticky;
  top: 0;
  z-index: 1000;
`;

const Logo = styled.div`
  font-size: 1.5rem;
  font-weight: bold;
`;

const Nav = styled.nav`
  display: flex;
  align-items: center;
`;

const NavList = styled.ul`
  display: flex;
  gap: 1rem;
  list-style: none;

  @media (max-width: 768px) {
    display: none;
  }
`;

const NavItem = styled.li`
  a {
    color: #fff;
    font-weight: 500;
    &:hover {
      color: ${({ theme }) => theme.colors.secondary};
    }
  }
`;

const MobileMenu = styled(motion.ul)`
  position: absolute;
  top: 70px;
  right: 0;
  background-color: ${({ theme }) => theme.colors.navBg || theme.colors.primary};
  width: 100%;
  list-style: none;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  z-index: 999;

  li a {
    color: #fff;
    font-weight: 500;
    &:hover {
      color: ${({ theme }) => theme.colors.secondary};
    }
  }
`;

const MenuToggle = styled.div`
  display: none;
  cursor: pointer;
  margin-left: 1rem;
  color: #fff;
  @media (max-width: 768px) {
    display: block;
  }
`;

const ThemeToggleBtn = styled.button`
  background: none;
  color: #fff;
  font-size: 1.2rem;
  margin-left: 1rem;
  &:hover {
    color: ${({ theme }) => theme.colors.secondary};
  }
`;

const UserIcon = styled.div`
  margin-left: 1rem;
  cursor: pointer;
`;

const Navbar = ({ isNightMode, toggleTheme }) => {
  const [isOpen, setIsOpen] = useState(false);
  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <Header>
      <Logo>Meg Rooms</Logo>
      <Nav>
        <NavList>
          <NavItem>
            <Link to="/">Home</Link>
          </NavItem>
          <NavItem>
            <Link to="/tours">Tours</Link>
          </NavItem>
          <NavItem>
            <Link to="/hotels">Hotels</Link>
          </NavItem>
          <NavItem>
            <Link to="/car-rentals">Car Rentals</Link>
          </NavItem>
          <NavItem>
            <Link to="/contact">Contact Us</Link>
          </NavItem>
        </NavList>
        <ThemeToggleBtn onClick={toggleTheme}>
          {isNightMode ? <FaSun /> : <FaMoon />}
        </ThemeToggleBtn>
        <UserIcon>
          <FaUserCircle size={24} />
        </UserIcon>
        <MenuToggle onClick={toggleMenu}>
          {isOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
        </MenuToggle>
      </Nav>
      <AnimatePresence>
        {isOpen && (
          <MobileMenu
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
          >
            <li>
              <Link to="/" onClick={() => setIsOpen(false)}>
                Home
              </Link>
            </li>
            <li>
              <Link to="/tours" onClick={() => setIsOpen(false)}>
                Tours
              </Link>
            </li>
            <li>
              <Link to="/hotels" onClick={() => setIsOpen(false)}>
                Hotels
              </Link>
            </li>
            <li>
              <Link to="/car-rentals" onClick={() => setIsOpen(false)}>
                Car Rentals
              </Link>
            </li>
            <li>
              <Link to="/contact" onClick={() => setIsOpen(false)}>
                Contact Us
              </Link>
            </li>
          </MobileMenu>
        )}
      </AnimatePresence>
    </Header>
  );
};

export default Navbar;