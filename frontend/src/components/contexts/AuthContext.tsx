import axios from "axios";
import {
  createContext,
  ReactNode,
  useContext,
  useState,
  useEffect,
} from "react";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  name: string;
  email: string;
  isAuthenticated: boolean;
}

interface AuthProviderProps {
  children: ReactNode;
}

interface AuthContextValue {
  userData: AuthContextType | null;
  setUserData: (userData: AuthContextType | null) => void;
  handleRegister: (
    name: string,
    email: string,
    password: string
  ) => Promise<void>;
  handleLogin: (email: string, password: string) => Promise<void>;
  handleLogout: () => void;
  loading: boolean;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const client = axios.create({
  baseURL: `${API_URL}/api/users`,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add response interceptor for better error handling
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem("userName");
      window.location.href = "/auth";
    }
    return Promise.reject(error);
  }
);

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = () => {
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return auth;
};

function AuthProvider({ children }: AuthProviderProps) {
  const [userData, setUserData] = useState<AuthContextType | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await client.get("/me");
        if (response.data.user) {
          const userData = {
            name: response.data.user.name,
            email: response.data.user.email,
            isAuthenticated: true,
          };
          setUserData(userData);
          localStorage.setItem("userName", response.data.user.name);
        }
      } catch (error) {
        setUserData(null);
        localStorage.removeItem("userName");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleRegister = async (
    name: string,
    email: string,
    password: string
  ) => {
    try {
      const response = await client.post("/register", {
        name,
        email,
        password,
      });

      if (response.data.user) {
        const userData = {
          name: response.data.user.name,
          email: response.data.user.email,
          isAuthenticated: true,
        };
        setUserData(userData);
        localStorage.setItem("userName", response.data.user.name);
        navigate("/home");
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Registration failed");
    }
  };

  const handleLogin = async (email: string, password: string) => {
    try {
      const response = await client.post("/login", {
        email,
        password,
      });

      if (response.data.user) {
        const userData = {
          name: response.data.user.name,
          email: response.data.user.email,
          isAuthenticated: true,
        };
        setUserData(userData);
        localStorage.setItem("userName", response.data.user.name);
        navigate("/home");
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Login failed");
    }
  };

  const handleLogout = async () => {
    try {
      await client.post("/logout");
      setUserData(null);
      localStorage.removeItem("userName");
      navigate("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const contextValue = {
    userData,
    setUserData,
    handleRegister,
    handleLogin,
    handleLogout,
    loading,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export { AuthProvider, AuthContext };
