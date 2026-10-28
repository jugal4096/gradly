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
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from "firebase/auth";

import { auth } from "../../config/firebase";

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  isGuest: boolean;
  loginWithGoogle: () => Promise<void>;
  enterGuestMode: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://localhost:5000" : "")
).replace(/\/+$/, "").replace(/\/api$/i, "");

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(
    () => sessionStorage.getItem("gradly_guest_mode") === "true"
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        sessionStorage.removeItem("gradly_guest_mode");
        setIsGuest(false);
      } else {
        setIsGuest(sessionStorage.getItem("gradly_guest_mode") === "true");
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

    if (!API_BASE_URL) {
      throw new Error("Gradly API is not configured. Set VITE_API_BASE_URL and try again.");
    }

    const response = await fetch(API_BASE_URL + "/api/auth/sync", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + idToken,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || "Failed to synchronize user with Gradly backend.");
    }

    sessionStorage.removeItem("gradly_guest_mode");
    setIsGuest(false);
    await response.json();
  }

  function enterGuestMode() {
    sessionStorage.setItem("gradly_guest_mode", "true");
    setIsGuest(true);
  }

  async function logout() {
    sessionStorage.removeItem("gradly_guest_mode");
    setIsGuest(false);
    await firebaseSignOut(auth);
  }

  return (
    <AuthContext.Provider value={{ user, loading, isGuest, loginWithGoogle, enterGuestMode, logout }}>
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