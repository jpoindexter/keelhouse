import {
  agentActivityFilterLabel,
  agentActivityMetaLabel,
  agentActivityTimeLabel,
  type AgentActivityEvent,
} from "./agentActivity";
import { runCardIcon } from "./chatThreadHelpers";
import { agentActivityAccessibleLabel, agentActivityIconName, AppIcon } from "./icons";
import { runCardFromActivityEvent } from "./runCards";

type AgentActivityTimelineProps = {
  events: AgentActivityEvent[];
  onReviewFile?: (path: string) => void;
};

function AgentActivityRow({ event, onReviewFile }: { event: AgentActivityEvent; onReviewFile?: (path: string) => void }) {
  const runCard = runCardFromActivityEvent(event);
  return <article
    className={`agent-thread-event agent-thread-event--${event.status}${runCard ? ` agent-thread-event--run-card agent-thread-event--${runCard.kind}` : ""}`}
    data-run-card-kind={runCard?.kind}
    data-run-card-provenance={runCard?.provenance}
  >
    <div className="agent-thread-event__icon">
      <AppIcon name={runCard ? runCardIcon(runCard.kind) : agentActivityIconName(event.status)} label={agentActivityAccessibleLabel(event.status, event.label)} />
    </div>
    <div className="agent-thread-event__body">
      <div className="agent-thread-event__header">
        <strong>{event.label}</strong>
        <span>{agentActivityTimeLabel(event.timestamp)}</span>
        <span>{agentActivityFilterLabel(event.kind)}</span>
      </div>
      {event.detail ? <div className="agent-thread-event__detail">{event.detail}</div> : null}
      {agentActivityMetaLabel(event) ? <div className="agent-thread-event__meta">{agentActivityMetaLabel(event)}</div> : null}
      {runCard?.kind === "file" && runCard.targets[0] ? <button className="agent-thread-event__review" type="button" onClick={() => onReviewFile?.(runCard.targets[0])}><AppIcon name="git" />Review</button> : null}
    </div>
  </article>;
}

export function AgentActivityTimeline({ events, onReviewFile }: AgentActivityTimelineProps) {
  if (events.length === 0) return null;
  return <section className="agent-activity-log" aria-label="App activity timeline">
    <div className="agent-activity-log__list">
      {events.map((event) => <AgentActivityRow event={event} key={event.id} onReviewFile={onReviewFile} />)}
    </div>
  </section>;
}
