import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="dashboard">
      <header>
        <h2>APMCS</h2>
        <div>
          <span>Hello, {user.name}</span>
          <button onClick={logout}>Log out</button>
        </div>
      </header>
      <main>
        <h1>Your projects will appear here</h1>
      </main>
    </div>
  );
}