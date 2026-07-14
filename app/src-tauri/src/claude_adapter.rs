use serde_json::{json, Value};
use std::collections::BTreeMap;

const REQUIRED_HELP_FLAGS: [&str; 5] = [
    "--input-format",
    "--output-format",
    "--include-partial-messages",
    "--permission-mode",
    "--resume",
];

#[derive(Clone, Debug, PartialEq)]
pub(crate) struct ClaudeApprovalRequest {
    pub provider_request_id: String,
    pub method: String,
    pub params: Value,
    pub input: Value,
    pub permission_suggestions: Value,
}

#[derive(Clone, Debug, PartialEq)]
pub(crate) enum ClaudeAdapterOutput {
    Event(Value),
    Approval(ClaudeApprovalRequest),
}

#[derive(Default)]
pub(crate) struct ClaudeStreamAdapter {
    tools: BTreeMap<usize, PendingTool>,
    tool_names: BTreeMap<String, String>,
}

#[derive(Clone, Debug, Default)]
struct PendingTool {
    id: String,
    name: String,
    input_json: String,
}

pub(crate) fn validate_claude_capabilities(help: &str) -> Result<(), String> {
    let missing = REQUIRED_HELP_FLAGS
        .iter()
        .filter(|flag| !help.contains(**flag))
        .copied()
        .collect::<Vec<_>>();
    if missing.is_empty() {
        Ok(())
    } else {
        Err(format!(
            "The installed Claude CLI does not support Keelhouse structured chat (missing {}). Update Claude Code and try again.",
            missing.join(", ")
        ))
    }
}

pub(crate) fn permission_mode(approval_mode: &str) -> &'static str {
    match approval_mode {
        "fullAccess" => "auto",
        "approveSafe" => "acceptEdits",
        _ => "default",
    }
}

pub(crate) fn command_args(
    provider_thread_id: Option<&str>,
    session_id: &str,
    approval_mode: &str,
    model: Option<&str>,
    effort: Option<&str>,
) -> Vec<String> {
    let mut args = vec![
        "--print".into(),
        "--input-format".into(),
        "stream-json".into(),
        "--output-format".into(),
        "stream-json".into(),
        "--include-partial-messages".into(),
        "--verbose".into(),
        "--permission-mode".into(),
        permission_mode(approval_mode).into(),
    ];
    if let Some(model) = model.map(str::trim).filter(|value| !value.is_empty()) {
        args.extend(["--model".into(), model.into()]);
    }
    if let Some(effort) = effort {
        args.extend(["--effort".into(), effort.into()]);
    }
    if let Some(thread_id) = provider_thread_id {
        args.extend(["--resume".into(), thread_id.into()]);
    } else {
        args.extend(["--session-id".into(), session_id.into()]);
    }
    args
}

pub(crate) fn user_message(prompt: &str, session_id: &str, images: &[String]) -> Value {
    let mut content = vec![json!({ "type": "text", "text": prompt.trim() })];
    content.extend(images.iter().map(|path| {
        json!({
            "type": "text",
            "text": format!("Local image attached in Keelhouse: @{path}"),
        })
    }));
    json!({
        "type": "user",
        "message": { "role": "user", "content": content },
        "parent_tool_use_id": Value::Null,
        "session_id": session_id,
    })
}

pub(crate) fn approval_response(request: &ClaudeApprovalRequest, decision: &str) -> Value {
    let response = if matches!(decision, "accept" | "acceptForSession") {
        let mut allowed = json!({
            "behavior": "allow",
            "updatedInput": request.input,
        });
        if decision == "acceptForSession" && request.permission_suggestions.is_array() {
            allowed["updatedPermissions"] = request.permission_suggestions.clone();
        }
        allowed
    } else {
        json!({
            "behavior": "deny",
            "message": if decision == "cancel" {
                "The Keelhouse chat run closed before permission was granted."
            } else {
                "The user denied this tool request in Keelhouse."
            },
        })
    };
    json!({
        "type": "control_response",
        "response": {
            "subtype": "success",
            "request_id": request.provider_request_id,
            "response": response,
        },
    })
}

fn text(value: Option<&Value>) -> &str {
    value.and_then(Value::as_str).unwrap_or_default()
}

fn tool_method(name: &str) -> &'static str {
    match name {
        "Bash" => "item/commandExecution/requestApproval",
        "Edit" | "Write" | "NotebookEdit" => "item/fileChange/requestApproval",
        _ => "item/permissions/requestApproval",
    }
}

fn tool_params(name: &str, input: &Value) -> Value {
    let command = input.get("command").and_then(Value::as_str);
    let target = input
        .get("file_path")
        .or_else(|| input.get("path"))
        .and_then(Value::as_str);
    json!({
        "tool": name,
        "command": command,
        "grantRoot": target,
        "reason": format!("Claude requested {name}.\nInput: {}", input),
    })
}

fn tool_result_text(block: &Value) -> String {
    match block.get("content") {
        Some(Value::String(value)) => value.clone(),
        Some(Value::Array(values)) => values
            .iter()
            .filter_map(|value| value.get("text").and_then(Value::as_str))
            .collect::<Vec<_>>()
            .join(""),
        Some(value) => value.to_string(),
        None => String::new(),
    }
}

impl ClaudeStreamAdapter {
    pub(crate) fn ingest_line(&mut self, line: &str) -> Vec<ClaudeAdapterOutput> {
        let value = match serde_json::from_str::<Value>(line) {
            Ok(value) => value,
            Err(_) => return Vec::new(),
        };
        self.ingest(value)
    }

    pub(crate) fn ingest(&mut self, value: Value) -> Vec<ClaudeAdapterOutput> {
        let event_type = text(value.get("type"));
        match event_type {
            "system" => {
                if text(value.get("subtype")) == "init" {
                    let session_id = text(value.get("session_id"));
                    if !session_id.is_empty() {
                        return vec![ClaudeAdapterOutput::Event(json!({
                            "type": "thread.started",
                            "thread_id": session_id,
                        }))];
                    }
                }
            }
            "stream_event" => return self.ingest_stream_event(&value),
            "control_request" => {
                let request = value.get("request").cloned().unwrap_or(Value::Null);
                if text(request.get("subtype")) == "can_use_tool" {
                    let provider_request_id = value
                        .get("request_id")
                        .and_then(|value| match value {
                            Value::String(value) => Some(value.clone()),
                            Value::Number(value) => Some(value.to_string()),
                            _ => None,
                        })
                        .unwrap_or_default();
                    let name = text(request.get("tool_name"));
                    let input = request.get("input").cloned().unwrap_or_else(|| json!({}));
                    if !provider_request_id.is_empty() && !name.is_empty() {
                        return vec![ClaudeAdapterOutput::Approval(ClaudeApprovalRequest {
                            provider_request_id,
                            method: tool_method(name).into(),
                            params: tool_params(name, &input),
                            input,
                            permission_suggestions: request
                                .get("permission_suggestions")
                                .or_else(|| request.get("permissionSuggestions"))
                                .cloned()
                                .unwrap_or(Value::Null),
                        })];
                    }
                }
            }
            "user" => return self.ingest_user_event(&value),
            "compaction" => {
                return vec![ClaudeAdapterOutput::Event(json!({
                    "type": "provider.compaction",
                    "summary": value.get("summary").or_else(|| value.get("content")).and_then(Value::as_str).unwrap_or("Context compacted"),
                }))];
            }
            "result" => {
                if text(value.get("subtype")) == "success" {
                    let mut outputs = Vec::new();
                    let result = text(value.get("result"));
                    if !result.is_empty() {
                        outputs.push(ClaudeAdapterOutput::Event(json!({
                            "type": "item.completed",
                            "item": { "id": "claude-message", "type": "agent_message", "text": result },
                        })));
                    }
                    outputs.push(ClaudeAdapterOutput::Event(json!({
                        "type": "turn.completed",
                        "usage": value.get("usage").cloned().unwrap_or_else(|| json!({})),
                    })));
                    return outputs;
                }
                let message = text(value.get("error"));
                let fallback = text(value.get("result"));
                return vec![ClaudeAdapterOutput::Event(json!({
                    "type": "turn.failed",
                    "error": { "message": if !message.is_empty() { message } else if !fallback.is_empty() { fallback } else { "Claude could not complete this turn." } },
                }))];
            }
            _ => {}
        }
        Vec::new()
    }

    fn ingest_stream_event(&mut self, value: &Value) -> Vec<ClaudeAdapterOutput> {
        let event = value.get("event").unwrap_or(&Value::Null);
        let event_type = text(event.get("type"));
        let index = event.get("index").and_then(Value::as_u64).unwrap_or(0) as usize;
        match event_type {
            "content_block_start" => {
                let block = event.get("content_block").unwrap_or(&Value::Null);
                if text(block.get("type")) == "tool_use" {
                    let tool = PendingTool {
                        id: text(block.get("id")).into(),
                        name: text(block.get("name")).into(),
                        input_json: String::new(),
                    };
                    self.tool_names.insert(tool.id.clone(), tool.name.clone());
                    self.tools.insert(index, tool.clone());
                    return vec![ClaudeAdapterOutput::Event(json!({
                        "type": "item.started",
                        "item": { "id": tool.id, "type": "dynamicToolCall", "tool": tool.name },
                    }))];
                }
            }
            "content_block_delta" => {
                let delta = event.get("delta").unwrap_or(&Value::Null);
                match text(delta.get("type")) {
                    "text_delta" => {
                        let text = text(delta.get("text"));
                        if !text.is_empty() {
                            return vec![ClaudeAdapterOutput::Event(json!({
                                "method": "item/agentMessage/delta",
                                "params": { "itemId": "claude-message", "delta": text },
                            }))];
                        }
                    }
                    "thinking_delta" => {
                        let thinking = text(delta.get("thinking"));
                        if !thinking.is_empty() {
                            return vec![ClaudeAdapterOutput::Event(json!({
                                "type": "provider.thinking.delta",
                                "delta": thinking,
                            }))];
                        }
                    }
                    "input_json_delta" => {
                        if let Some(tool) = self.tools.get_mut(&index) {
                            tool.input_json.push_str(text(delta.get("partial_json")));
                        }
                    }
                    _ => {}
                }
            }
            "content_block_stop" => {
                if let Some(tool) = self.tools.remove(&index) {
                    let input = serde_json::from_str::<Value>(&tool.input_json)
                        .unwrap_or_else(|_| json!({ "raw": tool.input_json }));
                    let mut outputs = vec![ClaudeAdapterOutput::Event(json!({
                        "type": "item.completed",
                        "item": {
                            "id": tool.id,
                            "type": "dynamicToolCall",
                            "tool": tool.name,
                            "input": input,
                        },
                    }))];
                    if tool.name == "AskUserQuestion" {
                        outputs.push(ClaudeAdapterOutput::Event(json!({
                            "type": "provider.question",
                            "toolId": tool.id,
                            "input": input,
                        })));
                    }
                    return outputs;
                }
            }
            _ => {}
        }
        Vec::new()
    }

    fn ingest_user_event(&mut self, value: &Value) -> Vec<ClaudeAdapterOutput> {
        let content = value
            .pointer("/message/content")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        let mut outputs = Vec::new();
        for block in content {
            if text(block.get("type")) != "tool_result" {
                continue;
            }
            let tool_id = text(block.get("tool_use_id"));
            let name = self
                .tool_names
                .get(tool_id)
                .cloned()
                .unwrap_or_else(|| "Tool".into());
            let result = tool_result_text(&block);
            outputs.push(ClaudeAdapterOutput::Event(json!({
                "type": "item.completed",
                "item": {
                    "id": tool_id,
                    "type": "dynamicToolCall",
                    "tool": name,
                    "aggregatedOutput": result,
                    "status": if block.get("is_error").and_then(Value::as_bool).unwrap_or(false) { "failed" } else { "completed" },
                },
            })));
            if matches!(name.as_str(), "TodoWrite" | "update_plan") {
                if let Ok(plan) = serde_json::from_str::<Value>(&result) {
                    outputs.push(ClaudeAdapterOutput::Event(json!({
                        "type": "provider.plan.updated",
                        "toolId": tool_id,
                        "plan": plan,
                    })));
                }
            }
        }
        outputs
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn requires_structured_cli_capabilities() {
        let help = REQUIRED_HELP_FLAGS.join(" ");
        assert!(validate_claude_capabilities(&help).is_ok());
        assert!(validate_claude_capabilities("--output-format").is_err());
    }

    #[test]
    fn command_never_contains_prompt_or_permission_bypass() {
        let args = command_args(
            None,
            "session-1",
            "fullAccess",
            Some("sonnet"),
            Some("high"),
        );
        assert!(args.contains(&"--input-format".into()));
        assert!(args.contains(&"auto".into()));
        assert!(!args
            .iter()
            .any(|arg| arg.contains("dangerously-skip-permissions")));
        assert!(!args.iter().any(|arg| arg.contains("secret prompt")));
        let input = user_message("secret prompt", "session-1", &[]);
        assert_eq!(input["message"]["content"][0]["text"], "secret prompt");
    }

    #[test]
    fn parses_partial_text_tools_usage_and_malformed_lines() {
        let mut adapter = ClaudeStreamAdapter::default();
        assert!(adapter.ingest_line("not-json").is_empty());
        let delta = adapter.ingest_line(r#"{"type":"stream_event","event":{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}}"#);
        assert_eq!(
            delta[0],
            ClaudeAdapterOutput::Event(json!({
                "method": "item/agentMessage/delta",
                "params": { "itemId": "claude-message", "delta": "Hello" },
            }))
        );
        let completed = adapter.ingest_line(
            r#"{"type":"result","subtype":"success","usage":{"input_tokens":5,"output_tokens":2}}"#,
        );
        assert_eq!(
            completed[0],
            ClaudeAdapterOutput::Event(json!({
                "type": "turn.completed",
                "usage": { "input_tokens": 5, "output_tokens": 2 },
            }))
        );
    }

    #[test]
    fn maps_control_requests_to_shared_approvals() {
        let mut adapter = ClaudeStreamAdapter::default();
        let output = adapter.ingest_line(r#"{"type":"control_request","request_id":"req-7","request":{"subtype":"can_use_tool","tool_name":"Bash","input":{"command":"git push"},"permission_suggestions":[{"type":"addRules"}]}}"#);
        let ClaudeAdapterOutput::Approval(request) = &output[0] else {
            panic!("expected approval")
        };
        assert_eq!(request.provider_request_id, "req-7");
        assert_eq!(request.method, "item/commandExecution/requestApproval");
        assert_eq!(request.params["command"], "git push");
        let allowed = approval_response(request, "acceptForSession");
        assert_eq!(allowed["response"]["response"]["behavior"], "allow");
        assert!(allowed["response"]["response"]["updatedPermissions"].is_array());
    }

    #[test]
    fn maps_question_compaction_and_plan_events() {
        let mut adapter = ClaudeStreamAdapter::default();
        adapter.ingest_line(r#"{"type":"stream_event","event":{"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"tool-1","name":"AskUserQuestion"}}}"#);
        adapter.ingest_line(r#"{"type":"stream_event","event":{"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\"question\":\"Proceed?\"}"}}}"#);
        let outputs = adapter.ingest_line(
            r#"{"type":"stream_event","event":{"type":"content_block_stop","index":1}}"#,
        );
        assert!(outputs.iter().any(|output| matches!(output, ClaudeAdapterOutput::Event(event) if event["type"] == "provider.question")));
        let compact =
            adapter.ingest_line(r#"{"type":"compaction","summary":"Context summarized"}"#);
        assert!(
            matches!(&compact[0], ClaudeAdapterOutput::Event(event) if event["type"] == "provider.compaction")
        );

        adapter.ingest_line(r#"{"type":"stream_event","event":{"type":"content_block_start","index":2,"content_block":{"type":"tool_use","id":"tool-2","name":"TodoWrite"}}}"#);
        adapter.ingest_line(r#"{"type":"stream_event","event":{"type":"content_block_delta","index":2,"delta":{"type":"input_json_delta","partial_json":"{not valid"}}}"#);
        let malformed_tool = adapter.ingest_line(
            r#"{"type":"stream_event","event":{"type":"content_block_stop","index":2}}"#,
        );
        assert!(
            matches!(&malformed_tool[0], ClaudeAdapterOutput::Event(event) if event["item"]["input"]["raw"] == "{not valid")
        );

        let plan = adapter.ingest_line(r#"{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"tool-2","content":"{\"items\":[{\"text\":\"Verify\",\"status\":\"in_progress\"}]}"}]}}"#);
        assert!(plan.iter().any(|output| matches!(output, ClaudeAdapterOutput::Event(event) if event["type"] == "provider.plan.updated")));
    }
}
