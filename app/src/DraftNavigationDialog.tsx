import { DRAFT_NAVIGATION_BODY } from "./draftProtection";

type DraftNavigationDialogProps = {
  fileName: string;
  error: string | null;
  saving: boolean;
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => void;
};

export function DraftNavigationDialog({
  fileName,
  error,
  saving,
  onCancel,
  onDiscard,
  onSave,
}: DraftNavigationDialogProps) {
  return (
    <div className="draft-modal-backdrop" role="presentation">
      <div className="draft-modal" role="dialog" aria-modal="true" aria-labelledby="draft-modal-title">
        <div className="draft-modal__title" id="draft-modal-title">
          Save changes to {fileName}?
        </div>
        <div className="draft-modal__body">{DRAFT_NAVIGATION_BODY}</div>
        {error ? <div className="draft-modal__error">{error}</div> : null}
        <div className="draft-modal__actions">
          <button className="draft-modal__button" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="draft-modal__button draft-modal__button--danger" type="button" onClick={onDiscard}>
            Discard
          </button>
          <button
            className="draft-modal__button draft-modal__button--primary"
            type="button"
            disabled={saving}
            onClick={onSave}
          >
            {saving ? "Saving" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
