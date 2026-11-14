import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";

import { auth } from "../../config/firebase";

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  isGuest: boolean;
  isTester: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  continueAsGuest: () => void;
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
}

const GUEST_SESSION_KEY = "gradly_guest_session";
const GUEST_ID_KEY = "gradly_guest_id";
const TESTER_TOKEN_KEY = "gradly_tester_access_token";
const TESTER_PREFIX_KEY = "gradly_tester_storage_prefix";
const AuthContext = createContext<AuthContextType | undefined>(undefined);

function prepareTesterLaunch() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const token = params.get("testerToken");
  if (!token) return;
  const caseId = params.get("testerCaseId") || "default";
  const testerId = params.get("testerId") || "Tester";
  const prefix = "gradly_tester_" + testerId.replace(/[^a-z0-9_-]/gi, "_") + "_" + caseId.replace(/[^a-z0-9_-]/gi, "_");
  try {
    const profile = JSON.parse(params.get("testerProfile") || "{}");
    const seededProfile = {
      institutionId: profile.institutionId || "tester-institution",
      institutionName: profile.institutionName || "Government College of Engineering, Chhatrapati Sambhajinagar",
      programId: profile.programId || "",
      programName: profile.programName || profile.programme || "B.Tech",
      branchId: profile.branchId || "",
      branchName: profile.branchName || profile.branch || "Information Technology",
      specialization: profile.specialization || "",
      specializationId: profile.specializationId || "",
      curriculumId: profile.curriculumId || "",
      semester: String(profile.semester || 1),
      enrollment: profile.enrollment || "TEST-ENROLLMENT",
      admissionYear: String(profile.admissionYear || new Date().getFullYear()),
      admissionMode: profile.admissionMode || "Regular",
      admissionNumber: "",
      scheme: profile.scheme || "New CBCS",
    };
    sessionStorage.setItem(TESTER_TOKEN_KEY, token);
    sessionStorage.setItem(TESTER_PREFIX_KEY, prefix);
    localStorage.setItem(prefix + ":gradly_student_profile", JSON.stringify(seededProfile));
    sessionStorage.setItem("gradly_tester_login_id", testerId);
    const returnCandidate=params.get("testerReturnUrl") || "";
    let safeReturnUrl="/";
    try { const parsed=new URL(returnCandidate); if(parsed.pathname==="/tester/workspace" && (parsed.protocol==="https:" || (parsed.protocol==="http:" && parsed.hostname==="localhost"))) safeReturnUrl=parsed.toString(); } catch { /* use the local app root */ }
    sessionStorage.setItem("gradly_tester_return_url", safeReturnUrl);
  } catch {
    sessionStorage.removeItem(TESTER_TOKEN_KEY);
  }
  // The one-time credential and profile payload are removed from the visible URL.
  window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(
    () => sessionStorage.getItem(GUEST_SESSION_KEY) === "true",
  );
  const [isTester, setIsTester] = useState(false);

  useEffect(() => {
    prepareTesterLaunch();
    const testerToken = sessionStorage.getItem(TESTER_TOKEN_KEY);
    if (testerToken) {
      let active = true;
      const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");
      fetch(apiBaseUrl + "/api/tester/me", { headers: { Authorization: "Bearer " + testerToken } })
        .then(async response => {
          if (!response.ok) throw new Error("Tester access is no longer active.");
          return response.json();
        })
        .then(data => {
          if (!active) return;
          const loginId = data.tester?.loginId || sessionStorage.getItem("gradly_tester_login_id") || "Tester";
          const testerUser = {
            uid: "gradly-tester:" + loginId,
            displayName: loginId,
            email: loginId + "@tester.gradly.local",
            getIdToken: async () => testerToken,
          } as unknown as FirebaseUser;
          setUser(testerUser);
          setIsGuest(false);
          setIsTester(true);
          setLoading(false);
        })
        .catch(() => {
          if (!active) return;
          sessionStorage.removeItem(TESTER_TOKEN_KEY);
          sessionStorage.removeItem(TESTER_PREFIX_KEY);
          setLoading(false);
        });
      return () => { active = false; };
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        sessionStorage.removeItem(GUEST_SESSION_KEY);
        setIsGuest(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function syncUserWithBackend(firebaseUser: FirebaseUser) {
    const idToken = await firebaseUser.getIdToken();
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
    const response = await fetch(`${apiBaseUrl}/api/auth/sync`, { method: "POST", headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" } });
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || "Failed to synchronize user with Gradly backend.");
    }
  }

  async function loginWithEmail(email: string, password: string) {
    const result = await signInWithEmailAndPassword(auth, email, password);
    sessionStorage.removeItem(GUEST_SESSION_KEY); setIsGuest(false);
    try {
      await syncUserWithBackend(result.user);
    } catch (error) {
      await signOut(auth);
      throw error;
    }
  }

  async function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const firebaseUser = result.user;
    sessionStorage.removeItem(GUEST_SESSION_KEY);
    setIsGuest(false);
    try {
      await syncUserWithBackend(firebaseUser);
    } catch (error) {
      await signOut(auth);
      throw error;
    }
  }

  function continueAsGuest() {
    sessionStorage.setItem(GUEST_SESSION_KEY, "true");
    setIsGuest(true);
  }

  async function logout() {
    if (isTester) {
      const returnUrl = sessionStorage.getItem("gradly_tester_return_url") || "/";
      sessionStorage.removeItem(TESTER_TOKEN_KEY);
      sessionStorage.removeItem(TESTER_PREFIX_KEY);
      sessionStorage.removeItem("gradly_tester_return_url");
      setIsTester(false);
      setUser(null);
      window.location.assign(returnUrl);
      return;
    }
    sessionStorage.removeItem(GUEST_SESSION_KEY);
    localStorage.removeItem(GUEST_ID_KEY);
    localStorage.removeItem("gradly_guest_session_token");
    localStorage.removeItem("gradly_guest_institute");
    setIsGuest(false);
    await signOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isGuest,
        isTester,
        loginWithGoogle,
        loginWithEmail,
        continueAsGuest,
        logout,
        signOut: logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
