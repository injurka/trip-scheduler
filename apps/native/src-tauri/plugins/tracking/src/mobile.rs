use tauri::{plugin::PluginHandle, AppHandle, Runtime};
use crate::models::*;
use crate::Result;

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "ru.tripscheduler.tracking";

pub fn init<R: Runtime>(
    _app: &AppHandle<R>,
    api: tauri::plugin::PluginApi<R, ()>,
) -> Result<Tracking<R>> {
    #[cfg(target_os = "android")]
    let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "TrackingPlugin")?;
    #[cfg(target_os = "ios")]
    let handle = unimplemented!();
    Ok(Tracking(handle))
}

pub struct Tracking<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> Tracking<R> {
    pub fn start_tracking(&self) -> Result<bool> {
        self.0.run_mobile_plugin("startTracking", ()).map_err(Into::into)
    }

    pub fn stop_tracking(&self) -> Result<bool> {
        self.0.run_mobile_plugin("stopTracking", ()).map_err(Into::into)
    }

    pub fn is_tracking_running(&self) -> Result<bool> {
        self.0.run_mobile_plugin("isTrackingRunning", ()).map_err(Into::into)
    }

    pub fn get_buffered_locations(&self) -> Result<Vec<LocationRecord>> {
        self.0.run_mobile_plugin("getBufferedLocations", ()).map_err(Into::into)
    }

    pub fn check_permissions(&self) -> Result<TrackingPermissionsStatus> {
        self.0.run_mobile_plugin("checkPermissions", ()).map_err(Into::into)
    }

    pub fn request_notification_permission(&self) -> Result<bool> {
        self.0.run_mobile_plugin("requestNotificationPermission", ()).map_err(Into::into)
    }

    pub fn request_ignore_battery_optimizations(&self) -> Result<bool> {
        self.0.run_mobile_plugin("requestIgnoreBatteryOptimizations", ()).map_err(Into::into)
    }

    pub fn open_app_settings(&self) -> Result<bool> {
        self.0.run_mobile_plugin("openAppSettings", ()).map_err(Into::into)
    }

    pub fn set_system_bars_theme(&self, payload: SystemBarsThemePayload) -> Result<bool> {
        self.0.run_mobile_plugin("setSystemBarsTheme", payload).map_err(Into::into)
    }
}
