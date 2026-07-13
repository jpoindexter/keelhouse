use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::process::{Command, Stdio};

const KEYCHAIN_SERVICE: &str = "com.jasonpoindexter.agent-cli.connections";

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionSecretStatus {
    key: String,
    present: bool,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionTargetStatus {
    ok: bool,
    message: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConnectionEnvironmentInput {
    name: String,
    #[serde(default)]
    value: Option<String>,
    #[serde(default)]
    secret_key: Option<String>,
}

fn validate_secret_key(key: &str) -> Result<&str, String> {
    let key = key.trim();
    if key.is_empty() || key.len() > 160 {
        return Err("Secret key must contain 1 to 160 characters.".into());
    }
    if !key
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | ':' | '_' | '-'))
    {
        return Err("Secret key contains unsupported characters.".into());
    }
    Ok(key)
}

fn keychain_entry(key: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYCHAIN_SERVICE, key)
        .map_err(|_| "macOS Keychain is unavailable.".to_string())
}

fn read_keychain_secret(key: &str) -> Result<Option<String>, String> {
    match keychain_entry(key)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err("macOS Keychain could not read the connection secret.".into()),
    }
}

#[tauri::command]
pub fn connection_secret_status(key: String) -> Result<ConnectionSecretStatus, String> {
    let key = validate_secret_key(&key)?.to_string();
    let present = read_keychain_secret(&key)?.is_some();
    Ok(ConnectionSecretStatus { key, present })
}

fn valid_environment_name(name: &str) -> bool {
    let mut chars = name.chars();
    matches!(chars.next(), Some('A'..='Z') | Some('_'))
        && chars.all(|character| {
            character.is_ascii_uppercase() || character.is_ascii_digit() || character == '_'
        })
}

fn provider_secret_binding(provider: Option<&str>) -> Option<(&'static str, &'static str)> {
    match provider {
        Some("codex") => Some(("provider:codex:api-key", "OPENAI_API_KEY")),
        Some("gemini") => Some(("provider:gemini:api-key", "GEMINI_API_KEY")),
        Some("claude") => Some(("provider:claude:api-key", "ANTHROPIC_API_KEY")),
        _ => None,
    }
}

fn resolve_connection_environment_with<F>(
    entries: &[ConnectionEnvironmentInput],
    provider: Option<&str>,
    mut secret_lookup: F,
) -> Result<Vec<(String, String)>, String>
where
    F: FnMut(&str) -> Result<Option<String>, String>,
{
    if entries.len() > 100 {
        return Err("A process can receive at most 100 configured environment variables.".into());
    }
    let mut resolved = BTreeMap::new();
    for entry in entries {
        if !valid_environment_name(&entry.name) || entry.name.len() > 120 {
            return Err(format!("Invalid environment variable name: {}", entry.name));
        }
        if resolved.contains_key(&entry.name) {
            return Err(format!("Duplicate environment variable: {}", entry.name));
        }
        let value = match (&entry.value, &entry.secret_key) {
            (Some(value), None) if value.len() <= 32_768 => value.clone(),
            (None, Some(key)) if key.starts_with("environment:") => {
                secret_lookup(validate_secret_key(key)?)?
                    .ok_or_else(|| format!("{} is missing from macOS Keychain.", entry.name))?
            }
            (Some(_), None) => {
                return Err(format!(
                    "{} exceeds the environment value limit.",
                    entry.name
                ))
            }
            _ => return Err(format!("{} must use one value source.", entry.name)),
        };
        resolved.insert(entry.name.clone(), value);
    }
    if let Some((secret_key, environment_name)) = provider_secret_binding(provider) {
        if let Some(value) = secret_lookup(secret_key)? {
            resolved.insert(environment_name.into(), value);
        }
    }
    Ok(resolved.into_iter().collect())
}

pub(crate) fn resolve_connection_environment(
    entries: &[ConnectionEnvironmentInput],
    provider: Option<&str>,
) -> Result<Vec<(String, String)>, String> {
    resolve_connection_environment_with(entries, provider, read_keychain_secret)
}

#[tauri::command]
pub fn set_connection_secret(key: String, value: String) -> Result<ConnectionSecretStatus, String> {
    let key = validate_secret_key(&key)?.to_string();
    if value.is_empty() || value.len() > 32_768 {
        return Err("Secret value must contain 1 to 32768 characters.".into());
    }
    keychain_entry(&key)?
        .set_password(&value)
        .map_err(|_| "macOS Keychain rejected the secret.".to_string())?;
    Ok(ConnectionSecretStatus { key, present: true })
}

#[tauri::command]
pub fn delete_connection_secret(key: String) -> Result<ConnectionSecretStatus, String> {
    let key = validate_secret_key(&key)?.to_string();
    match keychain_entry(&key)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => {}
        Err(_) => return Err("macOS Keychain could not remove the secret.".into()),
    }
    Ok(ConnectionSecretStatus {
        key,
        present: false,
    })
}

fn valid_http_target(target: &str) -> bool {
    let target = target.trim();
    let Some(rest) = target
        .strip_prefix("https://")
        .or_else(|| target.strip_prefix("http://"))
    else {
        return false;
    };
    !rest.is_empty() && !rest.starts_with('/') && !rest.contains(char::is_whitespace)
}

#[tauri::command]
pub fn validate_connection_target(kind: String, target: String) -> ConnectionTargetStatus {
    match kind.as_str() {
        "stdio" => {
            let command = target.trim();
            if command.is_empty() {
                return ConnectionTargetStatus {
                    ok: false,
                    message: "Enter the MCP server executable.".into(),
                };
            }
            let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
            let escaped = command.replace('\'', "'\\''");
            let ok = Command::new(shell)
                .args(["-l", "-c", &format!("command -v -- '{escaped}' >/dev/null")])
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status()
                .map(|status| status.success())
                .unwrap_or(false);
            ConnectionTargetStatus {
                ok,
                message: if ok {
                    format!("Found {command} in the login-shell PATH.")
                } else {
                    format!("Cannot find {command} in the login-shell PATH.")
                },
            }
        }
        "http" => ConnectionTargetStatus {
            ok: valid_http_target(&target),
            message: if valid_http_target(&target) {
                "HTTP MCP endpoint format is valid; connectivity is checked when enabled.".into()
            } else {
                "Enter an http:// or https:// MCP endpoint.".into()
            },
        },
        _ => ConnectionTargetStatus {
            ok: false,
            message: "Connection transport must be stdio or http.".into(),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn secret_keys_are_bounded_and_identifier_safe() {
        assert_eq!(
            validate_secret_key("provider:gemini:api-key"),
            Ok("provider:gemini:api-key")
        );
        assert!(validate_secret_key("").is_err());
        assert!(validate_secret_key("bad key").is_err());
        assert!(validate_secret_key(&"x".repeat(161)).is_err());
    }

    #[test]
    fn http_targets_require_a_host_and_supported_scheme() {
        assert!(valid_http_target("https://mcp.example.test/rpc"));
        assert!(valid_http_target("http://127.0.0.1:3000/mcp"));
        assert!(!valid_http_target("mcp.example.test"));
        assert!(!valid_http_target("https:///missing-host"));
        assert!(!valid_http_target("https://bad host/mcp"));
    }

    #[test]
    fn target_validation_explains_invalid_values() {
        assert_eq!(
            validate_connection_target("http".into(), "ftp://example.test".into()),
            ConnectionTargetStatus {
                ok: false,
                message: "Enter an http:// or https:// MCP endpoint.".into(),
            }
        );
        assert_eq!(
            validate_connection_target("unknown".into(), "target".into()),
            ConnectionTargetStatus {
                ok: false,
                message: "Connection transport must be stdio or http.".into(),
            }
        );
    }

    #[test]
    fn resolves_project_and_provider_secrets_without_renderer_values() {
        let entries = vec![
            ConnectionEnvironmentInput {
                name: "NODE_ENV".into(),
                value: Some("test".into()),
                secret_key: None,
            },
            ConnectionEnvironmentInput {
                name: "PRIVATE_TOKEN".into(),
                value: None,
                secret_key: Some("environment:private".into()),
            },
        ];
        let values = BTreeMap::from([
            (
                "environment:private".to_string(),
                "project-secret".to_string(),
            ),
            (
                "provider:gemini:api-key".to_string(),
                "provider-secret".to_string(),
            ),
        ]);
        let resolved = resolve_connection_environment_with(&entries, Some("gemini"), |key| {
            Ok(values.get(key).cloned())
        })
        .expect("resolve environment");
        assert_eq!(
            resolved,
            vec![
                ("GEMINI_API_KEY".into(), "provider-secret".into()),
                ("NODE_ENV".into(), "test".into()),
                ("PRIVATE_TOKEN".into(), "project-secret".into()),
            ]
        );
    }

    #[test]
    fn rejects_forged_secret_references_and_duplicate_names() {
        let forged = [ConnectionEnvironmentInput {
            name: "TOKEN".into(),
            value: None,
            secret_key: Some("provider:claude:api-key".into()),
        }];
        assert!(
            resolve_connection_environment_with(&forged, None, |_| Ok(None))
                .expect_err("forged provider reference")
                .contains("one value source")
        );

        let duplicate = [
            ConnectionEnvironmentInput {
                name: "NODE_ENV".into(),
                value: Some("one".into()),
                secret_key: None,
            },
            ConnectionEnvironmentInput {
                name: "NODE_ENV".into(),
                value: Some("two".into()),
                secret_key: None,
            },
        ];
        assert!(
            resolve_connection_environment_with(&duplicate, None, |_| Ok(None))
                .expect_err("duplicate name")
                .contains("Duplicate")
        );
    }
}
