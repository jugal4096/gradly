import { BrowserRouter } from "react-router-dom";

import AppRoutes from "./routes";
import { AuthProvider } from "../features/auth/AuthContext";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;