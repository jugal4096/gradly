import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type TesterAcademicProfile = {
  institutionId: string;
  institutionName: string;
  programId: string;
  programName: string;
  branchId: string;
  branchName: string;
  curriculumId: string;
  semester: string;
  enrollment: string;
  admissionYear: string;
  admissionMode: string;
  admissionNumber: string;
  scheme: string;
  isDurationEnded?: boolean;
};

type TesterContextValue = {
  isTester: boolean;
  testerProfile: TesterAcademicProfile | null;
  enterTester: () => void;
  setTesterProfile: (profile: TesterAcademicProfile | null) => void;
  exitTester: () => void;
};

export const TESTER_SESSION_KEY = "gradly_tester_session";
export const TESTER_PROFILE_KEY = "gradly_tester_profile";
export const TESTER_WORKSPACE_KEY = "gradly_tester_workspace";

function readStoredProfile(): TesterAcademicProfile | null {
  try {
    const raw = localStorage.getItem(TESTER_PROFILE_KEY);
    return raw ? JSON.parse(raw) as TesterAcademicProfile : null;
  } catch {
    return null;
  }
}

const TesterContext = createContext<TesterContextValue | null>(null);

export function TesterProvider({ children }: { children: ReactNode }) {
  const [isTester, setIsTester] = useState(() => localStorage.getItem(TESTER_SESSION_KEY) === "active");
  const [testerProfile, setTesterProfileState] = useState<TesterAcademicProfile | null>(() => readStoredProfile());

  const value = useMemo<TesterContextValue>(() => ({
    isTester,
    testerProfile,
    enterTester: () => {
      localStorage.setItem(TESTER_SESSION_KEY, "active");
      setIsTester(true);
    },
    setTesterProfile: (profile) => {
      if (profile) localStorage.setItem(TESTER_PROFILE_KEY, JSON.stringify(profile));
      else localStorage.removeItem(TESTER_PROFILE_KEY);
      setTesterProfileState(profile);
    },
    exitTester: () => {
      Object.keys(localStorage)
        .filter((key) => key === TESTER_SESSION_KEY || key === TESTER_PROFILE_KEY || key === TESTER_WORKSPACE_KEY || key.startsWith("gradly_tester_"))
        .forEach((key) => localStorage.removeItem(key));
      setTesterProfileState(null);
      setIsTester(false);
    },
  }), [isTester, testerProfile]);

  return <TesterContext.Provider value={value}>{children}</TesterContext.Provider>;
}

export function useTester() {
  const context = useContext(TesterContext);
  if (!context) throw new Error("useTester must be used inside TesterProvider.");
  return context;
}
