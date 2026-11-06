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
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";

import { auth } from "../../config/firebase";

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  isGuest: boolean;
  loginWithGoogle: () => Promise<void>;
  continueAsGuest: () => void;
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
}

const GUEST_SESSION_KEY = "gradly_guest_session";
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(
    () => sessionStorage.getItem(GUEST_SESSION_KEY) === "true",
  );

  useEffect(() => {
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

  async function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const firebaseUser = result.user;
    const idToken = await firebaseUser.getIdToken();

    sessionStorage.removeItem(GUEST_SESSION_KEY);
    setIsGuest(false);

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
    const response = await fetch(`${apiBaseUrl}/api/auth/sync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        errorData?.message || "Failed to synchronize user with Gradly backend.",
      );
    }
  }

  function continueAsGuest() {
    sessionStorage.setItem(GUEST_SESSION_KEY, "true");
    setIsGuest(true);
  }

  async function logout() {
    sessionStorage.removeItem(GUEST_SESSION_KEY);
    setIsGuest(false);
    await signOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isGuest,
        loginWithGoogle,
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
