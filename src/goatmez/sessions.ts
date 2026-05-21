import type {
  GoatmezApprovalRecord,
  GoatmezMissionRecord,
  GoatmezSessionRecord,
  GoatmezSessionTimelineEvent,
  GoatmezTaskRecord
} from "./types.js";

function event(input: Omit<GoatmezSessionTimelineEvent, "id"> & { id: string }): GoatmezSessionTimelineEvent {
  return input;
}

export function buildSessionTimeline(input: {
  session: GoatmezSessionRecord;
  mission?: GoatmezMissionRecord;
  task?: GoatmezTaskRecord;
  approvals: GoatmezApprovalRecord[];
}): GoatmezSessionTimelineEvent[] {
  const events: GoatmezSessionTimelineEvent[] = [
    event({
      id: `${input.session.id}:session-started`,
      type: "session.started",
      status: input.session.status,
      title: "Session started",
      timestamp: input.session.createdAt,
      details: {
        sessionId: input.session.id,
        missionId: input.session.missionId,
        message: input.session.message
      }
    })
  ];

  if (input.mission) {
    events.push(event({
      id: `${input.mission.id}:mission-created`,
      type: "mission.created",
      status: input.mission.status,
      title: "Mission created",
      timestamp: input.mission.createdAt,
      details: {
        missionId: input.mission.id,
        planner: input.mission.planner,
        taskId: input.mission.taskId || null
      }
    }));
  }

  if (input.task) {
    events.push(event({
      id: `${input.task.id}:task-created`,
      type: "task.created",
      status: input.task.status,
      title: input.task.title,
      timestamp: input.task.createdAt,
      details: {
        taskId: input.task.id,
        notes: input.task.notes.slice(0, 3)
      }
    }));
  }

  for (const approval of input.approvals) {
    events.push(event({
      id: `${approval.id}:approval-requested`,
      type: "approval.requested",
      status: approval.status,
      title: approval.toolName,
      timestamp: approval.createdAt,
      details: {
        approvalId: approval.id,
        reason: approval.reason,
        input: approval.input
      }
    }));
    if (approval.updatedAt !== approval.createdAt) {
      events.push(event({
        id: `${approval.id}:approval-updated`,
        type: "approval.updated",
        status: approval.status,
        title: approval.toolName,
        timestamp: approval.updatedAt,
        details: {
          approvalId: approval.id,
          status: approval.status
        }
      }));
    }
  }

  events.push(event({
    id: `${input.session.id}:session-completed`,
    type: "session.completed",
    status: input.session.status,
    title: "Session completed",
    timestamp: input.session.completedAt || input.session.updatedAt,
    details: {
      toolCalls: input.session.toolCalls,
      approvals: input.session.approvals,
      summaryPreview: (input.session.summary || "").slice(0, 240)
    }
  }));

  return events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
