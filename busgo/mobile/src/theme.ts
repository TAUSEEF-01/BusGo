export const colors = {
  bg: '#f8fafc',
  card: '#ffffff',
  border: '#e2e8f0',
  borderSoft: '#f1f5f9',
  text: '#0f172a',
  subtext: '#64748b',
  faint: '#94a3b8',
  // Brand red — aligned with the BusGo web app (brand-600 family).
  primary: '#dc2626',
  primaryDark: '#b91c1c',
  primaryDeep: '#991b1b',
  primarySoft: '#fef2f2',
  primaryBorder: '#fecaca',
  success: '#059669',
  successSoft: '#d1fae5',
  warn: '#b45309',
  warnSoft: '#fef3c7',
  info: '#1d4ed8',
  infoSoft: '#dbeafe',
  danger: '#dc2626',
  dangerSoft: '#fee2e2',
  dark: '#0f172a',
  darkSoft: '#1e293b',
  accent: '#f59e0b',
};

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, full: 999 };

export const shadow = {
  shadowColor: '#0f172a',
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
} as const;

export const shadowLifted = {
  shadowColor: '#0f172a',
  shadowOpacity: 0.1,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 5,
} as const;

export const shadowBrand = {
  shadowColor: '#dc2626',
  shadowOpacity: 0.28,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 4,
} as const;
