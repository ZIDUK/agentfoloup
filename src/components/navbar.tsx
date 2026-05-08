"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ThemeToggle";

function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabaseClient();
  const router = useRouter();

  const resolvePhoto = async (email: string) => {
    try {
      const res = await fetch(`/api/user?email=${encodeURIComponent(email.toLowerCase())}`);
      const data = await res.json();
      if (data?.employee_photo) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        setPhotoUrl(`${supabaseUrl}/storage/v1/object/public/${data.employee_photo}`);
      }
    } catch {
      // photo resolution failure is non-fatal
    }
  };

  useEffect(() => {
    let isMounted = true;

    const getUser = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (error) {
        if (error.code === "refresh_token_not_found") {
          await supabase.auth.signOut();
        } else {
          console.error(error);
        }
        setUser(null);
        setLoading(false);
        return;
      }

      const user = session?.user ?? null;
      setUser(user);
      if (user?.email) await resolvePhoto(user.email);
      if (isMounted) setLoading(false);
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user?.email) resolvePhoto(session.user.email);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/sign-in");
  };

  const getInitials = (email: string) => {
    return email
      .split("@")[0]
      .split(".")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="fixed inset-x-0 top-0 bg-secondary z-[10] h-16">
      <div className="flex items-center justify-between h-full gap-2 px-8">
        <div className="flex flex-row gap-3 justify-center">
          <Link href={"/dashboard"} className="flex items-center gap-2">
            <p className="px-2 py-1 text-2xl font-bold text-foreground">
              Folo<span className="text-indigo-600">Up</span>{" "}
              <span className="text-[8px]">Beta</span>
            </p>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {!loading && user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar>
                    <AvatarImage src={photoUrl || "/user-icon.png"} />
                    <AvatarFallback>
                      {getInitials(user.email || "U")}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-auto min-w-56" align="end" forceMount>
                <div className="flex items-center gap-3 p-3">
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={photoUrl || "/user-icon.png"} />
                    <AvatarFallback>{getInitials(user.email || "U")}</AvatarFallback>
                  </Avatar>
                  <p className="text-sm font-medium whitespace-nowrap">{user.email}</p>
                </div>
                <DropdownMenuItem onClick={handleSignOut}>
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
}

export default Navbar;
