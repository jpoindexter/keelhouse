import { gitStatusLabel, type GitStatusFile } from "./fileGitStatus";
import { AppIcon } from "./icons";

const basename = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path;

export type SourceControlSummary = {
  isRepository: boolean;
  branch: string | null;
  ahead: number;
  behind: number;
  staged: number;
  untracked: number;
  files: GitStatusFile[];
};

type SourceControlDrawerProps = {
  error: string | null;
  hasWorkspace: boolean;
  loading: boolean;
  status: SourceControlSummary | null;
  onOpenDiff: (file: GitStatusFile) => void;
  onRefresh: () => void;
};

const SourceControlSummaryView = ({ status }: { status: SourceControlSummary }) => (
  <div className="drawer-summary">
    <div><span>Branch</span><strong>{status.branch ?? "Detached"}</strong></div>
    <div><span>Changes</span><strong>{status.files.length}</strong></div>
    <div><span>Staged</span><strong>{status.staged}</strong></div>
    <div><span>Untracked</span><strong>{status.untracked}</strong></div>
    {status.ahead > 0 || status.behind > 0 ? <div><span>Remote</span><strong>{`+${status.ahead} / -${status.behind}`}</strong></div> : null}
  </div>
);

const SourceControlFiles = ({ files, onOpenDiff }: Pick<SourceControlDrawerProps, "onOpenDiff"> & { files: GitStatusFile[] }) => (
  <div className="drawer-list">
    {files.length === 0 ? <div className="rail-status">Working tree clean</div> : null}
    {files.map((file) => (
      <button className="drawer-list-row" type="button" key={`${file.index}${file.worktree}${file.path}`} title={`${gitStatusLabel(file)} · ${file.path}`} onClick={() => onOpenDiff(file)}>
        <AppIcon name={file.index === "?" ? "filePlus" : "git"} />
        <span className="drawer-list-row__main">{basename(file.path)}</span>
        <span className="drawer-list-row__meta">{gitStatusLabel(file)} · Review diff</span>
      </button>
    ))}
  </div>
);

export const SourceControlDrawer = (props: SourceControlDrawerProps) => (
  <section className="drawer-panel" aria-label="Source control">
    <div className="panel-title panel-title--with-action">
      <span>Source Control</span>
      <button className="rail-open-button" type="button" disabled={!props.hasWorkspace || props.loading} onClick={props.onRefresh}><AppIcon name="reload" /><span>Refresh</span></button>
    </div>
    {props.loading ? <div className="rail-status">Reading git status…</div> : null}
    {props.error ? <div className="rail-status rail-status--error">{props.error}</div> : null}
    {!props.hasWorkspace ? <div className="rail-status">Open a folder to read source control</div> : null}
    {props.hasWorkspace && props.status?.isRepository === false ? <div className="rail-status">This workspace is not a Git repository</div> : null}
    {props.status?.isRepository ? <><SourceControlSummaryView status={props.status} /><SourceControlFiles files={props.status.files} onOpenDiff={props.onOpenDiff} /></> : null}
  </section>
);
