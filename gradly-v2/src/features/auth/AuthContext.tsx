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
  authError: string;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  continueAsGuest: () => void;
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
}

const GUEST_SESSION_KEY = "gradly_guest_session";
const GUEST_ID_KEY = "gradly_guest_id";
const AuthContext = createContext<AuthContextType | undefined>(undefined);
const backendSyncs = new Map<string, Promise<void>>();

async function synchronizeFirebaseUser(firebaseUser: FirebaseUser): Promise<void> {
  const pending = backendSyncs.get(firebaseUser.uid);
  if (pending) return pending;

  const sync = (async () => {
    const idToken = await firebaseUser.getIdToken();
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\\/+$/, "");
    const response = await fetch(`${apiBaseUrl}/api/auth/sync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.message || "Failed to synchronize your Gradly account.");
    }
    if (!data?.user?.id || data.user.active !== true) {
      throw new Error(data?.user?.active === false
        ? "This Gradly account is disabled. Contact the platform administrator."
        : "Gradly could not verify your student account. Please try signing in again.");
    }
  })();

  backendSyncs.set(firebaseUser.uid, sync);
  try {
    await sync;
  } finally {
    if (backendSyncs.get(firebaseUser.uid) === sync) {
      backendSyncs.delete(firebaseUser.uid);
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [isGuest, setIsGuest] = useState(
    () => sessionStorage.getItem(GUEST_SESSION_KEY) === "true",
  );

  useEffect(() => {
    let authEventVersion = 0;
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      const currentVersion = ++authEventVersion;
      setLoading(true);

      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      void (async () => {
        try {
          await synchronizeFirebaseUser(firebaseUser);
          if (currentVersion !== authEventVersion) return;
          setAuthError("");
          setUser(firebaseUser);
          sessionStorage.removeItem(GUEST_SESSION_KEY);
          setIsGuest(false);
        } catch (error) {
          if (currentVersion !== authEventVersion) return;
          setUser(null);
          setAuthError(error instanceof Error ? error.message : "Unable to verify your Gradly account.");
          await signOut(auth).catch(() => undefined);
        } finally {
          if (currentVersion === authEventVersion) setLoading(false);
        }
      })();
    });

    return () => {
      authEventVersion += 1;
      unsubscribe();
    };
  }, []);

  async function loginWithEmail(email: string, password: string) {
    setAuthError("");
    const result = await signInWithEmailAndPassword(auth, email, password);
    sessionStorage.removeItem(GUEST_SESSION_KEY);
    setIsGuest(false);
    await synchronizeFirebaseUser(result.user);
  }

  async function loginWithGoogle() {
    setAuthError("");
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    sessionStorage.removeItem(GUEST_SESSION_KEY);
    setIsGuest(false);
    await synchronizeFirebaseUser(result.user);
  }

  function continueAsGuest() {
    sessionStorage.setItem(GUEST_SESSION_KEY, "true");
    setIsGuest(true);
  }

  async function logout() {
    sessionStorage.removeItem(GUEST_SESSION_KEY);
    localStorage.removeItem(GUEST_ID_KEY);
    localStorage.removeItem("gradly_guest_session_token");
    localStorage.removeItem("gradly_guest_institute");
    setIsGuest(false);
    setAuthError("");
    await signOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isGuest,
        authError,
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

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
