"use client";

import React, { useState, useContext, ReactNode, useEffect } from "react";
import { User } from "@/types/user";
import { getSupabaseClient } from "@/lib/supabase-client";
import { AuthChangeEvent, Session, AuthError } from "@supabase/supabase-js";
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
    let isMounted = true;

    const handleAuthUser = async (authUser: any) => {
      try {
        if (!authUser?.email) return;

        const email = authUser.email.toLowerCase();

        if (!email.endsWith("@agenticdream.com")) {
          await supabase.auth.signOut();
          if (isMounted) router.push("/sign-in?error=unauthorized");
          return;
        }

        let userData: any;
        try {
          const res = await fetch(`/api/user?email=${encodeURIComponent(email)}`);
          if (!res.ok) {
            await supabase.auth.signOut();
            if (isMounted) router.push("/sign-in?error=auth_failed");
            return;
          }
          userData = await res.json();
        } catch {
          await supabase.auth.signOut();
          if (isMounted) router.push("/sign-in?error=auth_failed");
          return;
        }

        if (!userData) {
          await supabase.auth.signOut();
          if (isMounted) router.push("/sign-in?error=unauthorized");
          return;
        }

        if (isMounted) setClient(userData);
      } catch {
        await supabase.auth.signOut();
        if (isMounted) router.push("/sign-in?error=auth_failed");
      }
    };

    supabase.auth.getSession().then(({ data: { session }, error }: { data: { session: Session | null }; error: AuthError | null }) => {
      if (error?.code === "refresh_token_not_found") {
        supabase.auth.signOut().then(() => { if (isMounted) router.push("/sign-in"); });
        return;
      }
      if (session?.user) handleAuthUser(session.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (session?.user) {
        handleAuthUser(session.user);
      } else {
        if (isMounted) setClient(undefined);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
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
