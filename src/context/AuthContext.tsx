// src/context/AuthContext.tsx
"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { 
  onAuthStateChanged, 
  User, 
  signOut 
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";

// Tipo dos dados do usuário no Firestore
interface UserData {
  id: string;
  nome: string;
  email: string;
  role: "admin" | "operador";
  plan?: string;
}

// Interface do Contexto incluindo a função de logout
interface AuthContextType {
  user: User | null;          // O usuário técnico do Firebase Authentication
  userData: UserData | null;   // Os dados do nosso banco (nome, cargo, etc)
  loading: boolean;
  logout: () => Promise<void>; 
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // UID do Super Admin (Sabio dos 6 Caninos)
  const superAdminUID = "kJ4iOKdHmbgr4mWms34rp24w9413";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setUser(currentUser);

      if (currentUser) {
        // Buscar dados extras no Firestore (Role, Nome, etc)
        const docRef = doc(db, "usuarios", currentUser.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setUserData({ id: docSnap.id, ...docSnap.data() } as UserData);
        } else {
          // Lógica de Contingência: Se o usuário existe no Auth mas não no Firestore
          // (Muito comum em criações manuais ou erros de rede na primeira gravação)
          
          const isSuperAdmin = currentUser.uid === superAdminUID;
          
          const novoUsuario: UserData = {
            id: currentUser.uid,
            nome: currentUser.displayName || (isSuperAdmin ? "Rodrigo Borges" : "Usuário"),
            email: currentUser.email || "",
            role: isSuperAdmin ? "admin" : "operador" 
          };
          
          // Gravação automática para garantir que o perfil manual seja persistido
          try {
            await setDoc(docRef, novoUsuario, { merge: true });
            setUserData(novoUsuario);
          } catch (error) {
            console.error("Erro ao criar perfil de contingência:", error);
            // Mesmo se falhar a gravação, define no estado para não travar o acesso
            setUserData(novoUsuario);
          }
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Função de Logout completa com redirecionamento
  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserData(null);
      router.push("/login");
    } catch (error) {
      console.error("Erro ao realizar logout:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook personalizado para facilitar o uso em qualquer componente
export const useAuth = () => useContext(AuthContext);