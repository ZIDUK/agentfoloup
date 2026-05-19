"use client";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import React, { useState, useEffect, useRef } from "react";
import { useInterviews } from "@/contexts/interviews.context";
import { Share2, Filter, Pencil, UserIcon, Eye, Palette, ChevronLeft, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRouter } from "next/navigation";
import { Interview } from "@/types/interview";
import { Response } from "@/types/response";
import { formatTimestampToDateHHMM } from "@/lib/utils";
import CallInfo from "@/components/call/callInfo";
import SummaryInfo from "@/components/dashboard/interview/summaryInfo";
import EditInterview from "@/components/dashboard/interview/editInterview";
import Modal from "@/components/dashboard/Modal";
import { toast } from "sonner";
import { HexColorPicker } from "react-colorful";
import SharePopup from "@/components/dashboard/interview/sharePopup";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CandidateStatus } from "@/lib/enum";
import LoaderWithText from "@/components/loaders/loader-with-text/loaderWithText";

interface Props {
  params: {
    interviewId: string;
  };
  searchParams: {
    call: string;
    edit: boolean;
  };
}

interface LinkedJob {
  job_id: number;
  job_title: string;
}

const base_url = process.env.NEXT_PUBLIC_LIVE_URL;
const PAGE_SIZE = 50;

function InterviewHome({ params, searchParams }: Props) {
  const [interview, setInterview] = useState<Interview>();
  const [responses, setResponses] = useState<Response[]>([]);
  const [totalResponses, setTotalResponses] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const { getInterviewById } = useInterviews();
  const [isSharePopupOpen, setIsSharePopupOpen] = useState(false);
  const router = useRouter();
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState<boolean>(false);
  const [isViewed, setIsViewed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [showColorPicker, setShowColorPicker] = useState<boolean>(false);
  const [themeColor, setThemeColor] = useState<string>("#4F46E5");
  const [iconColor, seticonColor] = useState<string>("#4F46E5");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [responseType, setResponseType] = useState<string>("CANDIDATE");

  // New filter state
  const [linkedJobs, setLinkedJobs] = useState<LinkedJob[]>([]);
  const [filterJobId, setFilterJobId] = useState<string>("");
  const [filterEmail, setFilterEmail] = useState<string>("");
  const [filterName, setFilterName] = useState<string>("");
  const emailDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const nameDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [emailInput, setEmailInput] = useState<string>("");
  const [nameInput, setNameInput] = useState<string>("");

  const seeInterviewPreviewPage = () => {
    if (!interview) {
      toast.error("Interview not loaded. Please try again.");
      return;
    }

    let interviewId = interview.readable_slug;
    if (!interviewId && interview.url) {
      const urlParts = interview.url.split("/");
      interviewId = urlParts[urlParts.length - 1];
    }
    if (!interviewId && interview.id) {
      interviewId = interview.id;
    }

    if (interviewId) {
      window.open(`/call/${interviewId}`, "_blank");
    } else {
      toast.error("Unable to open interview preview. Interview URL is missing.");
    }
  };

  useEffect(() => {
    const fetchInterview = async () => {
      try {
        const response = await getInterviewById(params.interviewId);
        setInterview(response);
        setIsActive(response.is_active);
        setIsViewed(response.is_viewed);
        setThemeColor(response.theme_color ?? "#4F46E5");
        seticonColor(response.theme_color ?? "#4F46E5");
      } catch {
        // silent
      }
    };
    if (!interview || !isGeneratingInsights) {
      fetchInterview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getInterviewById, params.interviewId, isGeneratingInsights]);

  // Fetch linked jobs for the job filter dropdown
  useEffect(() => {
    fetch(`/api/interview-jobs?interviewId=${params.interviewId}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data.jobs)) setLinkedJobs(data.jobs); })
      .catch(() => {});
  }, [params.interviewId]);

  const [refreshKey, setRefreshKey] = useState(0);

  // Single effect — fires whenever filters, page, or a forced refresh changes
  useEffect(() => {
    const controller = new AbortController();
    const doFetch = async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        qs.set("interviewId", params.interviewId);
        if (filterJobId) qs.set("job_id", filterJobId);
        if (filterEmail) qs.set("email", filterEmail);
        if (filterName) qs.set("name", filterName);
        qs.set("page", String(currentPage));
        qs.set("page_size", String(PAGE_SIZE));

        const res = await fetch(`/api/responses?${qs.toString()}`, { signal: controller.signal });
        const json = await res.json();
        setResponses(json.data ?? []);
        setTotalResponses(json.total ?? 0);
      } catch (e: any) {
        if (e?.name !== "AbortError") { /* silent */ }
      } finally {
        setLoading(false);
      }
    };
    doFetch();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.interviewId, filterJobId, filterEmail, filterName, currentPage, refreshKey]);

  // Reset to page 1 when filters change (page effect above will re-fire via currentPage change)
  useEffect(() => {
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterJobId, filterEmail, filterName]);

  // Stable event listener — increments refreshKey to force a re-fetch
  useEffect(() => {
    const handler = () => setRefreshKey((k) => k + 1);
    window.addEventListener("responses-updated", handler);
    return () => window.removeEventListener("responses-updated", handler);
  }, []);

  const handleEmailInputChange = (value: string) => {
    setEmailInput(value);
    if (emailDebounceRef.current) clearTimeout(emailDebounceRef.current);
    emailDebounceRef.current = setTimeout(() => setFilterEmail(value.trim()), 500);
  };

  const handleNameInputChange = (value: string) => {
    setNameInput(value);
    if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
    nameDebounceRef.current = setTimeout(() => setFilterName(value.trim()), 500);
  };

  const totalPages = Math.max(1, Math.ceil(totalResponses / PAGE_SIZE));

  const handleDeleteResponse = (deletedCallId: string) => {
    setResponses((prev) => prev.filter((r) => r.call_id !== deletedCallId));
    if (searchParams.call === deletedCallId) {
      router.push(`/interviews/${params.interviewId}`);
    }
  };

  const handleResponseClick = async (response: Response) => {
    try {
      await fetch(`/api/responses/${response.call_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_viewed: true }),
      });
      setResponses((prev) =>
        prev.map((r) => r.call_id === response.call_id ? { ...r, is_viewed: true } : r),
      );
      setIsViewed(true);
    } catch {
      // silent
    }
  };

  const handleToggle = async () => {
    const updatedIsActive = !isActive;
    setIsActive(updatedIsActive);

    try {
      const res = await fetch("/api/toggle-interview-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: params.interviewId, is_active: updatedIsActive }),
      });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}));
        throw new Error(error || "Failed to update status");
      }

      toast.success("Interview status updated", {
        description: `The interview is now ${updatedIsActive ? "active" : "inactive"}.`,
        position: "bottom-right",
        duration: 3000,
      });
    } catch (error: any) {
      setIsActive(!updatedIsActive);
      toast.error("Error", {
        description: error?.message || "Failed to update the interview status.",
        duration: 3000,
      });
    }
  };

  const handleThemeColorChange = async (newColor: string) => {
    try {
      await fetch(`/api/interviews/${params.interviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme_color: newColor }),
      });
      toast.success("Theme color updated", { position: "bottom-right", duration: 3000 });
    } catch {
      toast.error("Error", { description: "Failed to update the theme color." });
    }
  };

  const handleCandidateStatusChange = (callId: string, newStatus: string) => {
    setResponses((prev) =>
      prev.map((r) => r.call_id === callId ? { ...r, candidate_status: newStatus } : r),
    );
  };

  const handleColorChange = (color: string) => setThemeColor(color);

  const applyColorChange = () => {
    if (themeColor !== iconColor) {
      seticonColor(themeColor);
      handleThemeColorChange(themeColor);
    }
    setShowColorPicker(false);
  };

  const filterResponses = () => {
    let filtered = responses;
    if (responseType === "CANDIDATE") filtered = filtered.filter((r) => !r.is_test_response);
    else if (responseType === "TEST") filtered = filtered.filter((r) => r.is_test_response === true);
    if (filterStatus !== "ALL") filtered = filtered.filter((r) => r.candidate_status === filterStatus);
    return filtered;
  };

  return (
    <div className="flex flex-col w-full h-full m-2 bg-card">
      {loading ? (
        <div className="flex flex-col items-center justify-center h-[80%] w-full">
          <LoaderWithText />
        </div>
      ) : (
        <>
          <div className="flex flex-row p-3 pt-4 justify-center gap-6 items-center sticky top-2 bg-card">
            <div className="font-bold text-md">{interview?.name}</div>

            <div
              className="w-5 h-5 rounded-full border-2 border-background shadow"
              style={{ backgroundColor: iconColor }}
            />

            <div className="flex flex-row gap-3 my-auto">
              <UserIcon className="my-auto" size={16} />: {totalResponses}
            </div>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="bg-transparent shadow-none relative text-xs text-primary px-1 h-7 hover:scale-110 hover:bg-transparent"
                    variant="secondary"
                    onClick={(e) => { e.stopPropagation(); setIsSharePopupOpen(true); }}
                  >
                    <Share2 size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-popover" side="bottom" sideOffset={4}>
                  <span className="text-foreground flex flex-row gap-4">Share</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="bg-transparent shadow-none text-xs text-primary px-0 h-7 hover:scale-110 relative"
                    onClick={(e) => { e.stopPropagation(); seeInterviewPreviewPage(); }}
                  >
                    <Eye />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-popover" side="bottom" sideOffset={4}>
                  <span className="text-foreground flex flex-row gap-4">Preview</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="bg-transparent shadow-none text-xs text-primary px-0 h-7 hover:scale-110 relative"
                    onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker); }}
                  >
                    <Palette size={19} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-popover" side="bottom" sideOffset={4}>
                  <span className="text-foreground flex flex-row gap-4">Theme Color</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="bg-transparent shadow-none text-xs text-primary px-0 h-7 hover:scale-110 relative"
                    onClick={() => router.push(`/interviews/${params.interviewId}?edit=true`)}
                  >
                    <Pencil size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-popover" side="bottom" sideOffset={4}>
                  <span className="text-foreground flex flex-row gap-4">Edit</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <label className="inline-flex cursor-pointer">
              <span className="ms-3 my-auto text-sm">Active</span>
              <Switch
                checked={isActive}
                className={`ms-3 my-auto ${isActive ? "bg-primary" : "bg-secondary"}`}
                onCheckedChange={handleToggle}
              />
            </label>
          </div>
          <div className="flex flex-row w-full p-2 h-[85%] gap-1">
            <div className="w-[20%] flex flex-col p-2 divide-y-2 rounded-sm border-2 border-border">
              {/* Response type filter */}
              <div className="flex w-full justify-center py-2">
                <Select
                  defaultValue="CANDIDATE"
                  onValueChange={(v) => setResponseType(v)}
                >
                  <SelectTrigger className="w-[95%] bg-secondary rounded-lg">
                    <SelectValue placeholder="Response Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CANDIDATE">Candidate Responses</SelectItem>
                    <SelectItem value="TEST">Test Responses</SelectItem>
                    <SelectItem value="ALL">All Responses</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Candidate status filter */}
              <div className="flex w-full justify-center py-2">
                <Select onValueChange={(v) => setFilterStatus(v)}>
                  <SelectTrigger className="w-[95%] bg-secondary rounded-lg">
                    <Filter size={18} className="text-muted-foreground" />
                    <SelectValue placeholder="Filter By Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CandidateStatus.NO_STATUS}>
                      <div className="flex items-center"><div className="w-3 h-3 bg-muted-foreground rounded-full mr-2" />No Status</div>
                    </SelectItem>
                    <SelectItem value={CandidateStatus.NOT_SELECTED}>
                      <div className="flex items-center"><div className="w-3 h-3 bg-destructive rounded-full mr-2" />Not Selected</div>
                    </SelectItem>
                    <SelectItem value={CandidateStatus.POTENTIAL}>
                      <div className="flex items-center"><div className="w-3 h-3 bg-warning rounded-full mr-2" />Potential</div>
                    </SelectItem>
                    <SelectItem value={CandidateStatus.SELECTED}>
                      <div className="flex items-center"><div className="w-3 h-3 bg-success rounded-full mr-2" />Selected</div>
                    </SelectItem>
                    <SelectItem value="ALL">
                      <div className="flex items-center"><div className="w-3 h-3 border-2 border-border rounded-full mr-2" />All</div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Job filter */}
              {linkedJobs.length > 0 && (
                <div className="flex w-full justify-center py-2">
                  <Select
                    value={filterJobId}
                    onValueChange={(v) => setFilterJobId(v === "ALL" ? "" : v)}
                  >
                    <SelectTrigger className="w-[95%] bg-secondary rounded-lg">
                      <SelectValue placeholder="Filter By Job" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Jobs</SelectItem>
                      {linkedJobs.map((job) => (
                        <SelectItem key={job.job_id} value={String(job.job_id)}>
                          {job.job_title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Name filter */}
              <div className="flex w-full justify-center py-2">
                <input
                  type="text"
                  className="w-[95%] bg-secondary rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Filter by name…"
                  value={nameInput}
                  onChange={(e) => handleNameInputChange(e.target.value)}
                />
              </div>

              {/* Email filter */}
              <div className="flex w-full justify-center py-2">
                <input
                  type="text"
                  className="w-[95%] bg-secondary rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Filter by email…"
                  value={emailInput}
                  onChange={(e) => handleEmailInputChange(e.target.value)}
                />
              </div>

              {/* Response list */}
              <ScrollArea className="h-full p-1 rounded-md border-none">
                {filterResponses().length > 0 ? (
                  filterResponses().map((response) => (
                    <div
                      className={`p-2 rounded-md hover:bg-accent border-2 my-1 text-left text-xs ${
                        searchParams.call == response.call_id ? "bg-accent" : "border-border"
                      } flex flex-row justify-between cursor-pointer w-full`}
                      key={response?.id}
                      onClick={() => {
                        router.push(`/interviews/${params.interviewId}?call=${response.call_id}`);
                        handleResponseClick(response);
                      }}
                    >
                      <div className="flex flex-row gap-1 items-center w-full">
                        {response.candidate_status === "NOT_SELECTED" ? (
                          <div className="w-[5%] h-full bg-destructive rounded-sm" />
                        ) : response.candidate_status === "POTENTIAL" ? (
                          <div className="w-[5%] h-full bg-warning rounded-sm" />
                        ) : response.candidate_status === "SELECTED" ? (
                          <div className="w-[5%] h-full bg-success rounded-sm" />
                        ) : (
                          <div className="w-[5%] h-full bg-muted-foreground rounded-sm" />
                        )}
                        <div className="flex items-center justify-between w-full">
                          <div className="flex flex-col my-auto">
                            <p className="font-medium mb-[2px]">
                              {response?.name ? `${response?.name}'s Response` : "Anonymous"}
                            </p>
                            <p>{formatTimestampToDateHHMM(String(response?.created_at))}</p>
                          </div>
                          <div className="flex flex-col items-center justify-center ml-auto flex-shrink-0">
                            {!response.is_viewed && (
                              <div className="w-4 h-4 flex items-center justify-center mb-1">
                                <div className="text-primary text-xl leading-none">●</div>
                              </div>
                            )}
                            <div className={`w-6 h-6 flex items-center justify-center ${response.is_viewed ? "h-full" : ""}`}>
                              {response.analytics?.overallScore !== undefined && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="w-6 h-6 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                                        <span className="text-primary text-xs font-semibold">
                                          {response?.analytics?.overallScore}
                                        </span>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-popover" side="bottom" sideOffset={4}>
                                      <span className="text-popover-foreground font-normal flex flex-row gap-4">Overall Score</span>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground">No responses to display</p>
                )}
              </ScrollArea>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2 px-1">
                  <button
                    className="p-1 rounded hover:bg-accent disabled:opacity-30"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs text-muted-foreground">{currentPage} / {totalPages}</span>
                  <button
                    className="p-1 rounded hover:bg-accent disabled:opacity-30"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
            {responses && (
              <div className="w-[85%] rounded-md">
                {searchParams.call ? (
                  <CallInfo
                    call_id={searchParams.call}
                    onDeleteResponse={handleDeleteResponse}
                    onCandidateStatusChange={handleCandidateStatusChange}
                  />
                ) : searchParams.edit ? (
                  <EditInterview interview={interview} />
                ) : (
                  <SummaryInfo responses={filterResponses()} interview={interview} />
                )}
              </div>
            )}
          </div>
        </>
      )}
      <Modal open={showColorPicker} closeOnOutsideClick={false} onClose={applyColorChange}>
        <div className="w-[250px] p-3">
          <h3 className="text-lg font-semibold mb-4 text-center">Choose a Theme Color</h3>
          <HexColorPicker color={themeColor} onChange={handleColorChange} style={{ width: "100%" }} />
        </div>
      </Modal>
      {isSharePopupOpen && (
        <SharePopup
          open={isSharePopupOpen}
          shareContent={
            interview?.readable_slug
              ? `${base_url}/call/${interview?.readable_slug}`
              : (interview?.url as string)
          }
          onClose={() => setIsSharePopupOpen(false)}
        />
      )}
    </div>
  );
}

export default InterviewHome;
