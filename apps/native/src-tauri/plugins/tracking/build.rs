const COMMANDS: &[&str] = &[
    "start_tracking",
    "stop_tracking",
    "is_tracking_running",
    "get_buffered_locations",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .build();
}
