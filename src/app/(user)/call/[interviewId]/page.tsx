"use client";

import { useInterviews } from "@/contexts/interviews.context";
import { useEffect, useState, Suspense } from "react";
import Call from "@/components/call";
import Image from "next/image";
import { Interview } from "@/types/interview";
import LoaderWithText from "@/components/loaders/loader-with-text/loaderWithText";
import { getSupabaseClient } from "@/lib/supabase-client";

type Props = {
  params: {
    interviewId: string;
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
      <div className="h-[88vh] justify-center items-center rounded-lg border-2 border-b-4 border-r-4 border-foreground font-bold transition-all md:block">
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
      <div className="h-[88vh] content-center rounded-lg border-2 border-b-4 border-r-4 border-foreground font-bold transition-all md:block">
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

type InviteState = "checking" | "not_found" | "expired" | "valid" | "interview_not_found" | "interview_inactive";

type InvitationData = {
  id: string;
  interview_id: string;
  application_id: string;
  job_id: number | null;
  candidate_email: string;
  candidate_name: string | null;
};

function InterviewInterface({ params }: Props) {
  const invitationId = params.interviewId;
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [interview, setInterview] = useState<Interview>();
  const [isActive, setIsActive] = useState(true);
  const { getInterviewById } = useInterviews();
  const [interviewNotFound, setInterviewNotFound] = useState(false);
  const [isCheckingApp, setIsCheckingApp] = useState(true);
  const [inviteState, setInviteState] = useState<InviteState>("checking");

  // Gate: fetch and validate invitation by UUID
  useEffect(() => {
    fetch(`/api/fn/invitations-get?id=${encodeURIComponent(invitationId)}`)
      .then((r) => {
        if (r.status === 404) return null;
        return r.json();
      })
      .then((result) => {
        if (!result) {
          setInviteState("not_found");
          return;
        }
        if (result.is_expired) {
          setInviteState("expired");
          return;
        }
        setInvitation(result.invitation);
        setInviteState("valid");
      })
      .catch(() => setInviteState("not_found"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once invite is valid, check if a response already exists
  useEffect(() => {
    if (inviteState !== "valid" || !invitation) return;

    fetch("/api/check-response", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId: invitation.application_id }),
    })
      .then((r) => r.json())
      .then(({ exists, call_id }) => {
        if (exists && call_id) {
          window.location.href = `/result/${call_id}`;
        } else {
          setIsCheckingApp(false);
        }
      })
      .catch(() => setIsCheckingApp(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteState, invitation]);

  useEffect(() => {
    if (interview) {
      setIsActive(interview?.is_active === true);
    }
  }, [interview]);

  useEffect(() => {
    if (isCheckingApp || !invitation) return;
    const fetchInterview = async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("interview")
        .select("id,is_active,is_archived,is_deleted")
        .eq("id", invitation.interview_id)
        .maybeSingle();

      if (error || data === null) {
        setInviteState("interview_not_found");
        return;
      }
      if (data.is_active === false || data.is_archived === true || data.is_deleted === true) {
        setInviteState("interview_inactive");
        return;
      }

      try {
        const response = await getInterviewById(invitation.interview_id);
        if (response) {
          setInterview(response);
          document.title = response.name;
        } else {
          setInterviewNotFound(true);
        }
      } catch {
        setInterviewNotFound(true);
      }
    };
    fetchInterview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCheckingApp, invitation]);

  // Fire-and-forget: mark invite as started once interview begins loading
  useEffect(() => {
    if (inviteState === "valid" && invitation && !isCheckingApp && interview) {
      fetch(`/api/invitations/${invitation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_started: true }),
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteState, invitation, isCheckingApp, interview]);

  if (inviteState === "checking") {
    return (
      <div className="h-screen overflow-hidden">
        <div className="hidden md:block p-4 h-full form-container">
          <PopupLoader />
        </div>
      </div>
    );
  }

  if (inviteState === "not_found") {
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

  if (inviteState === "expired") {
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

  if (inviteState === "interview_not_found") {
    return (
      <div className="h-screen overflow-hidden">
        <div className="hidden md:block p-4 h-full form-container">
          <PopUpMessage
            title="This Link Is Not Valid"
            description="This interview may have been removed. Please contact the hiring team."
            image="/invalid-url.png"
          />
        </div>
        <div className="md:hidden flex flex-col items-center justify-center my-auto">
          <div className="mt-48 px-3">
            <p className="text-center text-muted-foreground my-5">
              This interview may have been removed. Please contact the hiring team.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (inviteState === "interview_inactive") {
    return (
      <div className="h-screen overflow-hidden">
        <div className="hidden md:block p-4 h-full form-container">
          <PopUpMessage
            title="This Interview Is Closed"
            description="This interview is no longer accepting responses. Please contact the hiring team."
            image="/closed.png"
          />
        </div>
        <div className="md:hidden flex flex-col items-center justify-center my-auto">
          <div className="mt-48 px-3">
            <p className="text-center text-muted-foreground my-5">
              This interview is no longer accepting responses. Please contact the hiring team.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden">
      <div className="hidden md:block p-4 h-full form-container">
        {isCheckingApp || !interview ? (
          interviewNotFound ? (
            <PopUpMessage
              title="This Link Is Not Valid"
              description="This interview may have been removed. Please contact the hiring team."
              image="/invalid-url.png"
            />
          ) : (
            <PopupLoader />
          )
        ) : !isActive ? (
          <PopUpMessage
            title="This Interview Is Closed"
            description="This interview is no longer accepting responses. Please contact the hiring team."
            image="/closed.png"
          />
        ) : (
          <Call
            interview={interview}
            applicationId={invitation?.application_id}
            invitationId={invitation?.id ?? undefined}
            jobId={invitation?.job_id ?? undefined}
            invitationEmail={invitation?.candidate_email ?? ""}
          />
        )}
      </div>
      <div className="md:hidden flex flex-col items-center md:h-[0px] justify-center my-auto">
        <div className="mt-48 px-3">
          <p className="text-center my-5 text-md font-semibold">
            {interview?.name}
          </p>
          <p className="text-center text-muted-foreground my-5">
            Please use a PC to respond to the interview. Apologies for any
            inconvenience caused.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Page({ params }: Props) {
  return (
    <Suspense fallback={<PopupLoader />}>
      <InterviewInterface params={params} />
    </Suspense>
  );
}
