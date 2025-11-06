"use client";

import React, { useState, useContext, ReactNode, useEffect } from "react";
import { User } from "@/types/user";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
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
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const supabase = createClientComponentClient();
  const SKIP_AUTH = process.env.NEXT_PUBLIC_SKIP_AUTH === "true";

  const [clientLoading, setClientLoading] = useState(true);

  useEffect(() => {
    // If SKIP_AUTH is enabled, use a mock user
    if (SKIP_AUTH) {
      const mockUser = {
        id: "dev-user-123",
        email: "dev@example.com",
        user_metadata: {
          organization_id: "dev-org-123",
          organization_name: "Development Organization",
        },
      };
      setUser(mockUser);
      setOrganizationId(mockUser.user_metadata.organization_id);
      setClientLoading(false);
      return;
    }

    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      
      // Get organization from user metadata or create default
      if (user) {
        // For now, we'll use a default organization or get it from user metadata
        // You can extend this to support multiple organizations later
        const orgId = user.user_metadata?.organization_id || user.id;
        setOrganizationId(orgId);
      }
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const orgId = session.user.user_metadata?.organization_id || session.user.id;
        setOrganizationId(orgId);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, SKIP_AUTH]);

  const fetchClient = async () => {
    if (!user?.id || !organizationId) return;
    
    try {
      setClientLoading(true);
      const response = await ClientService.getClientById(
        user.id,
        user.email,
        organizationId,
      );
      setClient(response);
    } catch (error) {
      console.error(error);
    }
    setClientLoading(false);
  };

  const fetchOrganization = async () => {
    if (!organizationId) return;
    
    try {
      setClientLoading(true);
      const response = await ClientService.getOrganizationById(
        organizationId,
        user?.user_metadata?.organization_name || "My Organization",
      );
    } catch (error) {
      console.error(error);
    }
    setClientLoading(false);
  };

  useEffect(() => {
    if (user?.id && organizationId) {
      fetchClient();
      fetchOrganization();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, organizationId]);

  return (
    <ClientContext.Provider
      value={{
        client,
      }}
    >
      {children}
    </ClientContext.Provider>
  );
}

export const useClient = () => {
  const value = useContext(ClientContext);

  return value;
};
