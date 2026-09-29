use percent_encoding::percent_decode_str;
use tauri::ipc::{InvokeBody, Request};
use tauri_plugin_dialog::DialogExt;

/// Shows a native "Save as" dialog and writes the raw request body to the chosen file.
/// The frontend sends the file name (`x-file-name`, percent-encoded) and a comma-separated
/// list of extensions (`x-extensions`) as headers. Returns `false` if the dialog was cancelled.
#[tauri::command]
fn save_file_bytes(app: tauri::AppHandle, request: Request<'_>) -> Result<bool, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("expected a raw byte body".into());
    };

    let header = |name: &str| {
        request
            .headers()
            .get(name)
            .and_then(|value| value.to_str().ok())
            .unwrap_or_default()
    };
    let file_name = percent_decode_str(header("x-file-name")).decode_utf8_lossy();
    let extensions: Vec<&str> = header("x-extensions")
        .split(',')
        .filter(|ext| !ext.is_empty())
        .collect();

    let mut dialog = app.dialog().file().set_file_name(file_name.as_ref());
    if !extensions.is_empty() {
        dialog = dialog.add_filter("Files", &extensions);
    }

    let Some(picked) = dialog.blocking_save_file() else {
        return Ok(false);
    };
    let path = picked.into_path().map_err(|e| e.to_string())?;
    std::fs::write(path, bytes).map_err(|e| e.to_string())?;
    Ok(true)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![save_file_bytes])
        .run(tauri::generate_context!())
        .expect("error while running Sprite Sheet Packer");
}
