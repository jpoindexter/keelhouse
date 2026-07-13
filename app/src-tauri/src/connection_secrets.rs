use serde::Serialize;
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

#[tauri::command]
pub fn connection_secret_status(key: String) -> Result<ConnectionSecretStatus, String> {
    let key = validate_secret_key(&key)?.to_string();
    let present = match keychain_entry(&key)?.get_password() {
        Ok(_) => true,
        Err(keyring::Error::NoEntry) => false,
        Err(_) => return Err("macOS Keychain could not read the connection status.".into()),
    };
    Ok(ConnectionSecretStatus { key, present })
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
}
