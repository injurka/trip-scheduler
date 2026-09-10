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
    #[cfg(mobile)]
    {
        if let Some(saved) = read_vault_path(&app) {
            return Some(saved);
        }
        if let Some(path) = pick_vault_folder(&app) {
            write_vault_path(&app, &path);
            return Some(path);
        }
        None
    }
    #[cfg(desktop)]
    {
        read_vault_path(&app)
    }
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

#[derive(Clone, serde::Serialize)]
struct DownloadProgressPayload {
    downloaded: u64,
    total: Option<u64>,
    percentage: f32,
    done: bool,
    path: Option<String>,
}

#[tauri::command]
async fn download_app_update(
    app: tauri::AppHandle,
    url: String,
    filename: Option<String>,
) -> Result<String, String> {
    use futures_util::StreamExt;
    use std::io::Write;
    use tauri::Emitter;

    let target_dir = app
        .path()
        .app_cache_dir()
        .or_else(|_| app.path().app_local_data_dir())
        .map_err(|e| e.to_string())?;

    let updates_dir = target_dir.join("updates");
    fs::create_dir_all(&updates_dir).map_err(|e| e.to_string())?;

    let file_name = filename.unwrap_or_else(|| "update.apk".to_string());
    let dest_path = updates_dir.join(&file_name);

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header(reqwest::header::USER_AGENT, "TripScheduler-App")
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?
        .error_for_status()
        .map_err(|e| format!("Status error: {e}"))?;

    let total_size = response.content_length();
    let mut downloaded: u64 = 0;

    let mut file = fs::File::create(&dest_path).map_err(|e| e.to_string())?;
    let mut stream = response.bytes_stream();

    let _ = app.emit(
        "app-update://progress",
        DownloadProgressPayload {
            downloaded: 0,
            total: total_size,
            percentage: 0.0,
            done: false,
            path: None,
        },
    );

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Error downloading chunk: {e}"))?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;

        let percentage = match total_size {
            Some(total) if total > 0 => {
                ((downloaded as f64 / total as f64) * 100.0) as f32
            }
            _ => 0.0,
        };

        let _ = app.emit(
            "app-update://progress",
            DownloadProgressPayload {
                downloaded,
                total: total_size,
                percentage,
                done: false,
                path: None,
            },
        );
    }

    file.flush().map_err(|e| e.to_string())?;

    let final_path = dest_path.display().to_string();

    let _ = app.emit(
        "app-update://progress",
        DownloadProgressPayload {
            downloaded,
            total: total_size,
            percentage: 100.0,
            done: true,
            path: Some(final_path.clone()),
        },
    );

    Ok(final_path)
}

#[tauri::command]
async fn open_downloaded_apk(app: tauri::AppHandle, path: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_path(path, None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn tracking_start(app: tauri::AppHandle) -> Result<bool, String> {
    use tauri_plugin_tracking::TrackingExt;
    app.tracking().start_tracking().map_err(|e| e.to_string())
}

#[tauri::command]
async fn tracking_stop(app: tauri::AppHandle) -> Result<bool, String> {
    use tauri_plugin_tracking::TrackingExt;
    app.tracking().stop_tracking().map_err(|e| e.to_string())
}

#[tauri::command]
async fn tracking_is_running(app: tauri::AppHandle) -> Result<bool, String> {
    use tauri_plugin_tracking::TrackingExt;
    app.tracking().is_tracking_running().map_err(|e| e.to_string())
}

#[tauri::command]
async fn tracking_get_buffered(
    app: tauri::AppHandle,
) -> Result<Vec<tauri_plugin_tracking::LocationRecord>, String> {
    use tauri_plugin_tracking::TrackingExt;
    app.tracking().get_buffered_locations().map_err(|e| e.to_string())
}

#[tauri::command]
async fn tracking_check_permissions(
    app: tauri::AppHandle,
) -> Result<tauri_plugin_tracking::TrackingPermissionsStatus, String> {
    use tauri_plugin_tracking::TrackingExt;
    app.tracking().check_permissions().map_err(|e| e.to_string())
}

#[tauri::command]
async fn tracking_request_notification_permission(
    app: tauri::AppHandle,
) -> Result<bool, String> {
    use tauri_plugin_tracking::TrackingExt;
    app.tracking().request_notification_permission().map_err(|e| e.to_string())
}

#[tauri::command]
async fn tracking_request_ignore_battery_optimizations(
    app: tauri::AppHandle,
) -> Result<bool, String> {
    use tauri_plugin_tracking::TrackingExt;
    app.tracking().request_ignore_battery_optimizations().map_err(|e| e.to_string())
}

#[tauri::command]
async fn tracking_open_app_settings(
    app: tauri::AppHandle,
) -> Result<bool, String> {
    use tauri_plugin_tracking::TrackingExt;
    app.tracking().open_app_settings().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_geolocation::init())
        .plugin(tauri_plugin_tracking::init())
        .invoke_handler(tauri::generate_handler![
            is_hyprland,
            vault_get_path,
            vault_select_folder,
            vault_check_files,
            vault_download_file,
            vault_delete_file,
            download_app_update,
            open_downloaded_apk,
            tracking_start,
            tracking_stop,
            tracking_is_running,
            tracking_get_buffered,
            tracking_check_permissions,
            tracking_request_notification_permission,
            tracking_request_ignore_battery_optimizations,
            tracking_open_app_settings
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
