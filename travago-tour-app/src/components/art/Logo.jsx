export default function Logo({ className = "brand-mark" }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="lg-sun" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F9D27F" />
          <stop offset="1" stopColor="#D9653B" />
        </linearGradient>
        <linearGradient id="lg-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3FD3CF" />
          <stop offset="1" stopColor="#0B5C7E" />
        </linearGradient>
        <clipPath id="lg-clip"><rect width="64" height="64" rx="18" /></clipPath>
      </defs>
      <g clipPath="url(#lg-clip)">
        <rect width="64" height="64" fill="#FFFBF4" />
        <circle cx="32" cy="30" r="15" fill="url(#lg-sun)" />
        <path d="M0 36c8-6 14-6 22 0s14 6 22 0 14-6 20-2v30H0z" fill="url(#lg-sea)" />
        <path className="logo-wave" d="M-6 48c8-5 14-5 22 0s14 5 22 0 14-5 22 0 14 5 22 0" stroke="#E6F7F6" strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}
