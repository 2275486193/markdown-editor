mod commands;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::open_file_dialog,
            commands::read_file,
            commands::save_file,
            commands::save_file_dialog,
            commands::get_recent_files,
            commands::update_recent_file,
            commands::remove_recent_file,
            commands::start_watch,
            commands::stop_watch,
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            window.set_title("Markdown Editor")?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
