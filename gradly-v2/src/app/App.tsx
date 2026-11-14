import { BrowserRouter } from "react-router-dom";

import AppRoutes from "./routes";
import { AuthProvider } from "../features/auth/AuthContext";
import { TesterProvider } from "../features/tester/TesterContext";

function App() {
  return (
    <AuthProvider>
      <TesterProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TesterProvider>
    </AuthProvider>
  );
}

export default App;