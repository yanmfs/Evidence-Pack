mod error;
mod export;
mod import;
mod prepare;
mod store;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(prepare::CancelFlag::default())
        .invoke_handler(tauri::generate_handler![
            store::list_projects,
            store::read_project,
            store::write_project,
            store::delete_project,
            store::read_project_file,
            import::import_files,
            prepare::prepare_images,
            prepare::cancel_prepare,
            export::save_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running EvidencePack");
}
