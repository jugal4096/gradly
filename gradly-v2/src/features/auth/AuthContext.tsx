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
const API = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\\/+$/, "");
const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readTesterLaunch() {
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return;
  const params = new URLSearchParams(raw);
  const token = params.get("testerToken");
  if (!token) return;
  const testerId = params.get("testerId") || "Tester";
  const prefix = "gradly_tester_" + crypto.randomUUID();
  let returnUrl = "/";
  try {
    const candidate = new URL(params.get("testerReturnUrl") || "");
    if ((candidate.protocol === "https:" || candidate.protocol === "http:") && candidate.pathname === "/tester/login") {
      returnUrl = candidate.toString();
    }
  } catch { /* Keep the safe in-app fallback. */ }
  sessionStorage.setItem(TESTER_TOKEN_KEY, token);
  sessionStorage.setItem(TESTER_PREFIX_KEY, prefix);
  sessionStorage.setItem("gradly_tester_login_id", testerId);
  sessionStorage.setItem("gradly_tester_return_url", returnUrl);
  // Remove the bearer token from the address bar immediately after capture.
  window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(() => sessionStorage.getItem(GUEST_SESSION_KEY) === "true");
  const [isTester, setIsTester] = useState(false);

  useEffect(() => {
    readTesterLaunch();
    const testerToken = sessionStorage.getItem(TESTER_TOKEN_KEY);
    if (testerToken) {
      let active = true;
      fetch(API + "/api/tester/me", { headers: { Authorization: "Bearer " + testerToken } })
        .then(async response => {
          if (!response.ok) throw new Error("Tester access is inactive or expired.");
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
          sessionStorage.removeItem(GUEST_SESSION_KEY);
          setIsGuest(false);
          setUser(testerUser);
          setIsTester(true);
          setLoading(false);
        })
        .catch(() => {
          if (!active) return;
          clearTesterSession();
          setUser(null);
          setIsTester(false);
          setLoading(false);
        });
      return () => { active = false; };
    }

    const unsubscribe = onAuthStateChanged(auth, firebaseUser => {
      setUser(firebaseUser);
      if (firebaseUser) {
        sessionStorage.removeItem(GUEST_SESSION_KEY);
        setIsGuest(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  function clearTesterSession() {
    const prefix = sessionStorage.getItem(TESTER_PREFIX_KEY);
    if (prefix) {
      for (let index = sessionStorage.length - 1; index >= 0; index--) {
        const key = sessionStorage.key(index);
        if (key?.startsWith(prefix + ":")) sessionStorage.removeItem(key);
      }
    }
    [TESTER_TOKEN_KEY, TESTER_PREFIX_KEY, "gradly_tester_login_id", "gradly_tester_return_url"].forEach(key => sessionStorage.removeItem(key));
  }

  async function syncUserWithBackend(firebaseUser: FirebaseUser) {
    const idToken = await firebaseUser.getIdToken();
    const response = await fetch(API + "/api/auth/sync", { method: "POST", headers: { Authorization: "Bearer " + idToken, "Content-Type": "application/json" } });
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || "Failed to synchronize user with Gradly backend.");
    }
  }

  async function loginWithEmail(email: string, password: string) {
    const result = await signInWithEmailAndPassword(auth, email, password);
    sessionStorage.removeItem(GUEST_SESSION_KEY); setIsGuest(false);
    try { await syncUserWithBackend(result.user); }
    catch (error) { await signOut(auth); throw error; }
  }

  async function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    sessionStorage.removeItem(GUEST_SESSION_KEY); setIsGuest(false);
    try { await syncUserWithBackend(result.user); }
    catch (error) { await signOut(auth); throw error; }
  }

  function continueAsGuest() {
    sessionStorage.setItem(GUEST_SESSION_KEY, "true");
    setIsGuest(true);
  }

  async function logout() {
    if (isTester) {
      const returnUrl = sessionStorage.getItem("gradly_tester_return_url") || "/";
      clearTesterSession();
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

  return <AuthContext.Provider value={{ user, loading, isGuest, isTester, loginWithGoogle, loginWithEmail, continueAsGuest, logout, signOut: logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
