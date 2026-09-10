const COMMANDS: &[&str] = &[
    "start_tracking",
    "stop_tracking",
    "is_tracking_running",
    "get_buffered_locations",
    "check_permissions",
    "request_notification_permission",
    "request_ignore_battery_optimizations",
    "request_activity_permission",
    "open_app_settings",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .build();
}
