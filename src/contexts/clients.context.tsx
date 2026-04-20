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

export function ClientProvider({ children }: ClientProviderProps) {
  const [client, setClient] = useState<User>();
  const supabase = getSupabaseClient();
  const router = useRouter();

  useEffect(() => {
    const handleAuthUser = async (authUser: any) => {
      if (!authUser?.email) return;

      if (!authUser.email.endsWith("@agenticdream.com")) {
        await supabase.auth.signOut();
        router.push("/sign-in?error=unauthorized");
        return;
      }

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
  }, [supabase]);

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
