use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{Emitter, Manager};

static WATCHER: Mutex<Option<RecommendedWatcher>> = Mutex::new(None);

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileInfo {
    pub path: String,
    pub name: String,
    pub content: String,
    pub size: u64,
    pub modified: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecentFile {
    pub path: String,
    pub name: String,
    pub last_opened: u64,
    pub pinned: bool,
}

const MAX_FILE_SIZE: u64 = 10 * 1024 * 1024; // 10MB

fn read_content(path: &std::path::Path) -> Result<String, String> {
    // Try UTF-8 first
    if let Ok(content) = fs::read_to_string(path) {
        return Ok(content);
    }

    let bytes = fs::read(path).map_err(|e| format!("Cannot read file: {e}"))?;

    // Check for binary content
    if bytes.iter().take(512).any(|&b| b == 0) {
        return Err("Binary file detected".to_string());
    }

    // Try UTF-16 LE
    if bytes.len() >= 2 && bytes[0] == 0xFF && bytes[1] == 0xFE {
        let utf16: Vec<u16> = bytes[2..]
            .chunks_exact(2)
            .map(|c| u16::from_le_bytes([c[0], c[1]]))
            .collect();
        return String::from_utf16(&utf16).map_err(|_| "UTF-16 decode failed".to_string());
    }

    // Try UTF-16 BE
    if bytes.len() >= 2 && bytes[0] == 0xFE && bytes[1] == 0xFF {
        let utf16: Vec<u16> = bytes[2..]
            .chunks_exact(2)
            .map(|c| u16::from_be_bytes([c[0], c[1]]))
            .collect();
        return String::from_utf16(&utf16).map_err(|_| "UTF-16 decode failed".to_string());
    }

    Err("Encoding not recognized".to_string())
}

fn read_file_impl(path: &str) -> Result<FileInfo, String> {
    let path = PathBuf::from(path)
        .canonicalize()
        .map_err(|e| format!("Invalid path: {e}"))?;

    let metadata = fs::metadata(&path).map_err(|e| format!("Cannot read file: {e}"))?;

    if metadata.len() > MAX_FILE_SIZE {
        return Err("File exceeds 10MB limit".to_string());
    }

    let content = read_content(&path)?;

    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown.md".to_string());

    let modified = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);

    Ok(FileInfo {
        path: path.to_string_lossy().to_string(),
        name,
        content,
        size: metadata.len(),
        modified,
    })
}

#[tauri::command]
pub async fn open_file_dialog(app: tauri::AppHandle) -> Result<FileInfo, String> {
    use tauri_plugin_dialog::DialogExt;

    let result = app
        .dialog()
        .file()
        .add_filter("Markdown", &["md", "markdown"])
        .blocking_pick_file();

    match result {
        Some(file_path) => read_file_impl(&file_path.to_string()),
        None => Err("No file selected".to_string()),
    }
}

#[tauri::command]
pub async fn read_file(path: String) -> Result<FileInfo, String> {
    read_file_impl(&path)
}

#[tauri::command]
pub async fn save_file(path: String, content: String) -> Result<(), String> {
    let path = PathBuf::from(&path)
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from(&path));

    fs::write(&path, &content).map_err(|e| format!("Cannot write file: {e}"))
}

#[tauri::command]
pub async fn save_file_dialog(
    app: tauri::AppHandle,
    content: String,
    suggested_name: String,
) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;

    let result = app
        .dialog()
        .file()
        .add_filter("Markdown", &["md", "markdown"])
        .set_file_name(&suggested_name)
        .blocking_save_file();

    match result {
        Some(file_path) => {
            let path = file_path.to_string();
            fs::write(&path, &content).map_err(|e| format!("Cannot write file: {e}"))?;
            Ok(path)
        }
        None => Err("No file selected".to_string()),
    }
}

#[tauri::command]
pub async fn get_recent_files() -> Vec<RecentFile> {
    let path = recent_files_path();
    match fs::read_to_string(&path) {
        Ok(json) => serde_json::from_str(&json).unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

#[tauri::command]
pub async fn update_recent_file(path: String, pinned: Option<bool>) {
    let mut files = get_recent_files().await;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    if let Some(existing) = files.iter_mut().find(|f| f.path == path) {
        existing.last_opened = now;
        if let Some(pinned) = pinned {
            existing.pinned = pinned;
        }
    } else {
        let name = PathBuf::from(&path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "unknown.md".to_string());
        files.push(RecentFile {
            path,
            name,
            last_opened: now,
            pinned: pinned.unwrap_or(false),
        });
    }

    files.truncate(50);
    files.sort_by(|a, b| b.pinned.cmp(&a.pinned).then(b.last_opened.cmp(&a.last_opened)));

    let rp = recent_files_path();
    if let Some(parent) = rp.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = serde_json::to_string_pretty(&files).map(|json| fs::write(&rp, json));
}

#[tauri::command]
pub async fn remove_recent_file(path: String) {
    let mut files = get_recent_files().await;
    files.retain(|f| f.path != path);
    let rp = recent_files_path();
    let _ = serde_json::to_string_pretty(&files).map(|json| fs::write(&rp, json));
}

fn recent_files_path() -> PathBuf {
    let appdata = std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(appdata).join("markdown-editor").join("recent.json")
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub modified: u64,
    pub children: Vec<FileEntry>,
}

fn scan_dir(dir: &std::path::Path) -> Result<Vec<FileEntry>, String> {
    let entries = fs::read_dir(dir).map_err(|e| format!("Cannot read directory: {e}"))?;
    let mut result: Vec<FileEntry> = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {e}"))?;
        let path = entry.path();
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        let is_dir = path.is_dir();
        let modified = entry
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);

        // Skip hidden files/folders
        if name.starts_with('.') {
            continue;
        }

        if is_dir {
            match scan_dir(&path) {
                Ok(children) => {
                    let has_md = children.iter().any(|c| !c.is_dir && c.name.ends_with(".md"))
                        || children.iter().any(|c| !c.is_dir && c.name.ends_with(".markdown"));
                    // Only include directories that contain markdown files
                    if !children.is_empty() && (has_md || children.iter().any(|c| c.is_dir && !c.children.is_empty())) {
                        result.push(FileEntry {
                            name,
                            path: path.to_string_lossy().to_string(),
                            is_dir: true,
                            modified,
                            children,
                        });
                    }
                }
                Err(_) => {}
            }
        } else if name.ends_with(".md") || name.ends_with(".markdown") {
            result.push(FileEntry {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir: false,
                modified,
                children: vec![],
            });
        }
    }

    // Sort: directories first, then by name
    result.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.to_lowercase().cmp(&b.name.to_lowercase())));
    Ok(result)
}

#[tauri::command]
pub async fn list_folder(path: String) -> Result<Vec<FileEntry>, String> {
    let dir = PathBuf::from(&path);
    if !dir.is_dir() {
        // If path is a file, use its parent directory
        if let Some(parent) = dir.parent() {
            scan_dir(parent)
        } else {
            Err("Not a valid directory".to_string())
        }
    } else {
        scan_dir(&dir)
    }
}

#[tauri::command]
pub async fn start_watch(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let app_handle = app.clone();
    let watch_path = path.clone();

    let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        if let Ok(event) = res {
            match event.kind {
                EventKind::Modify(_) => {
                    if let Ok(content) = fs::read_to_string(&watch_path) {
                        let _ = app_handle.emit("file-changed", serde_json::json!({
                            "path": &watch_path,
                            "content": content,
                        }));
                    }
                }
                EventKind::Remove(_) => {
                    let _ = app_handle.emit("file-removed", serde_json::json!({
                        "path": &watch_path,
                    }));
                }
                _ => {}
            }
        }
    })
    .map_err(|e| format!("Watch setup failed: {e}"))?;

    watcher
        .watch(PathBuf::from(&path).as_path(), RecursiveMode::NonRecursive)
        .map_err(|e| format!("Watch failed: {e}"))?;

    let mut guard = WATCHER.lock().map_err(|e| format!("Lock error: {e}"))?;
    *guard = Some(watcher);

    Ok(())
}

#[tauri::command]
pub async fn stop_watch() -> Result<(), String> {
    let mut guard = WATCHER.lock().map_err(|e| format!("Lock error: {e}"))?;
    *guard = None;
    Ok(())
}

#[tauri::command]
pub async fn close_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        // destroy() bypasses CloseRequested event to avoid re-triggering the save dialog
        window.destroy().map_err(|e| format!("{e}"))?;
    }
    Ok(())
}
