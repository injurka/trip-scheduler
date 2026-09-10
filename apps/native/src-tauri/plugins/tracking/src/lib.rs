use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

mod commands;
mod error;
mod models;

pub use error::{Error, Result};
pub use models::*;

#[cfg(desktop)]
pub use desktop::Tracking;
#[cfg(mobile)]
pub use mobile::Tracking;

pub trait TrackingExt<R: Runtime> {
    fn tracking(&self) -> &Tracking<R>;
}

impl<R: Runtime, T: Manager<R>> crate::TrackingExt<R> for T {
    fn tracking(&self) -> &Tracking<R> {
        self.state::<Tracking<R>>().inner()
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("tracking")
        .invoke_handler(tauri::generate_handler![
            commands::start_tracking,
            commands::stop_tracking,
            commands::is_tracking_running,
            commands::get_buffered_locations,
            commands::check_permissions,
            commands::request_notification_permission,
            commands::request_ignore_battery_optimizations,
            commands::request_activity_permission,
            commands::open_app_settings,
            commands::set_system_bars_theme,
        ])
        .setup(|app, api| {
            #[cfg(mobile)]
            let tracking = mobile::init(app, api)?;
            #[cfg(desktop)]
            let tracking = desktop::init(app, api)?;
            app.manage(tracking);
            Ok(())
        })
        .build()
}
