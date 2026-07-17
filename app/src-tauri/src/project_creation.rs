use serde::Serialize;
use std::fs;
use std::path::Path;
use std::process::Command;

const MAX_PROJECT_NAME_CHARS: usize = 80;

#[derive(Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatedLocalProject {
    pub path: String,
}

fn validate_project_name(name: &str) -> Result<&str, String> {
    let trimmed = name.trim();
    let invalid_segment = trimmed == "." || trimmed == ".." || trimmed == ".git";
    let invalid_character = trimmed
        .chars()
        .any(|character| character.is_control() || matches!(character, '/' | '\\'));
    if trimmed.is_empty() {
        return Err("Enter a project name.".into());
    }
    if trimmed.chars().count() > MAX_PROJECT_NAME_CHARS {
        return Err(format!(
            "Project names can use at most {MAX_PROJECT_NAME_CHARS} characters."
        ));
    }
    if invalid_segment || invalid_character {
        return Err("Use a folder name without path separators or reserved names.".into());
    }
    Ok(trimmed)
}

#[tauri::command]
pub fn create_local_project(parent: String, name: String) -> Result<CreatedLocalProject, String> {
    let name = validate_project_name(&name)?;
    let parent = fs::canonicalize(&parent)
        .map_err(|error| format!("Could not open the parent folder: {error}"))?;
    if !parent.is_dir() {
        return Err("Choose a parent folder for the new project.".into());
    }
    let target = parent.join(name);
    if target.exists() {
        return Err(format!("A file or folder named {name} already exists."));
    }
    fs::create_dir(&target).map_err(|error| format!("Could not create {name}: {error}"))?;
    let target = fs::canonicalize(&target)
        .map_err(|error| format!("Could not resolve the new project folder: {error}"))?;
    Ok(CreatedLocalProject {
        path: target.to_string_lossy().into_owned(),
    })
}

#[tauri::command]
pub fn initialize_project_git(path: String) -> Result<(), String> {
    initialize_project_git_with(&path, "git")
}

pub(crate) fn initialize_project_git_with(path: &str, binary: &str) -> Result<(), String> {
    let root = fs::canonicalize(path)
        .map_err(|error| format!("Could not open the project folder: {error}"))?;
    if !root.is_dir() {
        return Err("The project path is not a folder.".into());
    }
    let output = Command::new(binary)
        .arg("-C")
        .arg(Path::new(&root))
        .args(["init", "--quiet"])
        .output()
        .map_err(|error| format!("Could not start Git: {error}"))?;
    if output.status.success() {
        return Ok(());
    }
    let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(if detail.is_empty() {
        "Git could not initialize this project.".into()
    } else {
        format!("Git could not initialize this project: {detail}")
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_root(prefix: &str) -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        std::env::temp_dir().join(format!("{prefix}-{suffix}"))
    }

    #[test]
    fn project_creation_creates_a_named_directory() {
        let parent = temp_root("project-create-parent");
        fs::create_dir_all(&parent).expect("create project parent");
        let created =
            create_local_project(parent.to_string_lossy().into_owned(), "Keel Demo".into())
                .expect("create local project");
        assert_eq!(
            Path::new(&created.path),
            fs::canonicalize(parent.join("Keel Demo")).expect("canonical project path")
        );
        assert!(Path::new(&created.path).is_dir());
        let _ = fs::remove_dir_all(parent);
    }

    #[test]
    fn project_creation_rejects_unsafe_or_existing_names() {
        let parent = temp_root("project-create-validation");
        fs::create_dir_all(parent.join("existing")).expect("create existing project");
        let parent_s = parent.to_string_lossy().into_owned();
        assert!(create_local_project(parent_s.clone(), "../escape".into()).is_err());
        assert!(create_local_project(parent_s.clone(), "nested/name".into()).is_err());
        assert!(create_local_project(parent_s, "existing".into()).is_err());
        let _ = fs::remove_dir_all(parent);
    }

    #[test]
    fn project_creation_initializes_git_without_shelling() {
        let parent = temp_root("project-create-git");
        fs::create_dir_all(&parent).expect("create project parent");
        let created = create_local_project(parent.to_string_lossy().into_owned(), "repo".into())
            .expect("create local project");
        initialize_project_git(created.path.clone()).expect("initialize git");
        assert!(Path::new(&created.path).join(".git").is_dir());
        let _ = fs::remove_dir_all(parent);
    }

    #[test]
    fn project_creation_keeps_the_folder_when_git_initialization_fails() {
        let parent = temp_root("project-create-git-failure");
        fs::create_dir_all(&parent).expect("create project parent");
        let created = create_local_project(parent.to_string_lossy().into_owned(), "repo".into())
            .expect("create local project");
        let result = initialize_project_git_with(&created.path, "definitely-not-a-git-binary");
        assert!(result.is_err());
        assert!(Path::new(&created.path).is_dir());
        let _ = fs::remove_dir_all(parent);
    }
}
