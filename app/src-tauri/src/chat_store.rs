use rusqlite::{params, Connection, OptionalExtension, Transaction, TransactionBehavior};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use std::path::Path;
use std::sync::Mutex;

const LEGACY_IMPORT_KEY: &str = "workspace-json-chat-import-v1";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StoredChatMessage {
    pub id: String,
    pub role: String,
    pub text: String,
    pub timestamp: i64,
    #[serde(default)]
    pub item_id: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub bookmarked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StoredChatConversation {
    pub provider: String,
    #[serde(default)]
    pub provider_thread_id: Option<String>,
    #[serde(default)]
    pub active_run_id: Option<String>,
    #[serde(default)]
    pub messages: Vec<StoredChatMessage>,
    pub updated_at: i64,
    #[serde(default)]
    pub revision: i64,
    #[serde(default)]
    pub run_status: Option<String>,
    #[serde(default)]
    pub usage: Option<Value>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LegacyChatImportResult {
    imported: usize,
    already_completed: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ChatSearchResult {
    pub chat_id: String,
    pub project_path: String,
    pub session_id: String,
    pub message_id: String,
    pub role: String,
    pub snippet: String,
    pub timestamp: i64,
    pub bookmarked: bool,
}

pub(crate) struct ChatStore {
    connection: Mutex<Connection>,
}

impl ChatStore {
    pub(crate) fn open(path: &Path) -> Result<Self, String> {
        let connection = Connection::open(path)
            .map_err(|error| format!("Could not open the chat database: {error}"))?;
        Self::from_connection(connection)
    }

    fn from_connection(connection: Connection) -> Result<Self, String> {
        connection
            .execute_batch(
                "PRAGMA journal_mode=WAL;
                 PRAGMA foreign_keys=ON;
                 PRAGMA synchronous=NORMAL;",
            )
            .map_err(|error| format!("Could not configure the chat database: {error}"))?;
        migrate_schema(&connection)?;
        Ok(Self {
            connection: Mutex::new(connection),
        })
    }

    pub(crate) fn load_all(&self) -> Result<BTreeMap<String, StoredChatConversation>, String> {
        let mut connection = self
            .connection
            .lock()
            .map_err(|_| "Could not lock the chat database.".to_string())?;
        let transaction = connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(db_error("Could not begin chat recovery"))?;
        recover_interrupted_runs(&transaction)?;
        let result = load_all_from(&transaction)?;
        transaction
            .commit()
            .map_err(db_error("Could not commit chat recovery"))?;
        Ok(result)
    }

    pub(crate) fn save(
        &self,
        chat_id: &str,
        conversation: &StoredChatConversation,
    ) -> Result<bool, String> {
        validate_conversation(chat_id, conversation)?;
        let mut connection = self
            .connection
            .lock()
            .map_err(|_| "Could not lock the chat database.".to_string())?;
        let transaction = connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(db_error("Could not begin chat save"))?;
        let saved = save_in_transaction(&transaction, chat_id, conversation, false)?;
        transaction
            .commit()
            .map_err(db_error("Could not commit chat save"))?;
        Ok(saved)
    }

    pub(crate) fn import_legacy(
        &self,
        conversations: &BTreeMap<String, StoredChatConversation>,
    ) -> Result<LegacyChatImportResult, String> {
        let mut connection = self
            .connection
            .lock()
            .map_err(|_| "Could not lock the chat database.".to_string())?;
        let transaction = connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(db_error("Could not begin legacy chat import"))?;
        let already_completed = transaction
            .query_row(
                "SELECT 1 FROM chat_metadata WHERE key = ?1",
                [LEGACY_IMPORT_KEY],
                |_| Ok(()),
            )
            .optional()
            .map_err(db_error("Could not inspect legacy chat import state"))?
            .is_some();
        if already_completed {
            transaction
                .commit()
                .map_err(db_error("Could not finish legacy chat import check"))?;
            return Ok(LegacyChatImportResult {
                imported: 0,
                already_completed: true,
            });
        }

        let mut imported = 0;
        for (chat_id, conversation) in conversations {
            validate_conversation(chat_id, conversation)?;
            if save_in_transaction(&transaction, chat_id, conversation, true)? {
                imported += 1;
            }
        }
        transaction
            .execute(
                "INSERT INTO chat_metadata (key, value) VALUES (?1, 'complete')
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                [LEGACY_IMPORT_KEY],
            )
            .map_err(db_error("Could not record legacy chat import"))?;
        transaction
            .commit()
            .map_err(db_error("Could not commit legacy chat import"))?;
        Ok(LegacyChatImportResult {
            imported,
            already_completed: false,
        })
    }

    pub(crate) fn delete(&self, chat_id: &str) -> Result<(), String> {
        let connection = self
            .connection
            .lock()
            .map_err(|_| "Could not lock the chat database.".to_string())?;
        connection
            .execute(
                "DELETE FROM chat_conversations WHERE chat_id = ?1",
                [chat_id],
            )
            .map_err(db_error("Could not delete chat"))?;
        Ok(())
    }

    pub(crate) fn delete_project(&self, project_path: &str) -> Result<usize, String> {
        let connection = self
            .connection
            .lock()
            .map_err(|_| "Could not lock the chat database.".to_string())?;
        connection
            .execute(
                "DELETE FROM chat_conversations WHERE project_path = ?1",
                [project_path],
            )
            .map_err(db_error("Could not delete project chats"))
    }

    pub(crate) fn search(
        &self,
        query: &str,
        bookmarks_only: bool,
        limit: usize,
    ) -> Result<Vec<ChatSearchResult>, String> {
        let query = query.trim();
        if (!bookmarks_only && query.chars().count() < 2) || query.chars().count() > 200 {
            return Ok(Vec::new());
        }
        let connection = self
            .connection
            .lock()
            .map_err(|_| "Could not lock the chat database.".to_string())?;
        let mut statement = connection
            .prepare(
                "SELECT m.chat_id, c.project_path, c.session_id, m.message_id,
                        m.role, m.text, m.timestamp, m.bookmarked
                 FROM chat_messages m
                 JOIN chat_conversations c ON c.chat_id = m.chat_id
                 WHERE m.role != 'status'
                   AND (?1 = '' OR instr(lower(m.text), lower(?1)) > 0)
                   AND (?2 = 0 OR m.bookmarked = 1)
                 ORDER BY m.bookmarked DESC, m.timestamp DESC, m.ordinal DESC
                 LIMIT ?3",
            )
            .map_err(db_error("Could not prepare chat search"))?;
        let rows = statement
            .query_map(
                params![query, i64::from(bookmarks_only), limit.clamp(1, 100) as i64],
                |row| {
                    let text: String = row.get(5)?;
                    Ok(ChatSearchResult {
                        chat_id: row.get(0)?,
                        project_path: row.get(1)?,
                        session_id: row.get(2)?,
                        message_id: row.get(3)?,
                        role: row.get(4)?,
                        snippet: chat_search_snippet(&text, query),
                        timestamp: row.get(6)?,
                        bookmarked: row.get::<_, i64>(7)? != 0,
                    })
                },
            )
            .map_err(db_error("Could not search chat messages"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(db_error("Could not read chat search results"))?;
        Ok(rows)
    }

    pub(crate) fn reset(&self) -> Result<(), String> {
        let mut connection = self
            .connection
            .lock()
            .map_err(|_| "Could not lock the chat database.".to_string())?;
        let transaction = connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(db_error("Could not begin chat reset"))?;
        transaction
            .execute("DELETE FROM chat_conversations", [])
            .map_err(db_error("Could not clear chats"))?;
        transaction
            .execute("DELETE FROM chat_metadata", [])
            .map_err(db_error("Could not clear chat metadata"))?;
        transaction
            .commit()
            .map_err(db_error("Could not commit chat reset"))
    }
}

fn db_error(context: &'static str) -> impl FnOnce(rusqlite::Error) -> String {
    move |error| format!("{context}: {error}")
}

fn migrate_schema(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "CREATE TABLE IF NOT EXISTS chat_schema_migrations (
                version INTEGER PRIMARY KEY,
                description TEXT NOT NULL,
                applied_at INTEGER NOT NULL
             );
             CREATE TABLE IF NOT EXISTS chat_metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
             );
             CREATE TABLE IF NOT EXISTS chat_conversations (
                chat_id TEXT PRIMARY KEY,
                project_path TEXT NOT NULL,
                session_id TEXT NOT NULL,
                provider TEXT NOT NULL,
                provider_thread_id TEXT,
                active_run_id TEXT,
                run_status TEXT NOT NULL DEFAULT 'idle'
                    CHECK(run_status IN ('idle','running','complete','error','interrupted')),
                usage_json TEXT,
                revision INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
             );
             CREATE INDEX IF NOT EXISTS chat_conversations_project_updated
                ON chat_conversations(project_path, updated_at DESC);
             CREATE TABLE IF NOT EXISTS chat_messages (
                chat_id TEXT NOT NULL REFERENCES chat_conversations(chat_id) ON DELETE CASCADE,
                message_id TEXT NOT NULL,
                ordinal INTEGER NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('user','assistant','tool','status','error')),
                text TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                item_id TEXT,
                title TEXT,
                status TEXT CHECK(status IS NULL OR status IN ('running','complete','error')),
                bookmarked INTEGER NOT NULL DEFAULT 0 CHECK(bookmarked IN (0, 1)),
                PRIMARY KEY(chat_id, message_id),
                UNIQUE(chat_id, ordinal)
             );
             CREATE INDEX IF NOT EXISTS chat_messages_chat_timestamp
                ON chat_messages(chat_id, timestamp, ordinal);
             INSERT OR IGNORE INTO chat_schema_migrations(version, description, applied_at)
                VALUES (1, 'durable chat conversations and messages', unixepoch() * 1000);",
        )
        .map_err(db_error("Could not migrate the chat database"))?;
    let has_bookmarked = connection
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM pragma_table_info('chat_messages') WHERE name = 'bookmarked')",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map_err(db_error("Could not inspect chat bookmark migration"))?
        != 0;
    if !has_bookmarked {
        connection
            .execute_batch("ALTER TABLE chat_messages ADD COLUMN bookmarked INTEGER NOT NULL DEFAULT 0 CHECK(bookmarked IN (0, 1));")
            .map_err(db_error("Could not add chat bookmarks"))?;
    }
    connection
        .execute(
            "INSERT OR IGNORE INTO chat_schema_migrations(version, description, applied_at)
             VALUES (2, 'message bookmarks and chat discovery', unixepoch() * 1000)",
            [],
        )
        .map_err(db_error("Could not record chat discovery migration"))?;
    Ok(())
}

fn chat_search_snippet(text: &str, query: &str) -> String {
    let normalized = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.chars().count() <= 180 {
        return normalized;
    }
    let lower = normalized.to_lowercase();
    let query = query.to_lowercase();
    let match_byte = if query.is_empty() {
        0
    } else {
        lower.find(&query).unwrap_or(0)
    };
    let match_char = normalized[..match_byte].chars().count();
    let start = match_char.saturating_sub(60);
    let snippet = normalized.chars().skip(start).take(180).collect::<String>();
    format!(
        "{}{}{}",
        if start > 0 { "…" } else { "" },
        snippet,
        if start + 180 < normalized.chars().count() {
            "…"
        } else {
            ""
        }
    )
}

fn split_chat_id(chat_id: &str) -> Result<(&str, &str), String> {
    let (project_path, session_id) = chat_id
        .rsplit_once('\n')
        .ok_or_else(|| "Chat identity must contain a project path and session id.".to_string())?;
    if project_path.trim().is_empty() || session_id.trim().is_empty() {
        return Err("Chat identity must contain a project path and session id.".to_string());
    }
    Ok((project_path, session_id))
}

fn validate_conversation(
    chat_id: &str,
    conversation: &StoredChatConversation,
) -> Result<(), String> {
    split_chat_id(chat_id)?;
    if conversation.provider.trim().is_empty() {
        return Err("Chat provider cannot be empty.".to_string());
    }
    if conversation.updated_at < 0 || conversation.revision < 0 {
        return Err("Chat timestamps and revisions cannot be negative.".to_string());
    }
    if !matches!(
        conversation.run_status.as_deref().unwrap_or("idle"),
        "idle" | "running" | "complete" | "error" | "interrupted"
    ) {
        return Err("Chat run status is invalid.".to_string());
    }
    for message in &conversation.messages {
        if message.id.trim().is_empty() || message.text.trim().is_empty() || message.timestamp < 0 {
            return Err("Chat messages require an id, text, and valid timestamp.".to_string());
        }
        if !matches!(
            message.role.as_str(),
            "user" | "assistant" | "tool" | "status" | "error"
        ) {
            return Err("Chat message role is invalid.".to_string());
        }
        if !matches!(
            message.status.as_deref(),
            None | Some("running") | Some("complete") | Some("error")
        ) {
            return Err("Chat message status is invalid.".to_string());
        }
    }
    Ok(())
}

fn save_in_transaction(
    transaction: &Transaction<'_>,
    chat_id: &str,
    conversation: &StoredChatConversation,
    insert_only: bool,
) -> Result<bool, String> {
    let existing_revision = transaction
        .query_row(
            "SELECT revision FROM chat_conversations WHERE chat_id = ?1",
            [chat_id],
            |row| row.get::<_, i64>(0),
        )
        .optional()
        .map_err(db_error("Could not read chat revision"))?;
    if insert_only && existing_revision.is_some() {
        return Ok(false);
    }
    if existing_revision.is_some_and(|revision| revision > conversation.revision) {
        return Ok(false);
    }
    let (project_path, session_id) = split_chat_id(chat_id)?;
    let run_status = conversation.run_status.as_deref().unwrap_or_else(|| {
        if conversation.active_run_id.is_some() {
            "running"
        } else {
            "idle"
        }
    });
    let usage_json = conversation
        .usage
        .as_ref()
        .map(serde_json::to_string)
        .transpose()
        .map_err(|error| format!("Could not serialize chat usage: {error}"))?;
    transaction
        .execute(
            "INSERT INTO chat_conversations (
                chat_id, project_path, session_id, provider, provider_thread_id,
                active_run_id, run_status, usage_json, revision, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)
             ON CONFLICT(chat_id) DO UPDATE SET
                project_path = excluded.project_path,
                session_id = excluded.session_id,
                provider = excluded.provider,
                provider_thread_id = excluded.provider_thread_id,
                active_run_id = excluded.active_run_id,
                run_status = excluded.run_status,
                usage_json = excluded.usage_json,
                revision = excluded.revision,
                updated_at = excluded.updated_at",
            params![
                chat_id,
                project_path,
                session_id,
                conversation.provider,
                conversation.provider_thread_id,
                conversation.active_run_id,
                run_status,
                usage_json,
                conversation.revision,
                conversation.updated_at,
            ],
        )
        .map_err(db_error("Could not save chat"))?;
    transaction
        .execute("DELETE FROM chat_messages WHERE chat_id = ?1", [chat_id])
        .map_err(db_error("Could not replace chat messages"))?;
    for (ordinal, message) in conversation.messages.iter().enumerate() {
        transaction
            .execute(
                "INSERT INTO chat_messages (
                    chat_id, message_id, ordinal, role, text, timestamp, item_id, title, status, bookmarked
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    chat_id,
                    message.id,
                    ordinal as i64,
                    message.role,
                    message.text,
                    message.timestamp,
                    message.item_id,
                    message.title,
                    message.status,
                    i64::from(message.bookmarked),
                ],
            )
            .map_err(db_error("Could not save chat message"))?;
    }
    Ok(true)
}

fn recover_interrupted_runs(transaction: &Transaction<'_>) -> Result<(), String> {
    let mut statement = transaction
        .prepare(
            "SELECT chat_id, updated_at FROM chat_conversations
             WHERE active_run_id IS NOT NULL OR run_status = 'running'",
        )
        .map_err(db_error("Could not inspect interrupted chats"))?;
    let interrupted = statement
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })
        .map_err(db_error("Could not read interrupted chats"))?
        .filter_map(Result::ok)
        .collect::<Vec<_>>();
    drop(statement);

    for (chat_id, updated_at) in interrupted {
        transaction
            .execute(
                "UPDATE chat_conversations
                 SET active_run_id = NULL, run_status = 'interrupted', revision = revision + 1
                 WHERE chat_id = ?1",
                [&chat_id],
            )
            .map_err(db_error("Could not recover interrupted chat"))?;
        let changed = transaction
            .execute(
                "UPDATE chat_messages
                 SET text = 'Interrupted when Keelhouse last closed.', status = 'error'
                 WHERE chat_id = ?1 AND role = 'status' AND status = 'running'",
                [&chat_id],
            )
            .map_err(db_error("Could not recover interrupted chat status"))?;
        if changed == 0 {
            let ordinal = transaction
                .query_row(
                    "SELECT COALESCE(MAX(ordinal), -1) + 1 FROM chat_messages WHERE chat_id = ?1",
                    [&chat_id],
                    |row| row.get::<_, i64>(0),
                )
                .map_err(db_error("Could not append interrupted chat status"))?;
            transaction
                .execute(
                    "INSERT INTO chat_messages (
                        chat_id, message_id, ordinal, role, text, timestamp, title, status
                     ) VALUES (?1, ?2, ?3, 'status', 'Interrupted when Keelhouse last closed.', ?4, 'Codex', 'error')",
                    params![chat_id, format!("recovery-{updated_at}"), ordinal, updated_at],
                )
                .map_err(db_error("Could not append interrupted chat status"))?;
        }
    }
    Ok(())
}

fn load_all_from(
    transaction: &Transaction<'_>,
) -> Result<BTreeMap<String, StoredChatConversation>, String> {
    let mut statement = transaction
        .prepare(
            "SELECT chat_id, provider, provider_thread_id, active_run_id, run_status,
                    usage_json, revision, updated_at
             FROM chat_conversations ORDER BY updated_at ASC",
        )
        .map_err(db_error("Could not prepare chat load"))?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                StoredChatConversation {
                    provider: row.get(1)?,
                    provider_thread_id: row.get(2)?,
                    active_run_id: row.get(3)?,
                    messages: Vec::new(),
                    run_status: row.get(4)?,
                    usage: row
                        .get::<_, Option<String>>(5)?
                        .and_then(|value| serde_json::from_str(&value).ok()),
                    revision: row.get(6)?,
                    updated_at: row.get(7)?,
                },
            ))
        })
        .map_err(db_error("Could not load chats"))?
        .filter_map(Result::ok)
        .collect::<Vec<_>>();
    drop(statement);

    let mut conversations = BTreeMap::new();
    for (chat_id, mut conversation) in rows {
        let mut messages = transaction
            .prepare(
                "SELECT message_id, role, text, timestamp, item_id, title, status, bookmarked
                 FROM chat_messages WHERE chat_id = ?1 ORDER BY ordinal ASC",
            )
            .map_err(db_error("Could not prepare chat message load"))?;
        conversation.messages = messages
            .query_map([&chat_id], |row| {
                Ok(StoredChatMessage {
                    id: row.get(0)?,
                    role: row.get(1)?,
                    text: row.get(2)?,
                    timestamp: row.get(3)?,
                    item_id: row.get(4)?,
                    title: row.get(5)?,
                    status: row.get(6)?,
                    bookmarked: row.get::<_, i64>(7)? != 0,
                })
            })
            .map_err(db_error("Could not load chat messages"))?
            .filter_map(Result::ok)
            .collect();
        conversations.insert(chat_id, conversation);
    }
    Ok(conversations)
}

#[tauri::command]
pub(crate) fn load_chat_conversations(
    state: tauri::State<'_, ChatStore>,
) -> Result<BTreeMap<String, StoredChatConversation>, String> {
    state.load_all()
}

#[tauri::command]
pub(crate) fn save_chat_conversation(
    state: tauri::State<'_, ChatStore>,
    chat_id: String,
    conversation: StoredChatConversation,
) -> Result<bool, String> {
    state.save(&chat_id, &conversation)
}

#[tauri::command]
pub(crate) fn search_chat_messages(
    state: tauri::State<'_, ChatStore>,
    query: String,
    bookmarks_only: bool,
    limit: Option<usize>,
) -> Result<Vec<ChatSearchResult>, String> {
    state.search(&query, bookmarks_only, limit.unwrap_or(60))
}

#[tauri::command]
pub(crate) fn migrate_chat_conversations(
    state: tauri::State<'_, ChatStore>,
    conversations: BTreeMap<String, StoredChatConversation>,
) -> Result<LegacyChatImportResult, String> {
    state.import_legacy(&conversations)
}

#[tauri::command]
pub(crate) fn delete_chat_conversation(
    state: tauri::State<'_, ChatStore>,
    chat_id: String,
) -> Result<(), String> {
    state.delete(&chat_id)
}

#[tauri::command]
pub(crate) fn delete_project_chat_conversations(
    state: tauri::State<'_, ChatStore>,
    project_path: String,
) -> Result<usize, String> {
    state.delete_project(&project_path)
}

#[tauri::command]
pub(crate) fn reset_chat_store(state: tauri::State<'_, ChatStore>) -> Result<(), String> {
    state.reset()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    fn store() -> ChatStore {
        ChatStore::from_connection(Connection::open_in_memory().unwrap()).unwrap()
    }

    fn conversation(text: &str, revision: i64) -> StoredChatConversation {
        StoredChatConversation {
            provider: "codex".into(),
            provider_thread_id: Some(format!("thread-{revision}")),
            active_run_id: None,
            messages: vec![StoredChatMessage {
                id: format!("message-{revision}"),
                role: "assistant".into(),
                text: text.into(),
                timestamp: 100 + revision,
                item_id: Some(format!("item-{revision}")),
                title: None,
                status: Some("complete".into()),
                bookmarked: false,
            }],
            updated_at: 100 + revision,
            revision,
            run_status: Some("complete".into()),
            usage: Some(serde_json::json!({"inputTokens": 3, "outputTokens": 4})),
        }
    }

    #[test]
    fn imports_legacy_chats_once_without_overwriting_newer_rows() {
        let store = store();
        let mut legacy = BTreeMap::new();
        legacy.insert("/repo\nchat-1".into(), conversation("legacy", 0));
        let first = store.import_legacy(&legacy).unwrap();
        assert_eq!(first.imported, 1);
        store
            .save("/repo\nchat-1", &conversation("newer", 2))
            .unwrap();
        let second = store.import_legacy(&legacy).unwrap();
        assert!(second.already_completed);
        assert_eq!(
            store.load_all().unwrap()["/repo\nchat-1"].messages[0].text,
            "newer"
        );
    }

    #[test]
    fn saves_conversations_transactionally_and_rejects_stale_revisions() {
        let store = store();
        store
            .save("/repo\nchat-1", &conversation("current", 2))
            .unwrap();
        assert!(!store
            .save("/repo\nchat-1", &conversation("stale", 1))
            .unwrap());
        {
            let connection = store.connection.lock().unwrap();
            connection
                .execute_batch(
                    "CREATE TRIGGER abort_chat_message BEFORE INSERT ON chat_messages
                     WHEN NEW.text = 'boom' BEGIN SELECT RAISE(ABORT, 'simulated interruption'); END;",
                )
                .unwrap();
        }
        assert!(store
            .save("/repo\nchat-1", &conversation("boom", 3))
            .is_err());
        assert_eq!(
            store.load_all().unwrap()["/repo\nchat-1"].messages[0].text,
            "current"
        );
    }

    #[test]
    fn cascade_delete_removes_messages() {
        let store = store();
        store
            .save("/repo\nchat-1", &conversation("hello", 1))
            .unwrap();
        store.delete("/repo\nchat-1").unwrap();
        let connection = store.connection.lock().unwrap();
        let count: i64 = connection
            .query_row("SELECT COUNT(*) FROM chat_messages", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn concurrent_chats_keep_independent_provider_and_usage_state() {
        let store = Arc::new(store());
        let threads = (1..=4)
            .map(|index| {
                let store = Arc::clone(&store);
                std::thread::spawn(move || {
                    store
                        .save(
                            &format!("/repo\nchat-{index}"),
                            &conversation(&format!("chat {index}"), index),
                        )
                        .unwrap();
                })
            })
            .collect::<Vec<_>>();
        for thread in threads {
            thread.join().unwrap();
        }
        let loaded = store.load_all().unwrap();
        assert_eq!(loaded.len(), 4);
        assert_eq!(
            loaded["/repo\nchat-4"].provider_thread_id.as_deref(),
            Some("thread-4")
        );
        assert_eq!(
            loaded["/repo\nchat-2"].usage.as_ref().unwrap()["outputTokens"],
            4
        );
    }

    #[test]
    fn interrupted_runs_recover_explicitly_on_load() {
        let store = store();
        let mut running = conversation("Working", 1);
        running.active_run_id = Some("run-1".into());
        running.run_status = Some("running".into());
        running.messages[0].role = "status".into();
        running.messages[0].status = Some("running".into());
        store.save("/repo\nchat-1", &running).unwrap();
        let recovered = store.load_all().unwrap();
        let chat = &recovered["/repo\nchat-1"];
        assert_eq!(chat.active_run_id, None);
        assert_eq!(chat.run_status.as_deref(), Some("interrupted"));
        assert_eq!(chat.messages[0].status.as_deref(), Some("error"));
        assert_eq!(
            chat.messages[0].text,
            "Interrupted when Keelhouse last closed."
        );
    }

    #[test]
    fn malformed_usage_rows_do_not_crash_startup() {
        let store = store();
        store
            .save("/repo\nchat-1", &conversation("hello", 1))
            .unwrap();
        {
            let connection = store.connection.lock().unwrap();
            connection
                .execute(
                    "UPDATE chat_conversations SET usage_json = '{bad json' WHERE chat_id = '/repo\nchat-1'",
                    [],
                )
                .unwrap();
        }
        assert_eq!(store.load_all().unwrap()["/repo\nchat-1"].usage, None);
    }

    #[test]
    fn search_returns_cross_project_snippets_and_persisted_bookmarks() {
        let store = store();
        let mut first = conversation("Authentication refresh race in token cache", 1);
        first.messages[0].bookmarked = true;
        store.save("/alpha\nchat-1", &first).unwrap();
        store
            .save(
                "/beta\nchat-2",
                &conversation("Authentication audit passed", 2),
            )
            .unwrap();
        let hits = store.search("authentication", false, 20).unwrap();
        assert_eq!(hits.len(), 2);
        assert!(hits[0].bookmarked);
        assert_eq!(hits[0].project_path, "/alpha");
        assert!(hits[0].snippet.contains("Authentication"));
        let bookmarks = store.search("", true, 20).unwrap();
        assert_eq!(bookmarks.len(), 1);
        assert_eq!(bookmarks[0].message_id, "message-1");
        assert!(store.load_all().unwrap()["/alpha\nchat-1"].messages[0].bookmarked);
    }

    #[test]
    fn upgrades_existing_message_schema_without_losing_history() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "CREATE TABLE chat_conversations (
                    chat_id TEXT PRIMARY KEY,
                    project_path TEXT NOT NULL,
                    session_id TEXT NOT NULL,
                    provider TEXT NOT NULL,
                    provider_thread_id TEXT,
                    active_run_id TEXT,
                    run_status TEXT NOT NULL DEFAULT 'idle',
                    usage_json TEXT,
                    revision INTEGER NOT NULL DEFAULT 0,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                 );
                 CREATE TABLE chat_messages (
                    chat_id TEXT NOT NULL REFERENCES chat_conversations(chat_id) ON DELETE CASCADE,
                    message_id TEXT NOT NULL,
                    ordinal INTEGER NOT NULL,
                    role TEXT NOT NULL,
                    text TEXT NOT NULL,
                    timestamp INTEGER NOT NULL,
                    item_id TEXT,
                    title TEXT,
                    status TEXT,
                    PRIMARY KEY(chat_id, message_id),
                    UNIQUE(chat_id, ordinal)
                 );
                 INSERT INTO chat_conversations (
                    chat_id, project_path, session_id, provider, run_status, revision, created_at, updated_at
                 ) VALUES ('/repo\nchat-1', '/repo', 'chat-1', 'codex', 'complete', 1, 1, 1);
                 INSERT INTO chat_messages (
                    chat_id, message_id, ordinal, role, text, timestamp, status
                 ) VALUES ('/repo\nchat-1', 'message-1', 0, 'assistant', 'kept history', 1, 'complete');",
            )
            .unwrap();

        let store = ChatStore::from_connection(connection).unwrap();
        let loaded = store.load_all().unwrap();
        assert_eq!(loaded["/repo\nchat-1"].messages[0].text, "kept history");
        assert!(!loaded["/repo\nchat-1"].messages[0].bookmarked);
        let connection = store.connection.lock().unwrap();
        let migration: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM chat_schema_migrations WHERE version = 2",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(migration, 1);
    }

    #[test]
    fn representative_history_search_stays_interactive() {
        let store = store();
        for chat in 0..100 {
            let mut item = conversation("seed", chat + 1);
            item.messages = (0..30)
                .map(|message| StoredChatMessage {
                    id: format!("message-{chat}-{message}"),
                    role: if message % 2 == 0 { "user" } else { "assistant" }.into(),
                    text: format!("Representative history item {message} for project {chat}; needle appears here"),
                    timestamp: chat * 100 + message,
                    item_id: None,
                    title: None,
                    status: Some("complete".into()),
                    bookmarked: message == 7,
                })
                .collect();
            store
                .save(&format!("/repo-{chat}\nchat-{chat}"), &item)
                .unwrap();
        }
        let started = std::time::Instant::now();
        let hits = store.search("needle", false, 60).unwrap();
        let elapsed = started.elapsed();
        assert_eq!(hits.len(), 60);
        assert!(elapsed.as_millis() < 500, "search took {elapsed:?}");
    }
}
