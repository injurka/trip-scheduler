use std::fs;
use std::path::{Path, PathBuf};

use tauri::Manager;
#[cfg(desktop)]
use tauri_plugin_dialog::DialogExt;

/// Приложение запущено под Hyprland (или другим специфичным окружением) —
/// оставлено по аналогии с insight-book как точка для платформенных хаков UI.
#[tauri::command]
fn is_hyprland() -> bool {
    std::env::var("HYPRLAND_INSTANCE_SIGNATURE").is_ok()
        || std::env::var("XDG_CURRENT_DESKTOP")
            .map(|v| v.to_lowercase().contains("hyprland"))
            .unwrap_or(false)
}

/// Настройки vault хранятся в app-config dir (аналог Electron userData/vault-settings.json).
fn settings_file(app: &tauri::AppHandle) -> PathBuf {
    let dir = app.path().app_config_dir().unwrap_or_else(|_| std::env::temp_dir());
    let _ = fs::create_dir_all(&dir);
    dir.join("vault-settings.json")
}

fn read_vault_path(app: &tauri::AppHandle) -> Option<String> {
    let file = settings_file(app);
    let data = fs::read_to_string(file).ok()?;
    let parsed = serde_json::from_str::<serde_json::Value>(&data).ok()?;
    let saved = parsed.get("vaultPath")?.as_str()?.to_string();
    if !Path::new(&saved).exists() {
        return None;
    }
    Some(saved)
}

fn write_vault_path(app: &tauri::AppHandle, vault_path: &str) {
    let payload = serde_json::json!({ "vaultPath": vault_path });
    let _ = fs::write(settings_file(app), payload.to_string());
}

#[tauri::command]
fn vault_get_path(app: tauri::AppHandle) -> Option<String> {
    read_vault_path(&app)
}

/// Диалог выбора папки существует только на десктопе: в tauri-plugin-dialog
/// pick_folder/blocking_pick_folder объявлены под #[cfg(desktop)].
#[cfg(desktop)]
fn pick_vault_folder(app: &tauri::AppHandle) -> Option<String> {
    app.dialog()
        .file()
        .set_title("Выберите папку для хранения фотографий")
        .blocking_pick_folder()
        .map(|p| p.to_string())
}

/// На мобильных SAF-диалога выбора папки в плагине нет, а URI content://
/// несовместим с std::fs, которым работают остальные vault-команды.
/// Используем приватную папку приложения — она всегда доступна для записи.
#[cfg(mobile)]
fn pick_vault_folder(app: &tauri::AppHandle) -> Option<String> {
    let dir = app.path().app_local_data_dir().ok()?.join("vault");
    fs::create_dir_all(&dir).ok()?;
    Some(dir.display().to_string())
}

#[tauri::command]
async fn vault_select_folder(app: tauri::AppHandle) -> Option<String> {
    let path = pick_vault_folder(&app)?;
    write_vault_path(&app, &path);
    Some(path)
}

/// Безопасное сопоставление относительного пути внутри корня vault.
/// Защищает от Path Traversal, абсолютных путей и выхода за пределы корня хранилища.
fn safe_vault_path(root_str: &str, rel: &str) -> Result<PathBuf, String> {
    let rel_path = Path::new(rel);
    if rel_path.is_absolute() || rel.contains("..") {
        return Err("Invalid path".to_string());
    }

    let mut clean_rel = PathBuf::new();
    for comp in rel_path.components() {
        match comp {
            std::path::Component::Normal(c) => clean_rel.push(c),
            _ => return Err("Invalid path component".to_string()),
        }
    }

    if clean_rel.as_os_str().is_empty() {
        return Err("Empty path".to_string());
    }

    let root = Path::new(root_str);
    let target = root.join(clean_rel);

    if !target.starts_with(root) {
        return Err("Path traversal detected".to_string());
    }

    Ok(target)
}

/// Проверка существования файлов в vault (аналог Electron IPC vault:check-files).
#[tauri::command]
fn vault_check_files(app: tauri::AppHandle, relative_paths: Vec<String>) -> Vec<String> {
    let Some(root) = read_vault_path(&app) else {
        return vec![];
    };

    relative_paths
        .into_iter()
        .filter(|rel| {
            safe_vault_path(&root, rel).map(|p| p.is_file()).unwrap_or(false)
        })
        .collect()
}

/// Скачивание файла с сервера в vault (аналог Electron IPC vault:download-file).
#[tauri::command]
async fn vault_download_file(
    app: tauri::AppHandle,
    url: String,
    relative_path: String,
) -> Result<bool, String> {
    let root = read_vault_path(&app).ok_or_else(|| "Vault not set".to_string())?;
    let dest = safe_vault_path(&root, &relative_path)?;

    let dir = dest
        .parent()
        .ok_or_else(|| "Invalid destination".to_string())?;
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;

    let bytes = reqwest::get(&url)
        .await
        .map_err(|e| format!("Network error: {e}"))?
        .error_for_status()
        .map_err(|e| format!("Status: {e}"))?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    fs::write(&dest, &bytes).map_err(|e| e.to_string())?;
    log::info!("[Vault] Saved: {} ({} bytes)", dest.display(), bytes.len());
    Ok(true)
}

#[tauri::command]
fn vault_delete_file(app: tauri::AppHandle, relative_path: String) {
    let Some(root) = read_vault_path(&app) else {
        return;
    };
    if let Ok(target) = safe_vault_path(&root, &relative_path) {
        let _ = fs::remove_file(target);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_geolocation::init())
        .invoke_handler(tauri::generate_handler![
            is_hyprland,
            vault_get_path,
            vault_select_folder,
            vault_check_files,
            vault_download_file,
            vault_delete_file
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
