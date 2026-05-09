export const megTheme = {
  name: 'meg',
  colors: {
    primary: '#1B2B4B',
    primaryHover: '#243a66',
    accent: '#C9A84C',
    accentLight: '#F5E6C0',
    background: '#FAFAF8',
    surface: '#FFFFFF',
    surfaceAlt: '#F4F1EB',
    text: '#1A1A1A',
    textMuted: '#6B7280',
    textLight: '#FFFFFF',
    border: '#E8E4DC',
    navBg: 'transparent',
    navBgScrolled: 'rgba(27, 43, 75, 0.97)',
    footerBg: '#1B2B4B',
    footerText: '#E8E4DC',
    whatsapp: '#25D366',
    whatsappHover: '#1da851',
    airbnb: '#FF5A5F',
    bookingCom: '#003580',
    success: '#10B981',
    error: '#EF4444',
    gold: '#C9A84C',
  },
  fonts: {
    display: "'Playfair Display', Georgia, serif",
    script: "'Great Vibes', cursive",
    body: "'Inter', system-ui, -apple-system, sans-serif",
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '32px',
    xl: '64px',
    xxl: '96px',
  },
  radius: {
    sm: '6px',
    md: '12px',
    lg: '20px',
    xl: '32px',
    pill: '999px',
  },
  shadow: {
    card: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.08)',
    elevated: '0 8px 32px rgba(27,43,75,0.15)',
    nav: '0 2px 20px rgba(0,0,0,0.12)',
  },
};

// Keep legacy exports so existing imports don't break
export const dayTheme = megTheme;
export const nightTheme = megTheme;
