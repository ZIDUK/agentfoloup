"use client";

import React, { useState, useContext, ReactNode, useEffect } from "react";
import { User } from "@/types/user";
import { getSupabaseClient } from "@/lib/supabase-client";
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

      const email = authUser.email.toLowerCase();

      if (!email.endsWith("@agenticdream.com")) {
        await supabase.auth.signOut();
        router.push("/sign-in?error=unauthorized");
        return;
      }

      const res = await fetch(`/api/user?email=${encodeURIComponent(email)}`);
      const userData = await res.json();
      if (!userData) {
        await supabase.auth.signOut();
        router.push("/sign-in?error=unauthorized");
        return;
      }
      setClient(userData);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) handleAuthUser(session.user);
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
