    LogOut,
    ShieldCheck,
  } from "lucide-react";
  
  import {
    useNavigate,
  } from "react-router-dom";
  
  import "./AdminDashboard.css";
  
  function AdminDashboard() {
  
    const navigate = useNavigate();
  
    const handleLogout = () => {
  
      localStorage.removeItem(
        "gradly_admin_token"
      );
  
      navigate(
        "/admin",
        {
          replace: true,
        }
      );
    };
  
  
    return (
      <div className="admin-dashboard">
  
        <header className="admin-dashboard-header">
  
          <div className="admin-dashboard-brand">
  
            <div className="admin-dashboard-logo">
              G
            </div>
  
            <div>
  
              <strong>
                GRADLY
              </strong>
  
              <span>
                Administration Portal
              </span>
  
            </div>
  
  
  
          <button
            type="button"
            onClick={handleLogout}
            className="admin-dashboard-logout"
          >
            <LogOut size={16} />
  
            Logout
  
  
  
        <main className="admin-dashboard-main">
  
          <div className="admin-dashboard-welcome">
  
            <ShieldCheck size={30} />
  
            <div>
  
              <span>
                AUTHORIZED ADMINISTRATOR
              </span>
  
              <h1>
                Admin Dashboard
              </h1>
  
              <p>
                You have successfully authenticated
                with the Gradly Administration System.
              </p>
  
  
          </div>
  
  
          <section className="admin-dashboard-panel">
  
            <h2>
              Administration Modules
            </h2>
  
            <p>
              Your department administration modules
              will appear here according to your assigned
              permissions.
            </p>
  
  
  
    );
  }
  
  export default AdminDashboard;