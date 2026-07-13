use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{HashMap, VecDeque};
use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::mpsc::{channel, Sender};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::State;

const BODY_LIMIT: usize = 1024 * 1024;
const ACTION_TIMEOUT: Duration = Duration::from_secs(60);

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentHookSnapshot {
    #[serde(default)]
    projects: Vec<AgentHookProject>,
    #[serde(default)]
    active_project_path: Option<String>,
    #[serde(default)]
    active_chat_id: Option<String>,
    #[serde(default)]
    panes: Vec<AgentHookPane>,
    #[serde(default)]
    open_files: Vec<String>,
    #[serde(default)]
    selected_file: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentHookProject {
    path: String,
    status: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentHookPane {
    id: u32,
    label: String,
    state: String,
    cwd: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentHookStatus {
    endpoint: String,
    config_path: String,
    running: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentHookRequest {
    request_id: String,
    tool: String,
    arguments: Value,
    requested_by: String,
}

#[derive(Clone, Debug)]
struct AgentHookActionResult {
    ok: bool,
    message: String,
}

pub(crate) struct AgentHookState {
    endpoint: String,
    config_path: PathBuf,
    token: String,
    snapshot: Arc<Mutex<AgentHookSnapshot>>,
    pending: Arc<Mutex<HashMap<String, Sender<AgentHookActionResult>>>>,
    requests: Arc<Mutex<VecDeque<AgentHookRequest>>>,
}

fn random_token(bytes: usize) -> Result<String, String> {
    let mut value = vec![0_u8; bytes];
    getrandom::fill(&mut value)
        .map_err(|_| "Could not create the agent-hook token.".to_string())?;
    Ok(base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(value))
}

fn write_config(path: &Path, endpoint: &str, token: &str) -> Result<(), String> {
    let body = serde_json::to_vec_pretty(&json!({
        "mcpServers": {
            "keelhouse": {
                "type": "http",
                "url": endpoint,
                "headers": { "Authorization": format!("Bearer {token}") }
            }
        }
    }))
    .map_err(|error| format!("Could not encode the agent-hook configuration: {error}"))?;
    fs::write(path, body)
        .map_err(|error| format!("Could not write the agent-hook configuration: {error}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600))
            .map_err(|error| format!("Could not protect the agent-hook configuration: {error}"))?;
    }
    Ok(())
}

fn read_request(
    stream: &mut TcpStream,
) -> Result<(String, HashMap<String, String>, Vec<u8>), String> {
    stream.set_read_timeout(Some(Duration::from_secs(5))).ok();
    let mut bytes = Vec::new();
    let mut buffer = [0_u8; 4096];
    let header_end = loop {
        let count = stream
            .read(&mut buffer)
            .map_err(|error| format!("Could not read agent-hook request: {error}"))?;
        if count == 0 {
            return Err("Agent-hook request ended before its headers.".into());
        }
        bytes.extend_from_slice(&buffer[..count]);
        if bytes.len() > 32 * 1024 {
            return Err("Agent-hook request headers exceeded 32 KiB.".into());
        }
        if let Some(position) = bytes.windows(4).position(|window| window == b"\r\n\r\n") {
            break position + 4;
        }
    };
    let header_text = std::str::from_utf8(&bytes[..header_end])
        .map_err(|_| "Agent-hook request headers were not UTF-8.".to_string())?;
    let mut lines = header_text.split("\r\n");
    let request_line = lines.next().unwrap_or_default().to_string();
    let headers = lines
        .filter_map(|line| line.split_once(':'))
        .map(|(name, value)| (name.trim().to_ascii_lowercase(), value.trim().to_string()))
        .collect::<HashMap<_, _>>();
    let content_length = headers
        .get("content-length")
        .and_then(|value| value.parse::<usize>().ok())
        .ok_or_else(|| "Agent-hook request requires Content-Length.".to_string())?;
    if content_length > BODY_LIMIT {
        return Err("Agent-hook request exceeded 1 MiB.".into());
    }
    while bytes.len() < header_end + content_length {
        let count = stream
            .read(&mut buffer)
            .map_err(|error| format!("Could not read agent-hook body: {error}"))?;
        if count == 0 {
            return Err("Agent-hook request body ended early.".into());
        }
        bytes.extend_from_slice(&buffer[..count]);
    }
    Ok((
        request_line,
        headers,
        bytes[header_end..header_end + content_length].to_vec(),
    ))
}

fn write_response(stream: &mut TcpStream, status: &str, body: Option<&Value>) {
    let bytes = body.map(|value| value.to_string()).unwrap_or_default();
    let content_type = if body.is_some() {
        "Content-Type: application/json\r\n"
    } else {
        ""
    };
    let response = format!(
        "HTTP/1.1 {status}\r\n{content_type}Content-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n{bytes}",
        bytes.len()
    );
    let _ = stream.write_all(response.as_bytes());
}

fn tool_list() -> Value {
    json!({ "tools": [
        { "name": "list_projects", "description": "List projects currently open in Keelhouse.", "inputSchema": { "type": "object", "properties": {}, "additionalProperties": false } },
        { "name": "get_workspace_state", "description": "Read the active project, chat, panes, and open files.", "inputSchema": { "type": "object", "properties": {}, "additionalProperties": false } },
        { "name": "focus_pane", "description": "Request focus for an existing terminal pane.", "inputSchema": { "type": "object", "properties": { "paneId": { "type": "integer", "minimum": 0 } }, "required": ["paneId"], "additionalProperties": false } },
        { "name": "open_file", "description": "Request that a workspace-relative file open in the editor tray.", "inputSchema": { "type": "object", "properties": { "path": { "type": "string" } }, "required": ["path"], "additionalProperties": false } },
        { "name": "create_shell", "description": "Request a new blank shell pane in the active project.", "inputSchema": { "type": "object", "properties": {}, "additionalProperties": false } },
        { "name": "report_status", "description": "Publish an attributed agent status in the active chat activity log.", "inputSchema": { "type": "object", "properties": { "status": { "type": "string" }, "detail": { "type": "string" } }, "required": ["status"], "additionalProperties": false } }
    ] })
}

fn text_result(value: Value, is_error: bool) -> Value {
    json!({ "content": [{ "type": "text", "text": value.to_string() }], "isError": is_error })
}

fn dispatch_action(state: &AgentHookState, tool: &str, arguments: Value) -> Result<Value, String> {
    let request_id = random_token(18)?;
    let (sender, receiver) = channel();
    state
        .pending
        .lock()
        .map_err(|_| "Agent-hook action queue is unavailable.".to_string())?
        .insert(request_id.clone(), sender);
    if let Err(error) = state
        .requests
        .lock()
        .map_err(|_| "Agent-hook request queue is unavailable.".to_string())
        .map(|mut requests| {
            requests.push_back(AgentHookRequest {
                request_id: request_id.clone(),
                tool: tool.to_string(),
                arguments,
                requested_by: "agent-hook".into(),
            });
        })
    {
        state
            .pending
            .lock()
            .ok()
            .and_then(|mut pending| pending.remove(&request_id));
        return Err(error);
    }
    match receiver.recv_timeout(ACTION_TIMEOUT) {
        Ok(result) if result.ok => Ok(json!({ "ok": true, "message": result.message })),
        Ok(result) => Err(result.message),
        Err(_) => {
            state
                .pending
                .lock()
                .ok()
                .and_then(|mut pending| pending.remove(&request_id));
            Err("Agent-hook request timed out waiting for the app.".into())
        }
    }
}

fn handle_rpc(state: &AgentHookState, request: Value) -> Option<Value> {
    let id = request.get("id").cloned();
    let method = request
        .get("method")
        .and_then(Value::as_str)
        .unwrap_or_default();
    if id.is_none() {
        return None;
    }
    let result = match method {
        "initialize" => Ok(json!({
            "protocolVersion": "2025-06-18",
            "capabilities": { "tools": { "listChanged": false } },
            "serverInfo": { "name": "keelhouse", "version": env!("CARGO_PKG_VERSION") }
        })),
        "tools/list" => Ok(tool_list()),
        "tools/call" => {
            let params = request.get("params").cloned().unwrap_or_else(|| json!({}));
            let name = params
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or_default();
            let arguments = params
                .get("arguments")
                .cloned()
                .unwrap_or_else(|| json!({}));
            match name {
                "list_projects" => state
                    .snapshot
                    .lock()
                    .map(|snapshot| text_result(json!(snapshot.projects), false))
                    .map_err(|_| "Agent-hook snapshot is unavailable.".to_string()),
                "get_workspace_state" => state
                    .snapshot
                    .lock()
                    .map(|snapshot| text_result(json!(&*snapshot), false))
                    .map_err(|_| "Agent-hook snapshot is unavailable.".to_string()),
                "focus_pane" | "open_file" | "create_shell" | "report_status" => {
                    dispatch_action(state, name, arguments).map(|value| text_result(value, false))
                }
                _ => Err("Unknown Keelhouse agent-hook tool.".into()),
            }
        }
        _ => Err("Unsupported MCP method.".into()),
    };
    Some(match result {
        Ok(result) => json!({ "jsonrpc": "2.0", "id": id, "result": result }),
        Err(error) if method == "tools/call" => {
            json!({ "jsonrpc": "2.0", "id": id, "result": text_result(json!({ "ok": false, "error": error }), true) })
        }
        Err(error) => {
            json!({ "jsonrpc": "2.0", "id": id, "error": { "code": -32601, "message": error } })
        }
    })
}

fn handle_connection(state: Arc<AgentHookState>, mut stream: TcpStream) {
    let Ok((request_line, headers, body)) = read_request(&mut stream) else {
        write_response(&mut stream, "400 Bad Request", None);
        return;
    };
    if request_line != "POST /mcp HTTP/1.1" {
        write_response(&mut stream, "404 Not Found", None);
        return;
    }
    if headers.get("authorization") != Some(&format!("Bearer {}", state.token)) {
        write_response(&mut stream, "401 Unauthorized", None);
        return;
    }
    let Ok(request) = serde_json::from_slice::<Value>(&body) else {
        write_response(&mut stream, "400 Bad Request", None);
        return;
    };
    if let Some(response) = handle_rpc(&state, request) {
        write_response(&mut stream, "200 OK", Some(&response));
    } else {
        write_response(&mut stream, "202 Accepted", None);
    }
}

pub(crate) fn start_agent_hook_server(app_data_dir: &Path) -> Result<AgentHookState, String> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|error| format!("Could not bind agent-hook MCP: {error}"))?;
    let endpoint = format!(
        "http://127.0.0.1:{}/mcp",
        listener
            .local_addr()
            .map_err(|error| error.to_string())?
            .port()
    );
    let token = random_token(32)?;
    let config_path = app_data_dir.join("agent-hook-mcp.json");
    write_config(&config_path, &endpoint, &token)?;
    let state = AgentHookState {
        endpoint,
        config_path,
        token,
        snapshot: Arc::new(Mutex::new(AgentHookSnapshot::default())),
        pending: Arc::new(Mutex::new(HashMap::new())),
        requests: Arc::new(Mutex::new(VecDeque::new())),
    };
    let server_state = Arc::new(AgentHookState {
        endpoint: state.endpoint.clone(),
        config_path: state.config_path.clone(),
        token: state.token.clone(),
        snapshot: state.snapshot.clone(),
        pending: state.pending.clone(),
        requests: state.requests.clone(),
    });
    std::thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            let request_state = server_state.clone();
            std::thread::spawn(move || handle_connection(request_state, stream));
        }
    });
    Ok(state)
}

#[tauri::command]
pub(crate) fn update_agent_hook_snapshot(
    state: State<'_, AgentHookState>,
    snapshot: AgentHookSnapshot,
) -> Result<(), String> {
    *state
        .snapshot
        .lock()
        .map_err(|_| "Agent-hook snapshot is unavailable.".to_string())? = snapshot;
    Ok(())
}

fn drain_agent_hook_requests(state: &AgentHookState) -> Result<Vec<AgentHookRequest>, String> {
    let pending = state
        .pending
        .lock()
        .map_err(|_| "Agent-hook action queue is unavailable.".to_string())?;
    let mut requests = state
        .requests
        .lock()
        .map_err(|_| "Agent-hook request queue is unavailable.".to_string())?;
    Ok(requests
        .drain(..)
        .filter(|request| pending.contains_key(&request.request_id))
        .collect())
}

#[tauri::command]
pub(crate) fn take_agent_hook_requests(
    state: State<'_, AgentHookState>,
) -> Result<Vec<AgentHookRequest>, String> {
    drain_agent_hook_requests(&state)
}

#[tauri::command]
pub(crate) fn resolve_agent_hook_request(
    state: State<'_, AgentHookState>,
    request_id: String,
    ok: bool,
    message: String,
) -> Result<(), String> {
    let sender = state
        .pending
        .lock()
        .map_err(|_| "Agent-hook action queue is unavailable.".to_string())?
        .remove(&request_id)
        .ok_or_else(|| "Agent-hook request is no longer pending.".to_string())?;
    sender
        .send(AgentHookActionResult { ok, message })
        .map_err(|_| "Agent-hook caller disconnected.".to_string())
}

#[tauri::command]
pub(crate) fn agent_hook_status(state: State<'_, AgentHookState>) -> AgentHookStatus {
    AgentHookStatus {
        endpoint: state.endpoint.clone(),
        config_path: state.config_path.display().to_string(),
        running: true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tool_catalog_separates_reads_from_attributed_actions() {
        let tools = tool_list()["tools"].as_array().unwrap().clone();
        let names = tools
            .iter()
            .filter_map(|tool| tool["name"].as_str())
            .collect::<Vec<_>>();
        assert_eq!(
            names,
            [
                "list_projects",
                "get_workspace_state",
                "focus_pane",
                "open_file",
                "create_shell",
                "report_status"
            ]
        );
    }

    #[test]
    fn config_is_private_and_contains_a_bearer_header() {
        let dir = std::env::temp_dir().join(format!(
            "keelhouse-agent-hook-test-{}",
            random_token(8).unwrap()
        ));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("mcp.json");
        write_config(&path, "http://127.0.0.1:4321/mcp", "secret-token").unwrap();
        let value: Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        assert_eq!(
            value["mcpServers"]["keelhouse"]["headers"]["Authorization"],
            "Bearer secret-token"
        );
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                fs::metadata(&path).unwrap().permissions().mode() & 0o777,
                0o600
            );
        }
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn request_queue_only_delivers_actions_that_are_still_pending() {
        let (sender, _receiver) = channel();
        let mut pending = HashMap::new();
        pending.insert("live".to_string(), sender);
        let state = AgentHookState {
            endpoint: "http://127.0.0.1:1/mcp".into(),
            config_path: PathBuf::from("mcp.json"),
            token: "token".into(),
            snapshot: Arc::new(Mutex::new(AgentHookSnapshot::default())),
            pending: Arc::new(Mutex::new(pending)),
            requests: Arc::new(Mutex::new(VecDeque::from([
                AgentHookRequest {
                    request_id: "expired".into(),
                    tool: "open_file".into(),
                    arguments: json!({ "path": "OLD.md" }),
                    requested_by: "agent-hook".into(),
                },
                AgentHookRequest {
                    request_id: "live".into(),
                    tool: "open_file".into(),
                    arguments: json!({ "path": "README.md" }),
                    requested_by: "agent-hook".into(),
                },
            ]))),
        };

        let requests = drain_agent_hook_requests(&state).unwrap();
        assert_eq!(requests.len(), 1);
        assert_eq!(requests[0].request_id, "live");
        assert!(drain_agent_hook_requests(&state).unwrap().is_empty());
    }
}
