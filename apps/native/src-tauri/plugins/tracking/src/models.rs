use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocationRecord {
    pub owner_id: Option<String>,
    pub session_id: Option<String>,
    pub client_point_id: Option<String>,
    pub latitude: f64,
    pub longitude: f64,
    pub accuracy: Option<f32>,
    pub altitude: Option<f64>,
    pub speed: Option<f32>,
    pub heading: Option<f32>,
    pub timestamp: i64,
    /// Активность от Activity Recognition («still» / «walk» / «bike» / «vehicle»).
    /// Отсутствует, если устройство её не сообщило — это нормальный случай, а не ошибка.
    #[serde(default)]
    pub activity: Option<String>,
    #[serde(default)]
    pub activity_confidence: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackingPermissionsStatus {
    pub owner_id: Option<String>,
    pub session_id: Option<String>,
    pub storage_error: Option<String>,
    #[serde(default)]
    pub pending_writes: u32,
    #[serde(default)]
    pub legacy_queue_preserved: bool,
    pub last_saved_ts_utc: Option<i64>,
    pub location: bool,
    pub notifications: bool,
    pub battery_optimizations_ignored: bool,
    /// Разрешение на распознавание активности (Android 10+). Старые сборки плагина это
    /// поле не присылают — считаем разрешение выданным, иначе статус был бы ложным.
    #[serde(default = "default_true")]
    pub activity_recognition: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemBarsThemePayload {
    pub is_dark: bool,
    pub status_bar_color: Option<String>,
    pub navigation_bar_color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallApkPayload {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenKmzPayload {
    pub file_name: String,
    pub base64_data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenKmzResult {
    pub file_name: String,
    pub downloads_path: Option<String>,
    pub status: String,
    pub message: String,
}
