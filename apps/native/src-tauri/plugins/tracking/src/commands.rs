use tauri::{command, AppHandle, Runtime};
use crate::{models::*, Result, TrackingExt};

#[command]
pub(crate) async fn start_tracking<R: Runtime>(app: AppHandle<R>) -> Result<bool> {
    app.tracking().start_tracking()
}

#[command]
pub(crate) async fn stop_tracking<R: Runtime>(app: AppHandle<R>) -> Result<bool> {
    app.tracking().stop_tracking()
}

#[command]
pub(crate) async fn is_tracking_running<R: Runtime>(app: AppHandle<R>) -> Result<bool> {
    app.tracking().is_tracking_running()
}

#[command]
pub(crate) async fn get_buffered_locations<R: Runtime>(app: AppHandle<R>) -> Result<Vec<LocationRecord>> {
    app.tracking().get_buffered_locations()
}

#[command]
pub(crate) async fn check_permissions<R: Runtime>(app: AppHandle<R>) -> Result<TrackingPermissionsStatus> {
    app.tracking().check_permissions()
}

#[command]
pub(crate) async fn request_notification_permission<R: Runtime>(app: AppHandle<R>) -> Result<bool> {
    app.tracking().request_notification_permission()
}

#[command]
pub(crate) async fn request_ignore_battery_optimizations<R: Runtime>(app: AppHandle<R>) -> Result<bool> {
    app.tracking().request_ignore_battery_optimizations()
}

#[command]
pub(crate) async fn request_activity_permission<R: Runtime>(app: AppHandle<R>) -> Result<bool> {
    app.tracking().request_activity_permission()
}

#[command]
pub(crate) async fn open_app_settings<R: Runtime>(app: AppHandle<R>) -> Result<bool> {
    app.tracking().open_app_settings()
}

#[command]
pub(crate) async fn set_system_bars_theme<R: Runtime>(
    app: AppHandle<R>,
    payload: SystemBarsThemePayload,
) -> Result<bool> {
    app.tracking().set_system_bars_theme(payload)
}

