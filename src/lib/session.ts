const KEY = "worksy.session";

export type CompanyAccess = {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  tagline: string;
};

export type Session = {
  id: string;
  name: string;
  isAdmin: boolean;
  code: string;
  companies: CompanyAccess[];
  activeCompanyId?: string;
};

export function saveSession(s: Session) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function readSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function setActiveCompany(companyId: string) {
  const session = readSession();
  if (!session || !session.companies.some((c) => c.id === companyId)) return;
  saveSession({ ...session, activeCompanyId: companyId });
}

export function clearSession() {
  localStorage.removeItem(KEY);
}

export function money(n: number | string | null | undefined) {
  return "₹" + Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}
