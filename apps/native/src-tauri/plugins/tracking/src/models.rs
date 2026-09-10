use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocationRecord {
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

