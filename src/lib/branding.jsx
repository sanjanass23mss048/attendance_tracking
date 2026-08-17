import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { API_BASE, apiFetch } from '../services/api.js';
import { setPdfBrandLogoUrl } from '../services/reportService.js';
import defaultLogo from '../assets/attendance-logo.png';
import defaultMark from '../assets/attendance-logo-mark.png';

const BrandingContext = createContext({
  hasLogo: false,
  schoolName: null,
  logoSrc: defaultLogo,
  markSrc: defaultMark,
  refresh: async () => {},
});

function resolveLogoUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path}`;
}

export function BrandingProvider({ children }) {
  const [info, setInfo] = useState({ hasLogo: false, schoolName: null, logoUrl: null });

  const refresh = async () => {
    try {
      const data = await apiFetch('/api/branding');
      setInfo({
        hasLogo: Boolean(data?.hasLogo),
        schoolName: data?.schoolName || null,
        logoUrl: resolveLogoUrl(data?.logoUrl),
      });
      setPdfBrandLogoUrl(resolveLogoUrl(data?.logoUrl) || '');
    } catch {
      setInfo({ hasLogo: false, schoolName: null, logoUrl: null });
      setPdfBrandLogoUrl('');
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const value = useMemo(
    () => ({
      hasLogo: info.hasLogo,
      schoolName: info.schoolName,
      logoSrc: info.logoUrl || defaultLogo,
      markSrc: info.logoUrl || defaultMark,
      refresh,
    }),
    [info]
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  return useContext(BrandingContext);
}

export function SchoolLogo({ variant = 'mark', alt = 'School logo', className }) {
  const { logoSrc, markSrc } = useBranding();
  const src = variant === 'full' ? logoSrc : markSrc;
  return <img src={src} alt={alt} className={className} />;
}

export async function uploadSchoolLogo(file) {
  const form = new FormData();
  form.append('logo', file);
  return apiFetch('/api/branding/logo', { method: 'PUT', body: form });
}
