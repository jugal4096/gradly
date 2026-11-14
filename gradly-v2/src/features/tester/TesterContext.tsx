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
};

type TesterContextValue = {
  isTester: boolean;
  testerProfile: TesterAcademicProfile | null;
  enterTester: () => void;
  setTesterProfile: (profile: TesterAcademicProfile | null) => void;
  exitTester: () => void;
};

const TesterContext = createContext<TesterContextValue | null>(null);

export function TesterProvider({ children }: { children: ReactNode }) {
  const [isTester, setIsTester] = useState(false);
  const [testerProfile, setTesterProfile] = useState<TesterAcademicProfile | null>(null);

  const value = useMemo<TesterContextValue>(() => ({
    isTester,
    testerProfile,
    enterTester: () => {
      setTesterProfile(null);
      setIsTester(true);
    },
    setTesterProfile,
    exitTester: () => {
      setTesterProfile(null);
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
