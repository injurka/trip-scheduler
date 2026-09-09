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
