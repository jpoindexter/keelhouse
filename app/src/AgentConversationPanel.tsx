import { AgentComposerSurface, type AgentComposerSurfaceProps } from "./AgentComposerSurface";
import { ChatThreadSurface, type ChatThreadSurfaceProps } from "./ChatThreadSurface";
import type { AgentSurfaceMode } from "./useShellLayout";

export type AgentConversationPanelProps = {
  chat: ChatThreadSurfaceProps;
  composer: AgentComposerSurfaceProps;
  surfaceMode: AgentSurfaceMode;
};

export const AgentConversationPanel = (props: AgentConversationPanelProps) => (
  <section
    className={`terminal-panel terminal-panel--${props.surfaceMode}`}
    aria-label="Agent conversation"
  >
    <div className={`agent-surface agent-surface--${props.surfaceMode}`}>
      <ChatThreadSurface {...props.chat} />
    </div>
    <AgentComposerSurface {...props.composer} />
  </section>
);
