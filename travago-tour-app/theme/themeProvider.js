"use client";
import { useTheme } from '../../context/ThemeContext';
import '../../styles/themes/coastal-theme.css';
import '../../styles/themes/black-gold.css';

const ThemeProviderComponent = ({ children }) => {
  const { theme } = useTheme();

  return (
    <div className={theme === 'coastal' ? 'coastal-theme' : 'black-gold-theme'}>
      {children}
    </div>
  );
};

export default ThemeProviderComponent;