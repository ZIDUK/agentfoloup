"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import LoaderWithText from "@/components/loaders/loader-with-text/loaderWithText";

type Props = {
  params: {
    interviewId: string;
    jobId: string;
    applicationId: string;
  };
};

type PopupProps = {
  title: string;
  description: string;
  image: string;
};

function PopupLoader() {
  return (
    <div className="bg-background rounded-md absolute -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2 md:w-[80%] w-[90%]">
      <div className="h-[88vh] justify-center items-center rounded-lg border-2 border-b-4 border-r-4 border-black font-bold transition-all md:block dark:border-white">
        <div className="relative flex flex-col items-center justify-center h-full">
          <LoaderWithText />
        </div>
      </div>
    </div>
  );
}

function PopUpMessage({ title, description, image }: PopupProps) {
  return (
    <div className="bg-card rounded-md absolute -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2 md:w-[80%] w-[90%]">
      <div className="h-[88vh] content-center rounded-lg border-2 border-b-4 border-r-4 border-black font-bold transition-all md:block dark:border-white">
        <div className="flex flex-col items-center justify-center my-auto">
          <Image
            src={image}
            alt="Graphic"
            width={200}
            height={200}
            className="mb-4"
          />
          <h1 className="text-md font-medium mb-2">{title}</h1>
          <p>{description}</p>
        </div>
      </div>
    </div>
  );
}

type ResolveState = "checking" | "not_found" | "expired" | "redirecting";

function InvitationResolver({ params }: Props) {
  const { applicationId } = params;
  const router = useRouter();
  const [resolveState, setResolveState] = useState<ResolveState>("checking");

  useEffect(() => {
    fetch(`/api/fn/invitations-get?application_id=${encodeURIComponent(applicationId)}`)
      .then((r) => {
        if (r.status === 404) return null;
        return r.json();
      })
      .then((result) => {
        if (!result) {
          setResolveState("not_found");
          return;
        }
        if (result.is_expired) {
          setResolveState("expired");
          return;
        }
        setResolveState("redirecting");
        router.replace(`/call/${result.invitation.id}`);
      })
      .catch(() => setResolveState("not_found"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (resolveState === "not_found") {
    return (
      <div className="h-screen overflow-hidden">
        <div className="hidden md:block p-4 h-full form-container">
          <PopUpMessage
            title="No Invitation Found"
            description="No invitation found. Please contact the hiring team."
            image="/invalid-url.png"
          />
        </div>
        <div className="md:hidden flex flex-col items-center justify-center my-auto">
          <div className="mt-48 px-3">
            <p className="text-center text-muted-foreground my-5">
              No invitation found. Please contact the hiring team.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (resolveState === "expired") {
    return (
      <div className="h-screen overflow-hidden">
        <div className="hidden md:block p-4 h-full form-container">
          <PopUpMessage
            title="Invitation Expired"
            description="This invitation has expired. Please contact the hiring team."
            image="/closed.png"
          />
        </div>
        <div className="md:hidden flex flex-col items-center justify-center my-auto">
          <div className="mt-48 px-3">
            <p className="text-center text-muted-foreground my-5">
              This invitation has expired. Please contact the hiring team.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden">
      <div className="hidden md:block p-4 h-full form-container">
        <PopupLoader />
      </div>
    </div>
  );
}

export default function Page({ params }: Props) {
  return (
    <Suspense fallback={
      <div className="h-screen overflow-hidden">
        <div className="hidden md:block p-4 h-full form-container">
          <PopupLoader />
        </div>
      </div>
    }>
      <InvitationResolver params={params} />
    </Suspense>
  );
}
