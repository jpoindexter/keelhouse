import { agentActivityFilterLabel, agentActivityMetaLabel, agentActivityTimeLabel } from "./agentActivity";
import type { AgentActivityEvent } from "./agentActivity";
import { agentActivityAccessibleLabel, agentActivityIconName, AppIcon } from "./icons";
import { AgentRunOutput } from "./AgentRunOutput";

type AgentRunSurfaceProps = {
  events: AgentActivityEvent[];
  hasPane: boolean;
  hidden?: boolean;
  metaLabel?: string;
  transcript: string;
};

export function AgentRunSurface({
  events,
  hasPane,
  hidden = false,
  metaLabel,
  transcript,
}: AgentRunSurfaceProps) {
  return (
    <div className="agent-chat-surface" aria-hidden={hidden}>
      <AgentRunOutput hasPane={hasPane} metaLabel={metaLabel} transcript={transcript} />
      {events.length > 0 ? <section className="agent-activity-log" aria-label="Agent activity timeline">
        <div className="agent-activity-log__list">
          {events.map((event) => (
            <article className={`agent-thread-event agent-thread-event--${event.status}`} key={event.id}>
              <div className="agent-thread-event__icon">
                <AppIcon name={agentActivityIconName(event.status)} label={agentActivityAccessibleLabel(event.status, event.label)} />
              </div>
              <div className="agent-thread-event__body">
                <div className="agent-thread-event__header">
                  <strong>{event.label}</strong>
                  <span>{agentActivityTimeLabel(event.timestamp)}</span>
                  <span>{agentActivityFilterLabel(event.kind)}</span>
                </div>
                {event.detail ? <div className="agent-thread-event__detail">{event.detail}</div> : null}
                {agentActivityMetaLabel(event) ? <div className="agent-thread-event__meta">{agentActivityMetaLabel(event)}</div> : null}
              </div>
            </article>
          ))}
        </div>
      </section> : null}
    </div>
  );
}
