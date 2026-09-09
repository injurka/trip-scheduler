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
}
