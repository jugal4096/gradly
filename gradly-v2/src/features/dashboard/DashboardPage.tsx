import { useAuth } from "../auth/AuthContext";

export default function DashboardPage() {
  const { user, signOut } = useAuth();

  return (
    <main>
      <h1>Gradly Dashboard</h1>

      <p>
        Welcome{user?.displayName ? `, ${user.displayName}` : ""}.
      </p>

      {user?.email && <p>{user.email}</p>}

      <button
        type="button"
        onClick={() => void signOut()}
      >
        Sign Out
      </button>
    </main>
  );
}