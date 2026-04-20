"use client";

import React, { useState, useContext, ReactNode, useEffect } from "react";
import { User } from "@/types/user";
import { getSupabaseClient } from "@/lib/supabase-client";
import { ClientService } from "@/services/clients.service";

interface ClientContextProps {
  client?: User;
}

export const ClientContext = React.createContext<ClientContextProps>({
  client: undefined,
});

interface ClientProviderProps {
  children: ReactNode;
}

export function ClientProvider({ children }: ClientProviderProps) {
  const [client, setClient] = useState<User>();
  const [user, setUser] = useState<any>(null);
  const [clientLoading, setClientLoading] = useState(true);
  const supabase = getSupabaseClient();
  const SKIP_AUTH = process.env.NEXT_PUBLIC_SKIP_AUTH === "true";

  useEffect(() => {
    if (SKIP_AUTH) {
      const mockUser = {
        id: "dev-user-123",
        email: "dev@example.com",
        user_metadata: {},
      };
      setUser(mockUser);
      setClientLoading(false);
      return;
    }

    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase, SKIP_AUTH]);

  useEffect(() => {
    if (!user?.id) return;
    ClientService.getClientById(user.id, user.email)
      .then(setClient)
      .catch(console.error);
  }, [user?.id]);

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
