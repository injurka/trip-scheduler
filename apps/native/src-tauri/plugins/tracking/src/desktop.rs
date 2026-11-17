use tauri::{AppHandle, Runtime};
use crate::models::*;
use crate::Result;

pub struct Tracking<R: Runtime>(std::marker::PhantomData<fn() -> R>);

pub fn init<R: Runtime>(_app: &AppHandle<R>, _api: tauri::plugin::PluginApi<R, ()>) -> Result<Tracking<R>> {
    Ok(Tracking(std::marker::PhantomData))
}

impl<R: Runtime> Tracking<R> {
    pub fn start_tracking(&self, _owner_id: String, _session_id: String) -> Result<bool> {
        Ok(true)
    }

    pub fn set_tracking_mode(&self, _mode: String) -> Result<bool> { Ok(true) }
    pub fn sync_tracking_now(&self) -> Result<u32> { Ok(0) }
    pub fn configure_tracking(&self, _config: Option<serde_json::Value>) -> Result<bool> { Ok(true) }
    pub fn get_local_tracking_points(&self, _owner_id: String, _from: i64, _until: i64) -> Result<Vec<LocationRecord>> { Ok(vec![]) }

    pub fn stop_tracking(&self) -> Result<bool> {
        Ok(true)
    }

    pub fn is_tracking_running(&self) -> Result<bool> {
        Ok(false)
    }

    pub fn get_buffered_locations(&self, _owner_id: String) -> Result<Vec<LocationRecord>> {
        Ok(vec![])
    }

    pub fn acknowledge_buffered_locations(&self, _client_point_ids: Vec<String>, _owner_id: String) -> Result<bool> {
        Ok(true)
    }

    pub fn get_push_token(&self) -> Result<String> {
        Err(crate::Error::Generic("FCM push is available only on Android".to_string()))
    }

    pub fn check_permissions(&self) -> Result<TrackingPermissionsStatus> {
        Ok(TrackingPermissionsStatus {
            recording_mode: "standard".into(), sampling_interval_ms: 3000, battery_used_mah: None, unsent_count: 0, native_sync_configured: false, native_syncing: false, native_sync_error: None, last_sync_at: None,
            owner_id: None, session_id: None, session_started_at: None, damaged_records: 0, storage_error: None, pending_writes: 0, legacy_queue_preserved: false, last_saved_ts_utc: None,
            location: true,
            notifications: true,
            battery_optimizations_ignored: true,
            activity_recognition: true,
        })
    }

    pub fn request_notification_permission(&self) -> Result<bool> {
        Ok(true)
    }

    pub fn request_activity_permission(&self) -> Result<bool> {
        Ok(true)
    }

    pub fn request_ignore_battery_optimizations(&self) -> Result<bool> {
        Ok(true)
    }

    pub fn open_app_settings(&self) -> Result<bool> {
        Ok(true)
    }

    pub fn set_system_bars_theme(&self, _payload: SystemBarsThemePayload) -> Result<bool> {
        Ok(true)
    }

    pub fn open_kmz_in_maps_me(&self, payload: OpenKmzPayload) -> Result<OpenKmzResult> {
        Ok(OpenKmzResult {
            file_name: payload.file_name,
            downloads_path: None,
            status: "desktop_saved".to_string(),
            message: "Файл успешно подготовлен".to_string(),
        })
    }
}
