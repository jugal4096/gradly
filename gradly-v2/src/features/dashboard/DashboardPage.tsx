import { useAuth } from "../auth/useAuth";

export default function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <main>
      <h1>Gradly Dashboard</h1>

      <p>
        Welcome{user?.displayName ? `, ${user.displayName}` : ""}.
      </p>

      {user?.email && <p>{user.email}</p>}

      <button
        type="button"
        onClick={() => void logout()}
      >
        Sign Out
      </button>
    </main>
  );
}