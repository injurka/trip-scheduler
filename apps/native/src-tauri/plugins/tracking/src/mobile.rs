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
}
