use tauri::{AppHandle, Runtime};
use crate::models::*;
use crate::Result;

pub struct Tracking<R: Runtime>(std::marker::PhantomData<fn() -> R>);

pub fn init<R: Runtime>(_app: &AppHandle<R>, _api: tauri::plugin::PluginApi<R, ()>) -> Result<Tracking<R>> {
    Ok(Tracking(std::marker::PhantomData))
}

impl<R: Runtime> Tracking<R> {
    pub fn start_tracking(&self) -> Result<bool> {
        Ok(true)
    }

    pub fn stop_tracking(&self) -> Result<bool> {
        Ok(true)
    }

    pub fn is_tracking_running(&self) -> Result<bool> {
        Ok(false)
    }

    pub fn get_buffered_locations(&self) -> Result<Vec<LocationRecord>> {
        Ok(vec![])
    }

    pub fn check_permissions(&self) -> Result<TrackingPermissionsStatus> {
        Ok(TrackingPermissionsStatus {
            location: true,
            notifications: true,
            battery_optimizations_ignored: true,
        })
    }

    pub fn request_notification_permission(&self) -> Result<bool> {
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
}
