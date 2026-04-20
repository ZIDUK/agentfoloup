"use client";

import React, { useState, useContext, ReactNode, useEffect } from "react";
import { User } from "@/types/user";
import { getSupabaseClient } from "@/lib/supabase-client";
import { ClientService } from "@/services/clients.service";
import { useRouter } from "next/navigation";

interface ClientContextProps {
  client?: User;
}

export const ClientContext = React.createContext<ClientContextProps>({
  client: undefined,
});

interface ClientProviderProps {
  children: ReactNode;
}

const MOCK_CLIENT: User = {
  id: "dev-user-123",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  email: "dev@example.com",
  name: "Dev User",
  bamboo_id: null,
  role: "admin",
  job_title: "Developer",
  department: "Engineering",
  employee_photo: null,
  employment_status: "active",
};

export function ClientProvider({ children }: ClientProviderProps) {
  const [client, setClient] = useState<User>();
  const supabase = getSupabaseClient();
  const router = useRouter();
  const SKIP_AUTH = process.env.NEXT_PUBLIC_SKIP_AUTH === "true";

  useEffect(() => {
    if (SKIP_AUTH) {
      setClient(MOCK_CLIENT);
      return;
    }

    const handleAuthUser = async (authUser: any) => {
      if (!authUser?.email) return;

      const userData = await ClientService.getClientByEmail(authUser.email);
      if (!userData) {
        await supabase.auth.signOut();
        router.push("/sign-in?error=unauthorized");
        return;
      }
      setClient(userData);
    };

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) handleAuthUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        handleAuthUser(session.user);
      } else {
        setClient(undefined);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, SKIP_AUTH]);

  return (
    <ClientContext.Provider value={{ client }}>
      {children}
    </ClientContext.Provider>
  );
}

export const useClient = () => {
  const value = useContext(ClientContext);
  return value;
};
