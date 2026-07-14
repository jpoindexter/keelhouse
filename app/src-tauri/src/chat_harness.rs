use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::io::{BufRead, BufReader, Write};
#[cfg(unix)]
use std::os::unix::process::CommandExt;
use std::path::Path;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{channel, RecvTimeoutError, Sender, TryRecvError};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, State};

use crate::claude_adapter::{
    approval_response as claude_approval_response, command_args as claude_command_args,
    user_message as claude_user_message, validate_claude_capabilities, ClaudeAdapterOutput,
    ClaudeApprovalRequest, ClaudeStreamAdapter,
};
use crate::connection_secrets::{resolve_connection_environment, ConnectionEnvironmentInput};

const CHAT_RUN_EVENT: &str = "chat-run-event";
const APPROVAL_TIMEOUT_MS: u64 = 5 * 60 * 1000;

#[derive(Clone, Debug, PartialEq)]
struct PendingApproval {
    method: String,
    requested_at_ms: u64,
    claude_request: Option<ClaudeApprovalRequest>,
}

struct ChatRunControl {
    base: ChatRunEnvelope,
    stdin: Arc<Mutex<ChildStdin>>,
    stop: Sender<()>,
    thread_id: Arc<Mutex<Option<String>>>,
    turn_id: Arc<Mutex<Option<String>>>,
    pending_approvals: Arc<Mutex<BTreeMap<u64, PendingApproval>>>,
    next_request_id: AtomicU64,
}

#[derive(Default)]
pub(crate) struct ChatRunState {
    runs: Arc<Mutex<BTreeMap<String, Arc<ChatRunControl>>>>,
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
    #[serde(default)]
    images: Vec<String>,
    approval_mode: String,
    model: Option<String>,
    reasoning_effort: Option<String>,
    #[serde(default)]
    environment: Vec<ConnectionEnvironmentInput>,
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

fn validate_thread_id(value: &str) -> Result<&str, String> {
    if !value.is_empty()
        && value.len() <= 128
        && value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        Ok(value)
    } else {
        Err("The saved provider thread id is invalid.".into())
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

fn validate_runtime_overrides(request: &ChatRunRequest) -> Result<(), String> {
    if let Some(model) = request
        .model
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        if model.len() > 128 || model.chars().any(char::is_control) {
            return Err("The provider model override is invalid.".into());
        }
    }
    if let Some(effort) = request.reasoning_effort.as_deref() {
        if !matches!(effort, "low" | "medium" | "high" | "xhigh") {
            return Err("The provider reasoning effort is invalid.".into());
        }
    }
    Ok(())
}

fn validate_image_inputs(request: &ChatRunRequest) -> Result<(), String> {
    if request.images.len() > 6 {
        return Err("A chat turn can include at most 6 images.".into());
    }
    for path in &request.images {
        let image = Path::new(path);
        let metadata = image.metadata().map_err(|error| {
            format!("Could not inspect chat image {}: {error}", image.display())
        })?;
        if !metadata.is_file() || metadata.len() > 10 * 1024 * 1024 {
            return Err(format!(
                "Chat image is invalid or too large: {}",
                image.display()
            ));
        }
        let extension = image
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase();
        if !matches!(extension.as_str(), "png" | "jpg" | "jpeg" | "webp" | "gif") {
            return Err(format!(
                "Chat image type is not supported: {}",
                image.display()
            ));
        }
    }
    Ok(())
}

fn approval_policy_for_mode(mode: &str) -> &'static str {
    match mode {
        "fullAccess" => "never",
        "approveSafe" => "on-request",
        _ => "untrusted",
    }
}

fn sandbox_for_approval_mode(mode: &str) -> &'static str {
    match mode {
        "fullAccess" => "danger-full-access",
        "approveSafe" => "workspace-write",
        _ => "read-only",
    }
}

fn thread_open_request(request: &ChatRunRequest) -> Result<Value, String> {
    validate_runtime_overrides(request)?;
    let mut params = json!({
        "cwd": request.project_path,
        "approvalPolicy": approval_policy_for_mode(&request.approval_mode),
        "sandbox": sandbox_for_approval_mode(&request.approval_mode),
        "serviceName": "Keelhouse",
    });
    if let Some(model) = request
        .model
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        params["model"] = json!(model);
    }
    let (method, id) = if let Some(thread_id) = request.provider_thread_id.as_deref() {
        params["threadId"] = json!(validate_thread_id(thread_id)?);
        ("thread/resume", 2)
    } else {
        ("thread/start", 2)
    };
    Ok(json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params }))
}

fn turn_start_request(request: &ChatRunRequest, thread_id: &str) -> Value {
    let mut input = vec![json!({ "type": "text", "text": request.prompt.trim() })];
    input.extend(
        request
            .images
            .iter()
            .map(|path| json!({ "type": "localImage", "path": path })),
    );
    let mut params = json!({
        "threadId": thread_id,
        "input": input,
        "approvalPolicy": approval_policy_for_mode(&request.approval_mode),
        "cwd": request.project_path,
    });
    if let Some(model) = request
        .model
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        params["model"] = json!(model);
    }
    if let Some(effort) = request.reasoning_effort.as_deref() {
        params["effort"] = json!(effort);
    }
    json!({ "jsonrpc": "2.0", "id": 3, "method": "turn/start", "params": params })
}

fn isolate_chat_process(command: &mut Command) {
    #[cfg(unix)]
    command.process_group(0);
}

fn terminate_chat_process(child: &mut Child, process_group_id: u32) {
    #[cfg(unix)]
    {
        let result = unsafe { libc::kill(-(process_group_id as i32), libc::SIGTERM) };
        if result == 0 {
            return;
        }
    }
    let _ = child.kill();
}

fn write_rpc(stdin: &Arc<Mutex<ChildStdin>>, message: &Value) -> Result<(), String> {
    let mut writer = stdin
        .lock()
        .map_err(|_| "Could not access the provider input.".to_string())?;
    serde_json::to_writer(&mut *writer, message)
        .and_then(|_| writer.write_all(b"\n").map_err(serde_json::Error::io))
        .and_then(|_| writer.flush().map_err(serde_json::Error::io))
        .map_err(|error| format!("Could not send a request to the provider: {error}"))
}

fn emit_event(app: &AppHandle, base: &ChatRunEnvelope, stream: &str, event: Value) {
    let _ = app.emit(
        CHAT_RUN_EVENT,
        ChatRunEnvelope {
            stream: stream.into(),
            event: Some(event),
            line: None,
            ..base.clone()
        },
    );
}

fn emit_raw_line(app: &AppHandle, base: &ChatRunEnvelope, stream: &str, line: String) {
    let _ = app.emit(
        CHAT_RUN_EVENT,
        ChatRunEnvelope {
            stream: stream.into(),
            event: None,
            line: Some(line),
            ..base.clone()
        },
    );
}

fn response_error(value: &Value) -> Option<String> {
    value
        .get("error")
        .and_then(|error| error.get("message").or(Some(error)))
        .and_then(Value::as_str)
        .map(str::to_string)
}

fn is_approval_method(method: &str) -> bool {
    matches!(
        method,
        "item/commandExecution/requestApproval"
            | "item/fileChange/requestApproval"
            | "item/permissions/requestApproval"
    )
}

fn current_time_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn codex_approval_response(request_id: u64, decision: &str) -> Value {
    json!({ "jsonrpc": "2.0", "id": request_id, "result": { "decision": decision } })
}

fn provider_approval_response(
    base: &ChatRunEnvelope,
    request_id: u64,
    approval: &PendingApproval,
    decision: &str,
) -> Value {
    if base.provider == "claude" {
        approval
            .claude_request
            .as_ref()
            .map(|request| claude_approval_response(request, decision))
            .unwrap_or_else(|| codex_approval_response(request_id, "decline"))
    } else {
        codex_approval_response(request_id, decision)
    }
}

fn expired_approval_ids(pending: &BTreeMap<u64, PendingApproval>, now_ms: u64) -> Vec<u64> {
    pending
        .iter()
        .filter_map(|(request_id, approval)| {
            (now_ms.saturating_sub(approval.requested_at_ms) >= APPROVAL_TIMEOUT_MS)
                .then_some(*request_id)
        })
        .collect()
}

fn emit_approval_resolution(
    app: &AppHandle,
    base: &ChatRunEnvelope,
    request_id: u64,
    approval: &PendingApproval,
    decision: &str,
    resolution: &str,
) {
    emit_event(
        app,
        base,
        "stdout",
        json!({
            "type": "approval.resolved",
            "requestId": request_id,
            "approvalMethod": approval.method,
            "decision": decision,
            "resolution": resolution,
        }),
    );
}

fn resolve_pending_approval(
    app: &AppHandle,
    base: &ChatRunEnvelope,
    stdin: &Arc<Mutex<ChildStdin>>,
    pending: &Arc<Mutex<BTreeMap<u64, PendingApproval>>>,
    request_id: u64,
    decision: &str,
    resolution: &str,
) -> Result<(), String> {
    let approval = pending
        .lock()
        .map_err(|_| "Could not access pending chat approvals.".to_string())?
        .get(&request_id)
        .cloned()
        .ok_or_else(|| format!("Approval request {request_id} is no longer pending."))?;
    write_rpc(
        stdin,
        &provider_approval_response(base, request_id, &approval, decision),
    )?;
    pending
        .lock()
        .map_err(|_| "Could not access pending chat approvals.".to_string())?
        .remove(&request_id);
    emit_approval_resolution(app, base, request_id, &approval, decision, resolution);
    Ok(())
}

fn close_pending_approvals(
    app: &AppHandle,
    base: &ChatRunEnvelope,
    stdin: &Arc<Mutex<ChildStdin>>,
    pending: &Arc<Mutex<BTreeMap<u64, PendingApproval>>>,
) {
    let approvals = pending
        .lock()
        .map(|mut approvals| std::mem::take(&mut *approvals))
        .unwrap_or_default();
    for (request_id, approval) in approvals {
        let _ = write_rpc(
            stdin,
            &provider_approval_response(base, request_id, &approval, "cancel"),
        );
        emit_approval_resolution(app, base, request_id, &approval, "cancel", "runClosed");
    }
}

#[tauri::command]
pub(crate) fn start_chat_run(
    app: AppHandle,
    state: State<ChatRunState>,
    request: ChatRunRequest,
) -> Result<ChatRunStarted, String> {
    match request.provider.as_str() {
        "codex" => start_codex_chat_run(app, state, request),
        "claude" => start_claude_chat_run(app, state, request),
        provider => Err(format!(
            "Structured chat is not available for {provider} yet. Open the raw terminal for that provider."
        )),
    }
}

fn start_codex_chat_run(
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
    if request.prompt.trim().is_empty() {
        return Err("Chat prompt is empty.".into());
    }
    let thread_request = thread_open_request(&request)?;
    validate_image_inputs(&request)?;
    let run_id = validate_run_id(request.run_id.trim())?.to_string();
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
    let mut command = Command::new(&shell);
    command
        .arg("-l")
        .arg("-c")
        .arg("exec codex app-server --stdio")
        .current_dir(project)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    for (name, value) in
        resolve_connection_environment(&request.environment, Some(&request.provider))?
    {
        command.env(name, value);
    }
    isolate_chat_process(&mut command);
    let mut child = command
        .spawn()
        .map_err(|error| format!("Could not launch Codex app-server: {error}"))?;
    let process_group_id = child.id();
    let stdin =
        Arc::new(Mutex::new(child.stdin.take().ok_or_else(|| {
            "Could not write to Codex app-server.".to_string()
        })?));
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Could not read Codex app-server output.".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Could not read Codex diagnostics.".to_string())?;
    let base = ChatRunEnvelope {
        run_id: run_id.clone(),
        chat_id: request.chat_id.clone(),
        provider: request.provider.clone(),
        stream: "lifecycle".into(),
        event: None,
        line: None,
    };
    let (stop_tx, stop_rx) = channel::<()>();
    let thread_id = Arc::new(Mutex::new(None));
    let turn_id = Arc::new(Mutex::new(None));
    let control = Arc::new(ChatRunControl {
        base: base.clone(),
        stdin: stdin.clone(),
        stop: stop_tx,
        thread_id: thread_id.clone(),
        turn_id: turn_id.clone(),
        pending_approvals: Arc::new(Mutex::new(BTreeMap::new())),
        next_request_id: AtomicU64::new(100),
    });
    let pending_approvals = control.pending_approvals.clone();
    state
        .runs
        .lock()
        .map_err(|_| "Could not register the chat run.".to_string())?
        .insert(run_id.clone(), control);

    if let Err(error) = write_rpc(
        &stdin,
        &json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "clientInfo": {
                    "name": "keelhouse",
                    "title": "Keelhouse",
                    "version": env!("CARGO_PKG_VERSION"),
                },
                "capabilities": { "experimentalApi": true },
            },
        }),
    ) {
        if let Ok(mut active) = state.runs.lock() {
            active.remove(&run_id);
        }
        terminate_chat_process(&mut child, process_group_id);
        let _ = child.wait();
        return Err(error);
    }

    let (stdout_tx, stdout_rx) = channel::<String>();
    let stdout_thread = std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if stdout_tx.send(line).is_err() {
                break;
            }
        }
    });
    let stderr_app = app.clone();
    let stderr_base = base.clone();
    let stderr_thread = std::thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            emit_raw_line(&stderr_app, &stderr_base, "stderr", line);
        }
    });
    let runs = state.runs.clone();
    std::thread::spawn(move || {
        let mut stopped = false;
        let mut turn_finished = false;
        let mut exit_code = 0;
        while !turn_finished {
            match stop_rx.try_recv() {
                Ok(()) => {
                    close_pending_approvals(&app, &base, &stdin, &pending_approvals);
                    stopped = true;
                    terminate_chat_process(&mut child, process_group_id);
                    break;
                }
                Err(TryRecvError::Disconnected | TryRecvError::Empty) => {}
            }
            let expired = pending_approvals
                .lock()
                .map(|pending| expired_approval_ids(&pending, current_time_millis()))
                .unwrap_or_default();
            for request_id in expired {
                let _ = resolve_pending_approval(
                    &app,
                    &base,
                    &stdin,
                    &pending_approvals,
                    request_id,
                    "decline",
                    "timeout",
                );
            }
            match stdout_rx.recv_timeout(Duration::from_millis(50)) {
                Ok(line) => {
                    let value = match serde_json::from_str::<Value>(&line) {
                        Ok(value) => value,
                        Err(_) => {
                            emit_raw_line(&app, &base, "stdout", line);
                            continue;
                        }
                    };
                    if let Some(message) = response_error(&value) {
                        emit_event(
                            &app,
                            &base,
                            "stdout",
                            json!({ "type": "turn.failed", "error": { "message": message } }),
                        );
                        exit_code = 1;
                        turn_finished = true;
                        continue;
                    }
                    let method = value.get("method").and_then(Value::as_str);
                    if let Some(method) = method {
                        if is_approval_method(method) {
                            if let Some(request_id) = value.get("id").and_then(Value::as_u64) {
                                if let Ok(mut pending) = pending_approvals.lock() {
                                    pending.insert(
                                        request_id,
                                        PendingApproval {
                                            method: method.to_string(),
                                            requested_at_ms: current_time_millis(),
                                            claude_request: None,
                                        },
                                    );
                                }
                            }
                        }
                        emit_event(&app, &base, "stdout", value.clone());
                        if method == "turn/completed" {
                            turn_finished = true;
                        }
                        continue;
                    }
                    match value.get("id").and_then(Value::as_u64) {
                        Some(1) => {
                            if write_rpc(
                                &stdin,
                                &json!({ "jsonrpc": "2.0", "method": "initialized" }),
                            )
                            .and_then(|_| write_rpc(&stdin, &thread_request))
                            .is_err()
                            {
                                exit_code = 1;
                                turn_finished = true;
                            }
                        }
                        Some(2) => {
                            let provider_thread_id = value
                                .pointer("/result/thread/id")
                                .and_then(Value::as_str)
                                .map(str::to_string);
                            if let Some(provider_thread_id) = provider_thread_id {
                                if let Ok(mut active_thread) = thread_id.lock() {
                                    *active_thread = Some(provider_thread_id.clone());
                                }
                                emit_event(
                                    &app,
                                    &base,
                                    "stdout",
                                    json!({ "type": "thread.started", "thread_id": provider_thread_id }),
                                );
                                if write_rpc(
                                    &stdin,
                                    &turn_start_request(&request, &provider_thread_id),
                                )
                                .is_err()
                                {
                                    exit_code = 1;
                                    turn_finished = true;
                                }
                            } else {
                                exit_code = 1;
                                turn_finished = true;
                            }
                        }
                        Some(3) => {
                            if let Some(provider_turn_id) = value
                                .pointer("/result/turn/id")
                                .and_then(Value::as_str)
                                .map(str::to_string)
                            {
                                if let Ok(mut active_turn) = turn_id.lock() {
                                    *active_turn = Some(provider_turn_id);
                                }
                            }
                        }
                        _ => {}
                    }
                }
                Err(RecvTimeoutError::Timeout) => {
                    if let Ok(Some(status)) = child.try_wait() {
                        exit_code = status.code().unwrap_or(1);
                        break;
                    }
                }
                Err(RecvTimeoutError::Disconnected) => {
                    exit_code = child
                        .wait()
                        .ok()
                        .and_then(|status| status.code())
                        .unwrap_or(1);
                    break;
                }
            }
        }
        close_pending_approvals(&app, &base, &stdin, &pending_approvals);
        if child.try_wait().ok().flatten().is_none() {
            terminate_chat_process(&mut child, process_group_id);
        }
        let _ = child.wait();
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
                    "exitCode": if stopped { 130 } else { exit_code },
                    "message": if stopped { "Codex run stopped." } else { "Codex app-server turn exited." },
                })),
                ..base
            },
        );
    });

    Ok(ChatRunStarted { run_id })
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn random_session_id() -> Result<String, String> {
    let mut bytes = [0_u8; 16];
    getrandom::fill(&mut bytes)
        .map_err(|error| format!("Could not create a Claude session id: {error}"))?;
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    Ok(format!(
        "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
        bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]
    ))
}

fn claude_login_shell_command(args: &[String]) -> Command {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
    let mut line = "exec claude".to_string();
    for arg in args {
        line.push(' ');
        line.push_str(&shell_quote(arg));
    }
    let mut command = Command::new(shell);
    command.arg("-l").arg("-c").arg(line);
    command
}

fn claude_help() -> Result<String, String> {
    let output = claude_login_shell_command(&["--help".into()])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|error| format!("Could not inspect Claude CLI capabilities: {error}"))?;
    if !output.status.success() {
        return Err(format!(
            "Claude CLI capability check failed: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

fn start_claude_chat_run(
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
    if request.prompt.trim().is_empty() {
        return Err("Chat prompt is empty.".into());
    }
    validate_runtime_overrides(&request)?;
    validate_image_inputs(&request)?;
    validate_claude_capabilities(&claude_help()?)?;
    let run_id = validate_run_id(request.run_id.trim())?.to_string();
    let session_id = match request.provider_thread_id.as_deref() {
        Some(value) => validate_thread_id(value)?.to_string(),
        None => random_session_id()?,
    };
    let args = claude_command_args(
        request.provider_thread_id.as_deref(),
        &session_id,
        &request.approval_mode,
        request.model.as_deref(),
        request.reasoning_effort.as_deref(),
    );
    let mut command = claude_login_shell_command(&args);
    command
        .current_dir(project)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    for (name, value) in
        resolve_connection_environment(&request.environment, Some(&request.provider))?
    {
        command.env(name, value);
    }
    isolate_chat_process(&mut command);
    let mut child = command
        .spawn()
        .map_err(|error| format!("Could not launch Claude structured chat: {error}"))?;
    let process_group_id = child.id();
    let stdin =
        Arc::new(Mutex::new(child.stdin.take().ok_or_else(|| {
            "Could not write to Claude structured chat.".to_string()
        })?));
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Could not read Claude structured output.".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Could not read Claude diagnostics.".to_string())?;
    let base = ChatRunEnvelope {
        run_id: run_id.clone(),
        chat_id: request.chat_id.clone(),
        provider: request.provider.clone(),
        stream: "lifecycle".into(),
        event: None,
        line: None,
    };
    let (stop_tx, stop_rx) = channel::<()>();
    let control = Arc::new(ChatRunControl {
        base: base.clone(),
        stdin: stdin.clone(),
        stop: stop_tx,
        thread_id: Arc::new(Mutex::new(Some(session_id.clone()))),
        turn_id: Arc::new(Mutex::new(None)),
        pending_approvals: Arc::new(Mutex::new(BTreeMap::new())),
        next_request_id: AtomicU64::new(100),
    });
    let pending_approvals = control.pending_approvals.clone();
    state
        .runs
        .lock()
        .map_err(|_| "Could not register the chat run.".to_string())?
        .insert(run_id.clone(), control.clone());

    if let Err(error) = write_rpc(
        &stdin,
        &claude_user_message(&request.prompt, &session_id, &request.images),
    ) {
        if let Ok(mut active) = state.runs.lock() {
            active.remove(&run_id);
        }
        terminate_chat_process(&mut child, process_group_id);
        let _ = child.wait();
        return Err(error);
    }

    let (stdout_tx, stdout_rx) = channel::<String>();
    let stdout_thread = std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if stdout_tx.send(line).is_err() {
                break;
            }
        }
    });
    let stderr_app = app.clone();
    let stderr_base = base.clone();
    let stderr_thread = std::thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            emit_raw_line(&stderr_app, &stderr_base, "stderr", line);
        }
    });
    let runs = state.runs.clone();
    std::thread::spawn(move || {
        let mut adapter = ClaudeStreamAdapter::default();
        let mut stopped = false;
        let mut turn_finished = false;
        let mut exit_code = 0;
        while !turn_finished {
            match stop_rx.try_recv() {
                Ok(()) => {
                    close_pending_approvals(&app, &base, &stdin, &pending_approvals);
                    stopped = true;
                    terminate_chat_process(&mut child, process_group_id);
                    break;
                }
                Err(TryRecvError::Disconnected | TryRecvError::Empty) => {}
            }
            let expired = pending_approvals
                .lock()
                .map(|pending| expired_approval_ids(&pending, current_time_millis()))
                .unwrap_or_default();
            for request_id in expired {
                let _ = resolve_pending_approval(
                    &app,
                    &base,
                    &stdin,
                    &pending_approvals,
                    request_id,
                    "decline",
                    "timeout",
                );
            }
            match stdout_rx.recv_timeout(Duration::from_millis(50)) {
                Ok(line) => {
                    let outputs = adapter.ingest_line(&line);
                    if outputs.is_empty() {
                        if serde_json::from_str::<Value>(&line).is_err() {
                            emit_raw_line(&app, &base, "stdout", line);
                        }
                        continue;
                    }
                    for output in outputs {
                        match output {
                            ClaudeAdapterOutput::Event(event) => {
                                let event_type = event.get("type").and_then(Value::as_str);
                                if matches!(event_type, Some("turn.completed" | "turn.failed")) {
                                    turn_finished = true;
                                    if event_type == Some("turn.failed") {
                                        exit_code = 1;
                                    }
                                }
                                emit_event(&app, &base, "stdout", event);
                            }
                            ClaudeAdapterOutput::Approval(approval) => {
                                let request_id =
                                    control.next_request_id.fetch_add(1, Ordering::Relaxed);
                                let method = approval.method.clone();
                                let params = approval.params.clone();
                                if let Ok(mut pending) = pending_approvals.lock() {
                                    pending.insert(
                                        request_id,
                                        PendingApproval {
                                            method: method.clone(),
                                            requested_at_ms: current_time_millis(),
                                            claude_request: Some(approval),
                                        },
                                    );
                                }
                                emit_event(
                                    &app,
                                    &base,
                                    "stdout",
                                    json!({
                                        "jsonrpc": "2.0",
                                        "id": request_id,
                                        "method": method,
                                        "params": params,
                                    }),
                                );
                            }
                        }
                    }
                }
                Err(RecvTimeoutError::Timeout) => {
                    if let Ok(Some(status)) = child.try_wait() {
                        exit_code = status.code().unwrap_or(1);
                        break;
                    }
                }
                Err(RecvTimeoutError::Disconnected) => {
                    exit_code = child
                        .wait()
                        .ok()
                        .and_then(|status| status.code())
                        .unwrap_or(1);
                    break;
                }
            }
        }
        close_pending_approvals(&app, &base, &stdin, &pending_approvals);
        if child.try_wait().ok().flatten().is_none() {
            terminate_chat_process(&mut child, process_group_id);
        }
        let _ = child.wait();
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
                    "exitCode": if stopped { 130 } else { exit_code },
                    "message": if stopped { "Claude run stopped." } else { "Claude structured turn exited." },
                })),
                ..base
            },
        );
    });

    Ok(ChatRunStarted { run_id })
}

#[tauri::command]
pub(crate) fn respond_chat_approval(
    app: AppHandle,
    state: State<ChatRunState>,
    run_id: String,
    request_id: u64,
    decision: String,
) -> Result<(), String> {
    if !matches!(
        decision.as_str(),
        "accept" | "acceptForSession" | "decline" | "cancel"
    ) {
        return Err("The chat approval decision is invalid.".into());
    }
    let control = state
        .runs
        .lock()
        .map_err(|_| "Could not access active chat runs.".to_string())?
        .get(&run_id)
        .cloned()
        .ok_or_else(|| format!("Chat run {run_id} is no longer active."))?;
    resolve_pending_approval(
        &app,
        &control.base,
        &control.stdin,
        &control.pending_approvals,
        request_id,
        &decision,
        "user",
    )
}

#[tauri::command]
pub(crate) fn stop_chat_run(state: State<ChatRunState>, run_id: String) -> Result<(), String> {
    let control = state
        .runs
        .lock()
        .map_err(|_| "Could not access active chat runs.".to_string())?
        .get(&run_id)
        .cloned()
        .ok_or_else(|| format!("Chat run {run_id} is no longer active."))?;
    if control.base.provider == "claude" {
        return control
            .stop
            .send(())
            .map_err(|_| format!("Could not stop chat run {run_id}."));
    }
    let thread_id = control
        .thread_id
        .lock()
        .ok()
        .and_then(|value| value.clone());
    let turn_id = control.turn_id.lock().ok().and_then(|value| value.clone());
    if let (Some(thread_id), Some(turn_id)) = (thread_id, turn_id) {
        let request_id = control.next_request_id.fetch_add(1, Ordering::Relaxed);
        write_rpc(
            &control.stdin,
            &json!({
                "jsonrpc": "2.0",
                "id": request_id,
                "method": "turn/interrupt",
                "params": { "threadId": thread_id, "turnId": turn_id },
            }),
        )?;
        let fallback = control.stop.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_secs(2));
            let _ = fallback.send(());
        });
        Ok(())
    } else {
        control
            .stop
            .send(())
            .map_err(|_| format!("Could not stop chat run {run_id}."))
    }
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
            images: Vec::new(),
            approval_mode: mode.into(),
            model: None,
            reasoning_effort: None,
            environment: Vec::new(),
        }
    }

    #[cfg(unix)]
    #[test]
    fn stop_terminates_the_entire_chat_process_group() {
        let mut command = Command::new("/bin/sh");
        command
            .arg("-c")
            .arg("sleep 30")
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        isolate_chat_process(&mut command);
        let mut child = command.spawn().expect("spawn isolated chat process");
        let process_group_id = child.id();
        std::thread::sleep(Duration::from_millis(50));
        terminate_chat_process(&mut child, process_group_id);
        let deadline = std::time::Instant::now() + Duration::from_secs(2);
        while std::time::Instant::now() < deadline {
            if child.try_wait().expect("poll stopped process").is_some() {
                break;
            }
            std::thread::sleep(Duration::from_millis(20));
        }
        assert!(child.try_wait().expect("poll terminated process").is_some());
        assert_ne!(unsafe { libc::kill(-(process_group_id as i32), 0) }, 0);
    }

    #[test]
    fn opens_new_codex_threads_with_scoped_permissions() {
        let value = thread_open_request(&request(None, "approveSafe")).unwrap();
        assert_eq!(value["method"], "thread/start");
        assert_eq!(value["params"]["cwd"], "/tmp/repo with spaces");
        assert_eq!(value["params"]["approvalPolicy"], "on-request");
        assert_eq!(value["params"]["sandbox"], "workspace-write");
    }

    #[test]
    fn resumes_only_valid_provider_thread_ids() {
        let value = thread_open_request(&request(
            Some("019f5a64-56ac-7e73-b554-138e0e8352b4"),
            "ask",
        ))
        .unwrap();
        assert_eq!(value["method"], "thread/resume");
        assert_eq!(
            value["params"]["threadId"],
            "019f5a64-56ac-7e73-b554-138e0e8352b4"
        );
        assert!(thread_open_request(&request(Some("bad; rm -rf"), "ask")).is_err());
    }

    #[test]
    fn applies_model_and_effort_to_turns() {
        let mut configured = request(None, "fullAccess");
        configured.model = Some("gpt-5.5".into());
        configured.reasoning_effort = Some("high".into());
        configured.images = vec!["/tmp/capture.png".into()];
        let thread = thread_open_request(&configured).unwrap();
        let turn = turn_start_request(&configured, "thread-1");
        assert_eq!(thread["params"]["model"], "gpt-5.5");
        assert_eq!(turn["params"]["model"], "gpt-5.5");
        assert_eq!(turn["params"]["effort"], "high");
        assert_eq!(turn["params"]["input"][0]["text"], "hello");
        assert_eq!(turn["params"]["input"][1]["type"], "localImage");
    }

    #[test]
    fn rejects_invalid_runtime_overrides() {
        let mut invalid_model = request(None, "ask");
        invalid_model.model = Some("bad\nmodel".into());
        assert!(thread_open_request(&invalid_model).is_err());
        let mut invalid_effort = request(None, "ask");
        invalid_effort.reasoning_effort = Some("maximum".into());
        assert!(thread_open_request(&invalid_effort).is_err());
    }

    #[test]
    fn recognizes_only_provider_approval_requests() {
        assert!(is_approval_method("item/commandExecution/requestApproval"));
        assert!(is_approval_method("item/fileChange/requestApproval"));
        assert!(is_approval_method("item/permissions/requestApproval"));
        assert!(!is_approval_method("item/tool/requestUserInput"));
    }

    #[test]
    fn expires_only_approval_requests_past_the_deadline() {
        let pending = BTreeMap::from([
            (
                41,
                PendingApproval {
                    method: "item/commandExecution/requestApproval".into(),
                    requested_at_ms: 1_000,
                    claude_request: None,
                },
            ),
            (
                42,
                PendingApproval {
                    method: "item/fileChange/requestApproval".into(),
                    requested_at_ms: 1_000 + APPROVAL_TIMEOUT_MS,
                    claude_request: None,
                },
            ),
        ]);
        assert_eq!(
            expired_approval_ids(&pending, 1_000 + APPROVAL_TIMEOUT_MS),
            vec![41]
        );
        assert_eq!(
            codex_approval_response(41, "decline")["result"]["decision"],
            "decline"
        );
    }
}
