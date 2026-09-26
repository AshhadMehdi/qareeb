type IconProps = { className?: string };

const base = 'h-5 w-5';
const common = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const IconHome = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...common}>
    <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />
  </svg>
);

export const IconSearch = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...common}>
    <circle cx="11" cy="11" r="6" />
    <path d="m20 20-3.6-3.6" />
  </svg>
);

export const IconCart = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...common}>
    <path d="M3 5h2l2.2 10.4A2 2 0 0 0 9.2 17h8.4a2 2 0 0 0 2-1.6L21 8H6" />
    <circle cx="10" cy="20" r="1.2" />
    <circle cx="18" cy="20" r="1.2" />
  </svg>
);

export const IconReceipt = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...common}>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
    <path d="M9 8h6M9 12h6" />
  </svg>
);

export const IconUser = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...common}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c1.4-3.4 4-5 7-5s5.6 1.6 7 5" />
  </svg>
);

export const IconStore = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...common}>
    <path d="M4 9h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
    <path d="M4 9 6 4h12l2 5" />
    <path d="M9 20v-6h6v6" />
  </svg>
);

export const IconBike = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...common}>
    <circle cx="6" cy="17" r="3" />
    <circle cx="18" cy="17" r="3" />
    <path d="M6 17l3-8h4l2 5h3M9 9h5M14 13l3.5-6H20" />
  </svg>
);

export const IconChart = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...common}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
);

export const IconSettings = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...common}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v3M12 18v3M5 12H2M22 12h-3M6.3 6.3 4.2 4.2M19.8 19.8l-2.1-2.1M17.7 6.3l2.1-2.1M4.2 19.8l2.1-2.1" />
  </svg>
);

export const IconShield = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...common}>
    <path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export const IconPin = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...common}>
    <path d="M12 21s6.5-6.2 6.5-11a6.5 6.5 0 1 0-13 0C5.5 14.8 12 21 12 21z" />
    <circle cx="12" cy="10" r="2.4" />
  </svg>
);

export const IconBell = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...common}>
    <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2H4.5z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </svg>
);

export const IconTag = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...common}>
    <path d="M12 3H4v8l9 9 8-8z" />
    <circle cx="7.5" cy="7.5" r="1.2" />
  </svg>
);

export const IconList = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...common}>
    <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
  </svg>
);

export const IconChat = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...common}>
    <path d="M4 5h16v11H9l-5 4z" />
  </svg>
);

export const IconWallet = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...common}>
    <path d="M3 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M3 10h18" />
    <circle cx="16.5" cy="14" r="1.1" />
  </svg>
);

export const IconGift = ({ className = base }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...common}>
    <path d="M4 11h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
    <path d="M3 8h18v3H3zM12 8v13" />
    <path d="M12 8S10.5 3.5 8 4.5 9 8 12 8s4-1.5 2.5-3.5C12.5 3.5 12 8 12 8z" />
  </svg>
);
