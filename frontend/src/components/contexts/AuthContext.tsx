import axios from "axios";
import { createContext, ReactNode, useContext, useState } from "react";

import { useNavigate } from "react-router-dom";

interface AuthContextType {
  name: string;
  email: string;
  password: string;
}
interface AuthProviderProps {
  children: ReactNode;
}
interface AuthContextValue {
  userData: AuthContextType | undefined;
  setUserData: (userData: AuthContextType | undefined) => void;
  handleRegister: (
    name: string,
    email: string,
    password: string
  ) => Promise<void>;
  handleLogin: (email: string, password: string) => Promise<void>;
}

const client = axios.create({
  baseURL: "http://localhost:8000/api/users",
});

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = () => {
  const auth = useContext(AuthContext);
  return auth;
};

function AuthProvider({ children }: AuthProviderProps) {
  const [userData, setUserData] = useState<AuthContextType>();
  const navigate = useNavigate();

  const handleRegister = async (
    name: string,
    email: string,
    password: string
  ) => {
    // Register the user
    setUserData({ name, email, password });

    try {
      const request = await client.post("/register", {
        name,
        email,
        password,
      });
      if (request.status === 201) {
        console.log("User registered successfully");
      }
      navigate("/home");
    } catch (error) {
      console.error(error);
    }
  };

  const handleLogin = async (email: string, password: string) => {
    try {
      const request = await client.post("/login", {
        email,
        password,
      });
      if (request.status === 200) {
        console.log("User logged in successfully");
      }
      navigate("/home");
    } catch (error) {
      console.error(error);
    }
  };

  const contextValue = { userData, setUserData, handleRegister, handleLogin };
  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

export { AuthProvider, AuthContext };
