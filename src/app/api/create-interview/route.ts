import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { InterviewService } from "@/services/interviews.service";
import { logger } from "@/lib/logger";

const base_url = process.env.NEXT_PUBLIC_LIVE_URL;

export async function POST(req: Request, res: Response) {
  try {
    const url_id = nanoid();
    const url = `${base_url}/call/${url_id}`;
    const body = await req.json();

    logger.info("create-interview request received");

    const payload = body.interviewData;

    let readableSlug = null;
    if (body.organizationName) {
      const interviewNameSlug = payload.name?.toLowerCase().replace(/\s/g, "-");
      const orgNameSlug = body.organizationName
        ?.toLowerCase()
        .replace(/\s/g, "-");
      readableSlug = `${orgNameSlug}-${interviewNameSlug}`;
    }

    await InterviewService.createInterview({
      ...payload,
      url: url,
      id: url_id,
      readable_slug: readableSlug,
      ...(payload.job_id != null ? { job_id: Number(payload.job_id) } : {}),
    });

    logger.info("Interview created successfully");

    // Notify DreamIT with the interview URL for the linked job
    if (payload.job_id) {
      const dreamitUrl = process.env.DREAMIT_URL;
      const secret = process.env.DREAMIT_FOLOUP_SECRET;
      const serviceRoleKey = process.env.DREAMIT_SUPABASE_SERVICE_ROLE_KEY;
      if (dreamitUrl && secret && serviceRoleKey) {
        try {
          const dreamitRes = await fetch(`${dreamitUrl}/functions/v1/update-foloup-speech-link`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-foloup-secret": secret,
              "Authorization": `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({ job_id: Number(payload.job_id), foloup_speech_link: url }),
          });

          const data = await dreamitRes.json().catch(() => null);
          console.log("DreamIT speech link update response", data,{ job_id: Number(payload.job_id), status: dreamitRes.status, response: data });
          if (dreamitRes.ok) {
            console.log("DreamIT speech link updated", { job_id: Number(payload.job_id), url, response: data });
          } else {
            console.log("DreamIT speech link update failed", { status: dreamitRes.status, job_id: Number(payload.job_id), response: data });
          }
        } catch (err) {
          console.log("DreamIT speech link request error", { job_id: Number(payload.job_id), error: err });
        }
      }
    }

    return NextResponse.json(
      { response: "Interview created successfully" },
      { status: 200 },
    );
  } catch (err) {
    logger.error("Error creating interview");

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
