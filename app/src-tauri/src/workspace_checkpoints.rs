use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

const MAX_CHECKPOINT_FILE_BYTES: u64 = 20 * 1024 * 1024;
const MAX_CHECKPOINT_TOTAL_BYTES: u64 = 100 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceCheckpointSummary {
    id: String,
    label: String,
    created_at: i64,
    base_commit: String,
    file_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CheckpointFile {
    path: String,
    content_base64: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CheckpointManifest {
    summary: WorkspaceCheckpointSummary,
    workspace_root: String,
    files: Vec<CheckpointFile>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceCheckpointPreviewFile {
    path: String,
    action: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceCheckpointPreview {
    checkpoint: WorkspaceCheckpointSummary,
    files: Vec<WorkspaceCheckpointPreviewFile>,
    preview_token: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceCheckpointRestoreResult {
    checkpoint_id: String,
    recovery_checkpoint_id: String,
    restored_files: usize,
}

fn command_output(root: &Path, args: &[&str], label: &str) -> Result<Vec<u8>, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(root)
        .args(args)
        .output()
        .map_err(|error| format!("Could not {label}: {error}"))?;
    if output.status.success() {
        Ok(output.stdout)
    } else {
        Err(format!(
            "Could not {label}: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ))
    }
}

fn canonical_workspace(root: &str) -> Result<PathBuf, String> {
    let root = fs::canonicalize(root.trim())
        .map_err(|error| format!("Could not open checkpoint workspace: {error}"))?;
    if !root.is_dir() {
        return Err("Checkpoint workspace must be a folder.".into());
    }
    command_output(
        &root,
        &["rev-parse", "--is-inside-work-tree"],
        "verify Git workspace",
    )?;
    Ok(root)
}

fn base_commit(root: &Path) -> Result<String, String> {
    let output = command_output(root, &["rev-parse", "HEAD"], "read checkpoint base commit")?;
    let commit = String::from_utf8_lossy(&output).trim().to_string();
    if commit.is_empty() {
        Err("Checkpoint requires a committed Git base.".into())
    } else {
        Ok(commit)
    }
}

fn validate_relative_path(path: &str) -> Result<String, String> {
    let path = Path::new(path);
    if path.is_absolute()
        || path
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err("Checkpoint path must stay inside the workspace.".into());
    }
    let normalized = path.to_string_lossy().into_owned();
    if normalized.is_empty() {
        Err("Checkpoint path is empty.".into())
    } else {
        Ok(normalized)
    }
}

fn nul_field(bytes: &[u8], start: usize) -> Result<(&[u8], usize), String> {
    let end = bytes[start..]
        .iter()
        .position(|byte| *byte == 0)
        .map(|offset| start + offset)
        .ok_or_else(|| "Git status returned a malformed path record.".to_string())?;
    Ok((&bytes[start..end], end + 1))
}

fn changed_paths(root: &Path) -> Result<BTreeSet<String>, String> {
    let output = command_output(
        root,
        &["status", "--porcelain=v1", "-z", "--untracked-files=all"],
        "read checkpoint workspace changes",
    )?;
    let mut paths = BTreeSet::new();
    let mut cursor = 0usize;
    while cursor < output.len() {
        if output.len().saturating_sub(cursor) < 4 || output[cursor + 2] != b' ' {
            return Err("Git status returned a malformed change record.".into());
        }
        let renamed =
            matches!(output[cursor], b'R' | b'C') || matches!(output[cursor + 1], b'R' | b'C');
        let (path, next) = nul_field(&output, cursor + 3)?;
        let path = std::str::from_utf8(path)
            .map_err(|_| "Checkpoint paths must be valid UTF-8.".to_string())?;
        paths.insert(validate_relative_path(path)?);
        cursor = next;
        if renamed {
            let (original, next) = nul_field(&output, cursor)?;
            let original = std::str::from_utf8(original)
                .map_err(|_| "Checkpoint paths must be valid UTF-8.".to_string())?;
            paths.insert(validate_relative_path(original)?);
            cursor = next;
        }
    }
    Ok(paths)
}

fn read_workspace_file(root: &Path, relative: &str) -> Result<Option<Vec<u8>>, String> {
    let path = root.join(validate_relative_path(relative)?);
    match fs::symlink_metadata(&path) {
        Ok(metadata) if metadata.file_type().is_symlink() => Err(format!(
            "Checkpoint does not support symbolic links: {relative}"
        )),
        Ok(metadata) if metadata.is_file() => {
            if metadata.len() > MAX_CHECKPOINT_FILE_BYTES {
                return Err(format!("Checkpoint file is too large: {relative}"));
            }
            fs::read(&path)
                .map(Some)
                .map_err(|error| format!("Could not read checkpoint file {relative}: {error}"))
        }
        Ok(metadata) if metadata.is_dir() => Err(format!(
            "Checkpoint does not support directories or submodules: {relative}"
        )),
        Ok(_) => Err(format!("Checkpoint path is not a regular file: {relative}")),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!(
            "Could not inspect checkpoint file {relative}: {error}"
        )),
    }
}

fn read_base_file(root: &Path, commit: &str, relative: &str) -> Result<Option<Vec<u8>>, String> {
    let spec = format!("{commit}:{relative}");
    let output = Command::new("git")
        .arg("-C")
        .arg(root)
        .args(["show", &spec])
        .output()
        .map_err(|error| format!("Could not read base file {relative}: {error}"))?;
    if output.status.success() {
        Ok(Some(output.stdout))
    } else {
        Ok(None)
    }
}

fn private_checkpoint_dir(root: &Path) -> Result<(), String> {
    fs::create_dir_all(root)
        .map_err(|error| format!("Could not create checkpoint storage: {error}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(root, fs::Permissions::from_mode(0o700))
            .map_err(|error| format!("Could not protect checkpoint storage: {error}"))?;
    }
    Ok(())
}

fn save_manifest(directory: &Path, manifest: &CheckpointManifest) -> Result<(), String> {
    private_checkpoint_dir(directory)?;
    let path = directory.join(format!("{}.json", manifest.summary.id));
    let bytes = serde_json::to_vec(manifest)
        .map_err(|error| format!("Could not encode checkpoint: {error}"))?;
    fs::write(&path, bytes).map_err(|error| format!("Could not save checkpoint: {error}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600))
            .map_err(|error| format!("Could not protect checkpoint: {error}"))?;
    }
    Ok(())
}

fn create_checkpoint_in(
    directory: &Path,
    root: &Path,
    label: &str,
) -> Result<WorkspaceCheckpointSummary, String> {
    let root = canonical_workspace(root.to_string_lossy().as_ref())?;
    let base_commit = base_commit(&root)?;
    let created_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;
    let paths = changed_paths(&root)?;
    let mut total = 0u64;
    let mut files = Vec::with_capacity(paths.len());
    for path in paths {
        let content = read_workspace_file(&root, &path)?;
        total = total.saturating_add(content.as_ref().map_or(0, |bytes| bytes.len() as u64));
        if total > MAX_CHECKPOINT_TOTAL_BYTES {
            return Err("Checkpoint exceeds the 100 MiB safety limit.".into());
        }
        files.push(CheckpointFile {
            path,
            content_base64: content.map(|bytes| BASE64.encode(bytes)),
        });
    }
    let label = label.trim().chars().take(120).collect::<String>();
    let mut hasher = Sha256::new();
    hasher.update(root.to_string_lossy().as_bytes());
    hasher.update(base_commit.as_bytes());
    hasher.update(created_at.to_le_bytes());
    hasher.update(label.as_bytes());
    let id = format!("checkpoint-{}", &format!("{:x}", hasher.finalize())[..16]);
    let summary = WorkspaceCheckpointSummary {
        id,
        label: if label.is_empty() {
            "Workspace checkpoint".into()
        } else {
            label
        },
        created_at,
        base_commit,
        file_count: files.len(),
    };
    save_manifest(
        directory,
        &CheckpointManifest {
            summary: summary.clone(),
            workspace_root: root.to_string_lossy().into_owned(),
            files,
        },
    )?;
    Ok(summary)
}

fn load_manifest(directory: &Path, checkpoint_id: &str) -> Result<CheckpointManifest, String> {
    if !checkpoint_id.starts_with("checkpoint-")
        || !checkpoint_id
            .chars()
            .all(|value| value.is_ascii_alphanumeric() || value == '-')
    {
        return Err("Checkpoint id is invalid.".into());
    }
    let bytes = fs::read(directory.join(format!("{checkpoint_id}.json")))
        .map_err(|error| format!("Could not open checkpoint: {error}"))?;
    serde_json::from_slice(&bytes).map_err(|error| format!("Could not decode checkpoint: {error}"))
}

fn target_files(
    manifest: &CheckpointManifest,
    root: &Path,
) -> Result<BTreeMap<String, Option<Vec<u8>>>, String> {
    let mut target = manifest
        .files
        .iter()
        .map(|file| {
            let content = file
                .content_base64
                .as_ref()
                .map(|value| {
                    BASE64.decode(value).map_err(|error| {
                        format!("Could not decode checkpoint file {}: {error}", file.path)
                    })
                })
                .transpose()?;
            Ok((file.path.clone(), content))
        })
        .collect::<Result<BTreeMap<_, _>, String>>()?;
    for path in changed_paths(root)? {
        if !target.contains_key(&path) {
            target.insert(
                path.clone(),
                read_base_file(root, &manifest.summary.base_commit, &path)?,
            );
        }
    }
    Ok(target)
}

fn preview_in(
    directory: &Path,
    root: &Path,
    checkpoint_id: &str,
) -> Result<WorkspaceCheckpointPreview, String> {
    let root = canonical_workspace(root.to_string_lossy().as_ref())?;
    let manifest = load_manifest(directory, checkpoint_id)?;
    if manifest.workspace_root != root.to_string_lossy() {
        return Err("Checkpoint belongs to a different workspace.".into());
    }
    if base_commit(&root)? != manifest.summary.base_commit {
        return Err("Workspace HEAD changed since this checkpoint; create a new checkpoint before restoring.".into());
    }
    let mut hasher = Sha256::new();
    hasher.update(manifest.summary.id.as_bytes());
    let mut files = Vec::new();
    for (path, target) in target_files(&manifest, &root)? {
        let current = read_workspace_file(&root, &path)?;
        hasher.update(path.as_bytes());
        hasher.update(current.as_deref().unwrap_or_default());
        hasher.update([u8::from(current.is_some())]);
        if current != target {
            files.push(WorkspaceCheckpointPreviewFile {
                path,
                action: if target.is_some() {
                    "write".into()
                } else {
                    "delete".into()
                },
            });
        }
    }
    Ok(WorkspaceCheckpointPreview {
        checkpoint: manifest.summary,
        files,
        preview_token: format!("{:x}", hasher.finalize()),
    })
}

fn write_target(root: &Path, relative: &str, content: Option<&[u8]>) -> Result<(), String> {
    let path = root.join(validate_relative_path(relative)?);
    if let Some(content) = content {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Could not create restore folder: {error}"))?;
        }
        let temporary = path.with_extension(format!("keelhouse-restore-{}", std::process::id()));
        fs::write(&temporary, content)
            .map_err(|error| format!("Could not stage restored file {relative}: {error}"))?;
        fs::rename(&temporary, &path)
            .map_err(|error| format!("Could not restore file {relative}: {error}"))?;
    } else if path.is_file() {
        fs::remove_file(&path)
            .map_err(|error| format!("Could not remove restored file {relative}: {error}"))?;
    }
    Ok(())
}

fn checkpoint_directory(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("workspace-checkpoints"))
        .map_err(|error| format!("Could not locate checkpoint storage: {error}"))
}

fn restore_in(
    directory: &Path,
    root: &Path,
    checkpoint_id: &str,
    preview_token: &str,
    dirty_paths: &[String],
) -> Result<WorkspaceCheckpointRestoreResult, String> {
    let root = canonical_workspace(root.to_string_lossy().as_ref())?;
    let preview = preview_in(directory, &root, checkpoint_id)?;
    if preview.preview_token != preview_token {
        return Err("Workspace changed after preview; preview the checkpoint again.".into());
    }
    let affected = preview
        .files
        .iter()
        .map(|file| file.path.as_str())
        .collect::<BTreeSet<_>>();
    if let Some(path) = dirty_paths
        .iter()
        .find(|path| affected.contains(path.as_str()))
    {
        return Err(format!(
            "Save or discard the dirty editor buffer before restore: {path}"
        ));
    }
    let recovery = create_checkpoint_in(directory, &root, "Recovery before checkpoint restore")?;
    let manifest = load_manifest(directory, checkpoint_id)?;
    let targets = target_files(&manifest, &root)?;
    for file in &preview.files {
        write_target(
            &root,
            &file.path,
            targets
                .get(&file.path)
                .and_then(|content| content.as_deref()),
        )?;
    }
    Ok(WorkspaceCheckpointRestoreResult {
        checkpoint_id: checkpoint_id.into(),
        recovery_checkpoint_id: recovery.id,
        restored_files: preview.files.len(),
    })
}

#[tauri::command]
pub(crate) fn create_workspace_checkpoint(
    app: AppHandle,
    root: String,
    label: String,
) -> Result<WorkspaceCheckpointSummary, String> {
    create_checkpoint_in(&checkpoint_directory(&app)?, Path::new(&root), &label)
}

#[tauri::command]
pub(crate) fn preview_workspace_checkpoint(
    app: AppHandle,
    root: String,
    checkpoint_id: String,
) -> Result<WorkspaceCheckpointPreview, String> {
    preview_in(
        &checkpoint_directory(&app)?,
        Path::new(&root),
        &checkpoint_id,
    )
}

#[tauri::command]
pub(crate) fn restore_workspace_checkpoint(
    app: AppHandle,
    root: String,
    checkpoint_id: String,
    preview_token: String,
    dirty_paths: Vec<String>,
) -> Result<WorkspaceCheckpointRestoreResult, String> {
    let directory = checkpoint_directory(&app)?;
    restore_in(
        &directory,
        Path::new(&root),
        &checkpoint_id,
        &preview_token,
        &dirty_paths,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(root: &Path, args: &[&str]) {
        let output = Command::new("git")
            .arg("-C")
            .arg(root)
            .args(args)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    fn fixture() -> (PathBuf, PathBuf) {
        let fixture_id = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("keelhouse-checkpoint-{fixture_id}"));
        let store = std::env::temp_dir().join(format!("keelhouse-checkpoint-store-{fixture_id}"));
        fs::create_dir_all(&root).unwrap();
        run(&root, &["init", "-q"]);
        run(&root, &["config", "user.email", "test@example.com"]);
        run(&root, &["config", "user.name", "Keelhouse Test"]);
        fs::write(root.join("tracked.txt"), b"base\n").unwrap();
        run(&root, &["add", "tracked.txt"]);
        run(&root, &["commit", "-qm", "base"]);
        (root, store)
    }

    fn index_tree(root: &Path) -> Vec<u8> {
        command_output(root, &["write-tree"], "read index tree").unwrap()
    }

    #[test]
    fn capture_and_restore_never_mutate_the_index() {
        let (root, store) = fixture();
        fs::write(root.join("tracked.txt"), b"checkpoint\n").unwrap();
        fs::write(root.join("new.txt"), b"new\n").unwrap();
        run(&root, &["add", "tracked.txt"]);
        let index_before = index_tree(&root);
        let checkpoint = create_checkpoint_in(&store, &root, "Fork state").unwrap();
        assert_eq!(index_tree(&root), index_before);

        fs::write(root.join("tracked.txt"), b"later\n").unwrap();
        fs::remove_file(root.join("new.txt")).unwrap();
        fs::write(root.join("later.txt"), b"later\n").unwrap();
        let preview = preview_in(&store, &root, &checkpoint.id).unwrap();
        assert_eq!(preview.files.len(), 3);
        let restored =
            restore_in(&store, &root, &checkpoint.id, &preview.preview_token, &[]).unwrap();
        assert!(!restored.recovery_checkpoint_id.is_empty());
        assert!(store
            .join(format!("{}.json", restored.recovery_checkpoint_id))
            .is_file());
        assert_eq!(fs::read(root.join("tracked.txt")).unwrap(), b"checkpoint\n");
        assert_eq!(fs::read(root.join("new.txt")).unwrap(), b"new\n");
        assert!(!root.join("later.txt").exists());
        assert_eq!(index_tree(&root), index_before);
        let _ = fs::remove_dir_all(root);
        let _ = fs::remove_dir_all(store);
    }

    #[test]
    fn preview_token_changes_with_disk_and_dirty_paths_can_be_detected() {
        let (root, store) = fixture();
        fs::write(root.join("tracked.txt"), b"checkpoint\n").unwrap();
        let checkpoint = create_checkpoint_in(&store, &root, "Fork state").unwrap();
        fs::write(root.join("tracked.txt"), b"later\n").unwrap();
        let first = preview_in(&store, &root, &checkpoint.id).unwrap();
        fs::write(root.join("tracked.txt"), b"changed again\n").unwrap();
        let second = preview_in(&store, &root, &checkpoint.id).unwrap();
        assert_ne!(first.preview_token, second.preview_token);
        assert!(second.files.iter().any(|file| file.path == "tracked.txt"));
        assert!(
            restore_in(&store, &root, &checkpoint.id, &first.preview_token, &[])
                .unwrap_err()
                .contains("changed after preview")
        );
        assert!(restore_in(
            &store,
            &root,
            &checkpoint.id,
            &second.preview_token,
            &["tracked.txt".into()],
        )
        .unwrap_err()
        .contains("dirty editor buffer"));
        assert_eq!(
            fs::read(root.join("tracked.txt")).unwrap(),
            b"changed again\n"
        );
        let _ = fs::remove_dir_all(root);
        let _ = fs::remove_dir_all(store);
    }
}
