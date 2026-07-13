use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::io::{BufRead, BufReader, Write};
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::mpsc::{channel, Sender, TryRecvError};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};

const CHAT_RUN_EVENT: &str = "chat-run-event";

#[derive(Default)]
pub(crate) struct ChatRunState {
    runs: Arc<Mutex<BTreeMap<String, Sender<()>>>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ChatRunRequest {
    run_id: String,
    chat_id: String,
    project_path: String,
    provider: String,
    provider_thread_id: Option<String>,
    prompt: String,
    approval_mode: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ChatRunStarted {
    run_id: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ChatRunEnvelope {
    run_id: String,
    chat_id: String,
    provider: String,
    stream: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    event: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    line: Option<String>,
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn validate_thread_id(value: &str) -> Result<&str, String> {
    if !value.is_empty()
        && value.len() <= 128
        && value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        Ok(value)
    } else {
        Err("The saved Codex thread id is invalid.".into())
    }
}

fn validate_run_id(value: &str) -> Result<&str, String> {
    if !value.is_empty()
        && value.len() <= 128
        && value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        Ok(value)
    } else {
        Err("The chat run id is invalid.".into())
    }
}

fn sandbox_for_approval_mode(mode: &str) -> &'static str {
    match mode {
        "fullAccess" => "danger-full-access",
        "approveSafe" => "workspace-write",
        _ => "read-only",
    }
}

fn codex_command_line(request: &ChatRunRequest) -> Result<String, String> {
    if request.provider != "codex" {
        return Err(format!(
            "Structured chat is not available for {} yet. Open the raw terminal for that provider.",
            request.provider
        ));
    }
    let line = if let Some(thread_id) = request.provider_thread_id.as_deref() {
        let thread_id = validate_thread_id(thread_id)?;
        format!("exec codex exec resume --json {} -", shell_quote(thread_id))
    } else {
        format!(
            "exec codex exec --json --color never -s {} -C {} -",
            shell_quote(sandbox_for_approval_mode(&request.approval_mode)),
            shell_quote(&request.project_path),
        )
    };
    Ok(line)
}

fn emit_line(app: &AppHandle, base: &ChatRunEnvelope, stream: &str, line: String) {
    let parsed = if stream == "stdout" {
        serde_json::from_str::<Value>(&line).ok()
    } else {
        None
    };
    let raw_line = if parsed.is_some() { None } else { Some(line) };
    let _ = app.emit(
        CHAT_RUN_EVENT,
        ChatRunEnvelope {
            stream: stream.into(),
            event: parsed,
            line: raw_line,
            ..base.clone()
        },
    );
}

#[tauri::command]
pub(crate) fn start_chat_run(
    app: AppHandle,
    state: State<ChatRunState>,
    request: ChatRunRequest,
) -> Result<ChatRunStarted, String> {
    let project = Path::new(request.project_path.trim());
    if !project.is_dir() {
        return Err(format!(
            "Chat workspace does not exist: {}",
            request.project_path
        ));
    }
    let prompt = request.prompt.trim().to_string();
    if prompt.is_empty() {
        return Err("Chat prompt is empty.".into());
    }
    let command_line = codex_command_line(&request)?;
    let run_id = validate_run_id(request.run_id.trim())?.to_string();
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
    let mut command = Command::new(&shell);
    command
        .arg("-l")
        .arg("-c")
        .arg(command_line)
        .current_dir(project)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = command
        .spawn()
        .map_err(|error| format!("Could not launch structured Codex chat: {error}"))?;
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(prompt.as_bytes())
            .and_then(|_| stdin.flush())
            .map_err(|error| format!("Could not send the chat prompt to Codex: {error}"))?;
    }
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Could not read structured Codex output.".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Could not read Codex diagnostics.".to_string())?;
    let base = ChatRunEnvelope {
        run_id: run_id.clone(),
        chat_id: request.chat_id,
        provider: request.provider,
        stream: "lifecycle".into(),
        event: None,
        line: None,
    };
    let (stop_tx, stop_rx) = channel::<()>();
    state
        .runs
        .lock()
        .map_err(|_| "Could not register the chat run.".to_string())?
        .insert(run_id.clone(), stop_tx);

    let stdout_app = app.clone();
    let stdout_base = base.clone();
    let stdout_thread = std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            emit_line(&stdout_app, &stdout_base, "stdout", line);
        }
    });
    let stderr_app = app.clone();
    let stderr_base = base.clone();
    let stderr_thread = std::thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            emit_line(&stderr_app, &stderr_base, "stderr", line);
        }
    });
    let runs = state.runs.clone();
    std::thread::spawn(move || {
        let mut stopped = false;
        let exit_code = loop {
            match stop_rx.try_recv() {
                Ok(()) => {
                    stopped = true;
                    let _ = child.kill();
                }
                Err(TryRecvError::Disconnected) => {}
                Err(TryRecvError::Empty) => {}
            }
            match child.try_wait() {
                Ok(Some(status)) => break status.code().unwrap_or(if stopped { 130 } else { 1 }),
                Ok(None) => std::thread::sleep(Duration::from_millis(50)),
                Err(_) => {
                    let _ = child.kill();
                    break child
                        .wait()
                        .ok()
                        .and_then(|status| status.code())
                        .unwrap_or(if stopped { 130 } else { 1 });
                }
            }
        };
        let _ = stdout_thread.join();
        let _ = stderr_thread.join();
        if let Ok(mut active) = runs.lock() {
            active.remove(&base.run_id);
        }
        let _ = app.emit(
            CHAT_RUN_EVENT,
            ChatRunEnvelope {
                stream: "lifecycle".into(),
                event: Some(json!({
                    "type": "run.completed",
                    "exitCode": exit_code,
                    "message": if stopped { "Codex run stopped." } else { "Codex chat process exited." },
                })),
                ..base
            },
        );
    });

    Ok(ChatRunStarted { run_id })
}

#[tauri::command]
pub(crate) fn stop_chat_run(state: State<ChatRunState>, run_id: String) -> Result<(), String> {
    let runs = state
        .runs
        .lock()
        .map_err(|_| "Could not access active chat runs.".to_string())?;
    let stop = runs
        .get(&run_id)
        .ok_or_else(|| format!("Chat run {run_id} is no longer active."))?;
    stop.send(())
        .map_err(|_| format!("Could not stop chat run {run_id}."))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(thread: Option<&str>, mode: &str) -> ChatRunRequest {
        ChatRunRequest {
            run_id: "chat-run-test".into(),
            chat_id: "chat".into(),
            project_path: "/tmp/repo with spaces".into(),
            provider: "codex".into(),
            provider_thread_id: thread.map(str::to_string),
            prompt: "hello".into(),
            approval_mode: mode.into(),
        }
    }

    #[test]
    fn starts_new_codex_chats_with_json_and_scoped_sandbox() {
        let line = codex_command_line(&request(None, "approveSafe")).unwrap();
        assert_eq!(
            line,
            "exec codex exec --json --color never -s 'workspace-write' -C '/tmp/repo with spaces' -"
        );
    }

    #[test]
    fn resumes_only_valid_provider_thread_ids() {
        assert_eq!(
            codex_command_line(&request(
                Some("019f5a64-56ac-7e73-b554-138e0e8352b4"),
                "ask"
            ))
            .unwrap(),
            "exec codex exec resume --json '019f5a64-56ac-7e73-b554-138e0e8352b4' -"
        );
        assert!(codex_command_line(&request(Some("bad; rm -rf"), "ask")).is_err());
    }
}
