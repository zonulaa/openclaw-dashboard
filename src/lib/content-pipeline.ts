export type ContentStage = "ideas" | "scripts" | "assets" | "revisions" | "publish" | "record" | "editing" | "posted";
export type ReviewStatus = "not-reviewed" | "in-review" | "changes-requested" | "approved";
export type PublishChannel = "none" | "instagram" | "tiktok" | "youtube" | "x" | "facebook" | "linkedin" | "website";

export type AttachmentMeta = {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  path: string;
  uploadedAt: string;
};

export type ApprovalHistoryEntry = {
  id: string;
  approvedBy: string;
  approvedAt: string;
  approvalNotes: string;
};

export type ContentItem = {
  id: string;
  title: string;
  stage: ContentStage;
  hook?: string;
  revisionNotes?: string;
  idea: string;
  tiktokCaption?: string;
  igCaption?: string;
  script: string;
  attachmentIds: string[];
  reviewer: string;
  reviewStatus: ReviewStatus;
  version: number;
  publishReady: boolean;
  channel: PublishChannel;
  approvedBy: string;
  approvedAt: string;
  approvalNotes: string;
  approvalHistory: ApprovalHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  goalId?: string;
  taskId?: string;
  contentNumber?: number;
};

export type ApprovalActionInput = {
  approvedBy?: unknown;
  approvedAt?: unknown;
  approvalNotes?: unknown;
};

const CONTENT_STAGES: ContentStage[] = ["ideas", "scripts", "assets", "revisions", "publish", "record", "editing", "posted"];
const REVIEW_STATUSES: ReviewStatus[] = ["not-reviewed", "in-review", "changes-requested", "approved"];
const PUBLISH_CHANNELS: PublishChannel[] = ["none", "instagram", "tiktok", "youtube", "x", "facebook", "linkedin", "website"];

const APPROVER_MAX = 80;
const APPROVAL_NOTES_MAX = 500;

export function isContentStage(value: string): value is ContentStage {
  return CONTENT_STAGES.includes(value as ContentStage);
}

function isReviewStatus(value: string): value is ReviewStatus {
  return REVIEW_STATUSES.includes(value as ReviewStatus);
}

function isPublishChannel(value: string): value is PublishChannel {
  return PUBLISH_CHANNELS.includes(value as PublishChannel);
}

function coerceBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return fallback;
}

function normalizeVersion(value: unknown, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const version = Math.floor(num);
  if (version < 1 || version > 9999) return fallback;
  return version;
}

function toIsoDate(value: unknown): string {
  const text = String(value || "").trim();
  if (!text) return "";
  const dt = new Date(text);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString();
}

function normalizeApprovalHistory(entries: unknown): ApprovalHistoryEntry[] {
  if (!Array.isArray(entries)) return [];

  return entries
    .map((entry) => {
      const candidate = entry as Partial<ApprovalHistoryEntry>;
      const approvedBy = String(candidate.approvedBy || "").trim();
      const approvedAt = toIsoDate(candidate.approvedAt);
      const approvalNotes = String(candidate.approvalNotes || "").trim();
      if (!approvedBy || !approvedAt) return null;
      return {
        id: String(candidate.id || crypto.randomUUID()),
        approvedBy: approvedBy.slice(0, APPROVER_MAX),
        approvedAt,
        approvalNotes: approvalNotes.slice(0, APPROVAL_NOTES_MAX),
      };
    })
    .filter((entry): entry is ApprovalHistoryEntry => Boolean(entry))
    .sort((a, b) => b.approvedAt.localeCompare(a.approvedAt));
}

export function normalizeContentItem(item: Partial<ContentItem>): ContentItem {
  const approvalHistory = normalizeApprovalHistory(item.approvalHistory);
  const topApprovedBy = String(item.approvedBy || "").trim();
  const topApprovedAt = toIsoDate(item.approvedAt);
  const topApprovalNotes = String(item.approvalNotes || "").trim();

  const latest = approvalHistory[0];

  return {
    id: String(item.id || crypto.randomUUID()),
    title: String(item.title || ""),
    stage: isContentStage(String(item.stage || "")) ? (String(item.stage) as ContentStage) : "ideas",
    idea: String(item.idea || ""),
    script: String(item.script || ""),
    attachmentIds: Array.isArray(item.attachmentIds) ? item.attachmentIds.map((id) => String(id).trim()).filter(Boolean) : [],
    reviewer: String(item.reviewer || "").trim(),
    reviewStatus: isReviewStatus(String(item.reviewStatus || "")) ? (String(item.reviewStatus) as ReviewStatus) : "not-reviewed",
    version: normalizeVersion(item.version, 1),
    publishReady: coerceBoolean(item.publishReady, false),
    channel: isPublishChannel(String(item.channel || "")) ? (String(item.channel) as PublishChannel) : "none",
    approvedBy: topApprovedBy || latest?.approvedBy || "",
    approvedAt: topApprovedAt || latest?.approvedAt || "",
    approvalNotes: topApprovalNotes || latest?.approvalNotes || "",
    approvalHistory,
    createdAt: String(item.createdAt || new Date().toISOString()),
    updatedAt: String(item.updatedAt || new Date().toISOString()),
    hook: String(item.hook || ""),
    revisionNotes: String(item.revisionNotes || ""),
    tiktokCaption: item.tiktokCaption ? String(item.tiktokCaption) : undefined,
    igCaption: item.igCaption ? String(item.igCaption) : undefined,
    goalId: item.goalId ? String(item.goalId) : undefined,
    taskId: item.taskId ? String(item.taskId) : undefined,
    contentNumber: item.contentNumber ? Number(item.contentNumber) : undefined,
  };
}

export function parseGovernanceFields(
  input: Partial<ContentItem>,
  current?: Pick<ContentItem, "reviewer" | "reviewStatus" | "version" | "publishReady" | "channel">,
): { value?: Pick<ContentItem, "reviewer" | "reviewStatus" | "version" | "publishReady" | "channel">; error?: string } {
  const reviewer = input.reviewer !== undefined ? String(input.reviewer).trim() : current?.reviewer ?? "";
  const reviewStatusRaw = input.reviewStatus !== undefined ? String(input.reviewStatus).trim() : current?.reviewStatus ?? "not-reviewed";
  const channelRaw = input.channel !== undefined ? String(input.channel).trim() : current?.channel ?? "none";
  const publishReady = input.publishReady !== undefined ? coerceBoolean(input.publishReady, current?.publishReady ?? false) : current?.publishReady ?? false;
  const version = input.version !== undefined ? normalizeVersion(input.version, Number.NaN) : current?.version ?? 1;

  if (reviewer.length > 80) {
    return { error: "Reviewer must be 80 characters or less." };
  }

  if (!isReviewStatus(reviewStatusRaw)) {
    return { error: "Invalid review status." };
  }

  if (!isPublishChannel(channelRaw)) {
    return { error: "Invalid publish channel." };
  }

  if (!Number.isInteger(version) || version < 1 || version > 9999) {
    return { error: "Version must be an integer between 1 and 9999." };
  }

  return {
    value: {
      reviewer,
      reviewStatus: reviewStatusRaw,
      version,
      publishReady,
      channel: channelRaw,
    },
  };
}

export function parseApprovalFields(
  input: {
    approvedBy?: unknown;
    approvedAt?: unknown;
    approvalNotes?: unknown;
    approvalAction?: ApprovalActionInput | null;
  },
  current?: Pick<ContentItem, "approvedBy" | "approvedAt" | "approvalNotes" | "approvalHistory">,
): {
  value?: Pick<ContentItem, "approvedBy" | "approvedAt" | "approvalNotes" | "approvalHistory">;
  error?: string;
} {
  const history = normalizeApprovalHistory(current?.approvalHistory ?? []);

  const directApprovedBy = input.approvedBy !== undefined ? String(input.approvedBy).trim() : undefined;
  const directApprovedAt = input.approvedAt !== undefined ? toIsoDate(input.approvedAt) : undefined;
  const directApprovalNotes = input.approvalNotes !== undefined ? String(input.approvalNotes).trim() : undefined;

  const action = input.approvalAction ?? undefined;
  const actionApprovedBy = action?.approvedBy !== undefined ? String(action.approvedBy).trim() : undefined;
  const actionApprovedAt = action?.approvedAt !== undefined ? toIsoDate(action.approvedAt) : undefined;
  const actionApprovalNotes = action?.approvalNotes !== undefined ? String(action.approvalNotes).trim() : undefined;

  const hasActionInput = Boolean(action) && [actionApprovedBy, actionApprovedAt, actionApprovalNotes].some((v) => v !== undefined);

  const approvedBy = directApprovedBy ?? current?.approvedBy ?? "";
  const approvedAt = directApprovedAt ?? current?.approvedAt ?? "";
  const approvalNotes = directApprovalNotes ?? current?.approvalNotes ?? "";

  if (approvedBy.length > APPROVER_MAX) {
    return { error: `Approved by must be ${APPROVER_MAX} characters or less.` };
  }

  if (approvalNotes.length > APPROVAL_NOTES_MAX) {
    return { error: `Approval notes must be ${APPROVAL_NOTES_MAX} characters or less.` };
  }

  if (directApprovedAt !== undefined && !directApprovedAt && directApprovedBy) {
    return { error: "approvedAt must be a valid date when approvedBy is provided." };
  }

  if (hasActionInput) {
    if (!actionApprovedBy) {
      return { error: "approvalAction.approvedBy is required." };
    }
    if (actionApprovedBy.length > APPROVER_MAX) {
      return { error: `approvalAction.approvedBy must be ${APPROVER_MAX} characters or less.` };
    }

    const approvedAtIso = actionApprovedAt || new Date().toISOString();
    if (!approvedAtIso) {
      return { error: "approvalAction.approvedAt must be a valid date." };
    }

    const notes = (actionApprovalNotes || "").slice(0, APPROVAL_NOTES_MAX);

    history.unshift({
      id: crypto.randomUUID(),
      approvedBy: actionApprovedBy,
      approvedAt: approvedAtIso,
      approvalNotes: notes,
    });

    return {
      value: {
        approvedBy: actionApprovedBy,
        approvedAt: approvedAtIso,
        approvalNotes: notes,
        approvalHistory: history,
      },
    };
  }

  return {
    value: {
      approvedBy,
      approvedAt,
      approvalNotes,
      approvalHistory: history,
    },
  };
}
