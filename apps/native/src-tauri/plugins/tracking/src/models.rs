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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackingPermissionsStatus {
    pub location: bool,
    pub notifications: bool,
    pub battery_optimizations_ignored: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemBarsThemePayload {
    pub is_dark: bool,
    pub status_bar_color: Option<String>,
    pub navigation_bar_color: Option<String>,
}

