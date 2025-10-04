import gradio as gr
import os
from PIL import Image
import torch
import requests
import subprocess
import tempfile 
from io import BytesIO

# Impor dari StablePy
from stablepy import BUILTIN_UPSCALERS, load_upscaler_model
from stablepy.face_restoration.main_face_restoration import (
    load_face_restoration_model,
    process_face_restoration,
)

# --- Fungsi utilitas dari skrip asli ---

def load_count_runs():
    if os.path.exists("count_runs.txt"):
        with open("count_runs.txt", "r") as file:
            return int(file.read().strip())
    return 0

def save_count_runs(count):
    with open("count_runs.txt", "w") as file:
        file.write(str(count))

count_runs = load_count_runs()

# Dictionary model upscaler
UPSCALER_DICT_GUI = {
    **{bu: bu for bu in BUILTIN_UPSCALERS if bu not in ["None", None]},
    "4xRealWebPhoto_v4_dat2": "https://github.com/Phhofm/models/releases/download/4xRealWebPhoto_v4_dat2/4xRealWebPhoto_v4_dat2.pth",
    "4xNomosWebPhoto_RealPLKSR": "https://github.com/Phhofm/models/releases/download/4xNomosWebPhoto_RealPLKSR/4xNomosWebPhoto_RealPLKSR.pth",
    "4xNomosWebPhoto_esrgan": "https://github.com/Phhofm/models/releases/download/4xNomosWebPhoto_esrgan/4xNomosWebPhoto_esrgan.pth",
    "4xNomos2_hq_mosr": "https://github.com/Phhofm/models/releases/download/4xNomos2_hq_mosr/4xNomos2_hq_mosr.pth",
    "4xDF2K_JPEG.pth": "https://huggingface.co/Lahhhalah/UpscalerModel/resolve/main/DF2K_JPEG.pth",
    "4xFaceUpDAT": "https://huggingface.co/Lahhhalah/UpscalerModel/resolve/main/4xFaceUpDAT.pth",
    "4xNomos2_realplksr_dysample": "https://github.com/Phhofm/models/releases/download/4xNomos2_realplksr_dysample/4xNomos2_realplksr_dysample.pth",
    "RealESRNet_x4plus": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.1/RealESRNet_x4plus.pth",
    "4x-UltraSharp": "https://huggingface.co/Shandypur/ESRGAN-4x-UltraSharp/resolve/main/4x-UltraSharp.pth",
    "8x_NMKD-Superscale_150000_G": "https://huggingface.co/uwg/upscaler/resolve/main/ESRGAN/8x_NMKD-Superscale_150000_G.pth",
    "4x_NMKD-Siax_200k": "https://huggingface.co/uwg/upscaler/resolve/main/ESRGAN/4x_NMKD-Siax_200k.pth",
    "4x_NMKD-Superscale-SP_178000_G": "https://huggingface.co/gemasai/4x_NMKD-Superscale-SP_178000_G/resolve/main/4x_NMKD-Superscale-SP_178000_G.pth",
    "4x_foolhardy_Remacri": "https://huggingface.co/FacehugmanIII/4x_foolhardy_Remacri/resolve/main/4x_foolhardy_Remacri.pth",
    "1xDeJPG_realplksr_otf": "https://github.com/Phhofm/models/releases/download/1xDeJPG_realplksr_otf/1xDeJPG_realplksr_otf.pth",
    "4xPurePhoto-RealPLSKR.pth": "https://github.com/starinspace/StarinspaceUpscale/releases/download/Models/4xPurePhoto-RealPLSKR.pth",
    "Remacri4xExtraSmoother": "https://huggingface.co/hollowstrawberry/upscalers-backup/resolve/main/ESRGAN/Remacri%204x%20ExtraSmoother.pth",
    "AnimeSharp4x": "https://huggingface.co/hollowstrawberry/upscalers-backup/resolve/main/ESRGAN/AnimeSharp%204x.pth",
    "lollypop": "https://huggingface.co/hollowstrawberry/upscalers-backup/resolve/main/ESRGAN/lollypop.pth",
    "RealisticRescaler4x": "https://huggingface.co/hollowstrawberry/upscalers-backup/resolve/main/ESRGAN/RealisticRescaler%204x.pth",
    "NickelbackFS4x": "https://huggingface.co/hollowstrawberry/upscalers-backup/resolve/main/ESRGAN/NickelbackFS%204x.pth",
    "Valar4x": "https://huggingface.co/halffried/gyre_upscalers/resolve/main/esrgan_valar_x4/4x_Valar_v1.pth",
    "HAT_GAN_SRx4": "https://huggingface.co/halffried/gyre_upscalers/resolve/main/hat_ganx4/Real_HAT_GAN_SRx4.safetensors",
    "HAT-L_SRx4": "https://huggingface.co/halffried/gyre_upscalers/resolve/main/hat_lx4/HAT-L_SRx4_ImageNet-pretrain.safetensors",
    "Ghibli_Grain": "https://huggingface.co/anonderpling/upscalers/resolve/main/ESRGAN/ghibli_grain.pth",
    "Detoon4x": "https://huggingface.co/anonderpling/upscalers/resolve/main/ESRGAN/4x_detoon_225k.pth",
}

directory_upscalers = 'upscalers_models'
os.makedirs(directory_upscalers, exist_ok=True)

def download_model(url, output_dir, progress=gr.Progress()):
    filename = url.split('/')[-1]
    output_path = os.path.join(output_dir, filename)
    if os.path.exists(output_path):
        progress(0, desc=f"File sudah ada: {output_path}")
        print(f"File sudah ada: {output_path}")
        return output_path
    
    progress(0, desc=f"Mengunduh {filename}...")
    print(f"Mengunduh {url} ke {output_path} dengan requests...")
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status() 
        total_size = int(response.headers.get('content-length', 0))
        downloaded_size = 0
        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                downloaded_size += len(chunk)
                if total_size:
                    progress_val = downloaded_size / total_size
                    progress(progress_val, desc=f"Mengunduh {filename}...")
        progress(1, desc=f"Unduhan selesai: {filename}")
        print(f"Unduhan selesai: {output_path}")
    except Exception as e:
        raise RuntimeError(f"Gagal mengunduh model dari {url}: {e}") from e
    return output_path

# --- Fungsi untuk menghitung dimensi gambar berdasarkan faktor skala ---
def get_calculated_dimensions(original_width, original_height, scale_factor, min_dim: int = 64):
    if scale_factor >= 1.0:
        return original_width, original_height
    
    if scale_factor <= 0.0:
        # Jika faktor skala 0 atau negatif, gunakan dimensi minimal
        return min_dim, min_dim 

    new_width_proportional = int(original_width * scale_factor)
    new_height_proportional = int(original_height * scale_factor)

    # Pastikan dimensi tidak jatuh di bawah min_dim, sambil mempertahankan rasio aspek
    if new_width_proportional < min_dim or new_height_proportional < min_dim:
        # Tentukan faktor skala yang diperlukan agar dimensi terkecil mencapai min_dim
        current_min_prop_dim = min(new_width_proportional, new_height_proportional)
        if current_min_prop_dim == 0: # Avoid division by zero if original_dim * scale_factor was 0
             scale_ratio = min_dim / 1 # Effectively scale to min_dim if proportional was 0
        else:
             scale_ratio = min_dim / current_min_prop_dim
        
        new_width = int(new_width_proportional * scale_ratio)
        new_height = int(new_height_proportional * scale_ratio)
    else:
        new_width = new_width_proportional
        new_height = new_height_proportional
    
    return new_width, new_height

# --- Fungsi downscale gambar dengan faktor skala ---
def downscale_image_by_factor(image: Image.Image, scale_factor: float, min_dim: int = 64, progress=gr.Progress()) -> Image.Image:
    original_width, original_height = image.size
    
    progress(0, desc="Menghitung dimensi baru...")

    if scale_factor >= 1.0: # Tidak ada downscaling jika faktor adalah 1.0 atau lebih
        progress(1, desc=f"Faktor skala {scale_factor:.2f} (>=1.0), tidak ada downscaling dilakukan.")
        return image

    calculated_width, calculated_height = get_calculated_dimensions(original_width, original_height, scale_factor, min_dim)

    # print(f"Gambar asli: {original_width}x{original_height}, Skala input: {scale_factor:.2f}, Downscaling ke: {calculated_width}x{calculated_height}")
    downscaled_img = image.resize((calculated_width, calculated_height), Image.LANCZOS)
    progress(1, desc="Downscaling selesai.")
    return downscaled_img


# --- Penyimpanan model global untuk aplikasi Gradio ---
global_face_restoration_model = None
global_upscaler_model_instance = None
global_current_upscaler_path = None
global_current_face_restorer_name = None
global_current_upscaler_config = {}

cl_device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Menggunakan: {'GPU' if cl_device == 'cuda' else 'CPU'}")

def load_models_cached(face_restoration_type, upscaler_name_key, upscaler_tile, upscaler_tile_overlap, upscaler_half, progress=gr.Progress()):
    global global_face_restoration_model, global_upscaler_model_instance, \
           global_current_upscaler_path, global_current_face_restorer_name, \
           global_current_upscaler_config

    # Muat Model Face Restoration
    if face_restoration_type != "Disabled":
        if global_face_restoration_model is None or global_current_face_restorer_name != face_restoration_type:
            # progress(0.1, desc=f"Memuat model restorasi wajah: {face_restoration_type}")
            print(f"Memuat model restorasi wajah: {face_restoration_type}")
            global_face_restoration_model = load_face_restoration_model(face_restoration_type, cl_device)
            global_current_face_restorer_name = face_restoration_type
            # progress(0.3, desc=f"Model restorasi wajah {face_restoration_type} dimuat.")
        else:
            # progress(0.3, desc=f"Model restorasi wajah {face_restoration_type} sudah dimuat.")
            print(f"Model restorasi wajah {face_restoration_type} sudah dimuat.")
    else:
        global_face_restoration_model = None
        global_current_face_restorer_name = None
        # progress(0.3, desc="Restorasi wajah dinonaktifkan.")

    # Muat Model Upscaler
    target_upscaler_path = UPSCALER_DICT_GUI[upscaler_name_key]
    if "https://" in str(target_upscaler_path):
        # progress(0.4, desc="Mengunduh model upscaler jika belum ada...")
        target_upscaler_path = download_model(target_upscaler_path, directory_upscalers, progress=gr.Progress())
        # progress(0.6, desc=f"Model upscaler {os.path.basename(target_upscaler_path)} tersedia.")

    current_upscaler_params_for_load = {
        'model': target_upscaler_path,
        'device': cl_device,
        'tile': upscaler_tile,
        'tile_overlap': upscaler_tile_overlap,
        'half': upscaler_half
    }

    if (global_upscaler_model_instance is None or
        global_current_upscaler_path != target_upscaler_path or
        global_current_upscaler_config != current_upscaler_params_for_load):

        # progress(0.7, desc=f"Memuat model upscaler: {upscaler_name_key} dengan konfigurasi baru.")
        print(f"Memuat model upscaler: {upscaler_name_key} dari {target_upscaler_path} dengan config: {current_upscaler_params_for_load}")
        global_upscaler_model_instance = load_upscaler_model(**current_upscaler_params_for_load)
        global_current_upscaler_path = target_upscaler_path
        global_current_upscaler_config = current_upscaler_params_for_load
        # progress(1, desc=f"Model upscaler {upscaler_name_key} dimuat.")
    else:
        # progress(1, desc=f"Model upscaler {upscaler_name_key} sudah dimuat dengan konfigurasi saat ini.")
        print(f"Model upscaler {upscaler_name_key} sudah dimuat dengan konfigurasi saat ini.")

    return global_face_restoration_model, global_upscaler_model_instance

# Fungsi pemrosesan tunggal (diperlukan untuk fungsi multi)
def process_single_image(
    input_image_path,
    downscale_factor_value,
    model_upscaler_key,
    scale_of_the_image_x,
    upscaler_tile,
    upscaler_tile_overlap,
    face_restoration_type,
    face_restoration_visibility,
    face_restoration_weight,
    upscaler_half,
    progress=gr.Progress()
):
    if cl_device == "cpu" and upscaler_half:
        upscaler_half = False
        print("Peringatan: Upscaler Presisi Setengah dinonaktifkan untuk CPU.")
        
    print("Memuat atau memeriksa model...")
    face_res_model, upscaler_instance = load_models_cached(
        face_restoration_type, model_upscaler_key, upscaler_tile, upscaler_tile_overlap, upscaler_half, progress=progress
    )

    img_original = Image.open(input_image_path).convert("RGB")
    
    # 1. Downscaling
    progress(0.1, desc="Memulai downscaling gambar...")
    img_for_processing = downscale_image_by_factor(img_original.copy(), downscale_factor_value, progress=gr.Progress())
    progress(0.2, desc="Downscaling selesai.")

    img_processed = img_for_processing.copy()

    # 2. Face Restoration
    if face_restoration_type != "Disabled" and face_res_model:
        progress(0.3, desc=f"Menerapkan restorasi wajah ({face_restoration_type})...")
        try:
            img_processed = process_face_restoration(
                img_processed,
                face_res_model,
                face_restoration_visibility,
                face_restoration_weight,
            )
            progress(0.5, desc="Restorasi wajah selesai.")
        except Exception as e:
            print(f"Error selama restorasi wajah: {e}. Melanjutkan dengan upscaling.")
            progress(0.5, desc="Restorasi wajah gagal. Melanjutkan.")
    else:
        progress(0.5, desc="Restorasi wajah dinonaktifkan.")

    # 3. Upscaling
    progress(0.6, desc=f"Upscaling gambar ({model_upscaler_key})...")
    upscaled_image = upscaler_instance.upscale(
        img_processed,
        scale_of_the_image_x,
    )
    progress(0.9, desc="Upscaling selesai.")
    
    # 4. Simpan hasil
    # Simpan gambar hasil upscale ke file sementara sebagai JPG
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp_file:
        upscaled_image_filepath = tmp_file.name
        # Kompresi gambar sebagai JPG dengan kualitas 90
        upscaled_image.save(upscaled_image_filepath, "JPEG", quality=90)
    
    global count_runs
    count_runs += 1
    save_count_runs(count_runs)
    print(f"Gambar berhasil diproses. Total pemrosesan: {count_runs}")
    progress(1, desc="Pemrosesan gambar selesai.")

    return upscaled_image_filepath, img_original, upscaled_image


# Fungsi pemrosesan utama untuk Gradio (Multiple Images)
def upscale_multiple_images(
    input_file_list,
    downscale_factor_value,
    model_upscaler_key,
    scale_of_the_image_x,
    upscaler_tile,
    upscaler_tile_overlap,
    face_restoration_type,
    face_restoration_visibility,
    face_restoration_weight,
    upscaler_half,
    progress=gr.Progress(track_tqdm=True)
):
    if not input_file_list:
        raise gr.Error("Mohon unggah setidaknya satu gambar.")

    results_paths = []
    
    num_images = len(input_file_list)
    print(f"Memulai pemrosesan untuk {num_images} gambar.")

    # Iterasi melalui setiap gambar yang diunggah
    for i, file_obj in enumerate(input_file_list):
        input_image_path = file_obj.name # Gradio File object memiliki properti .name (jalur file sementara)
        
        progress(0, desc=f"Gambar {i+1}/{num_images}: Memuat model dan memulai pemrosesan...")
        print(f"\n--- MEMPROSES GAMBAR {i+1} DARI {num_images}: {input_image_path} ---")

        # Panggil fungsi pemrosesan tunggal
        try:
            output_filepath, _, _ = process_single_image(
                input_image_path,
                downscale_factor_value,
                model_upscaler_key,
                scale_of_the_image_x,
                upscaler_tile,
                upscaler_tile_overlap,
                face_restoration_type,
                face_restoration_visibility,
                face_restoration_weight,
                upscaler_half,
                progress=gr.Progress(
                    track_tqdm=True, 
                    desc=f"Gambar {i+1}/{num_images}: Proses...")
            )
            results_paths.append(output_filepath)
            progress((i + 1) / num_images, desc=f"Selesai memproses Gambar {i+1}/{num_images}.")
        except Exception as e:
            print(f"Gagal memproses gambar {i+1} ({input_image_path}): {e}")
            gr.Warning(f"Gambar {i+1} gagal diproses. Melanjutkan ke gambar berikutnya.")
            # Masukkan None atau string error jika diperlukan, tetapi untuk output File, lebih baik hanya daftar path
            
    # Mengembalikan daftar jalur file hasil
    if not results_paths:
        raise gr.Error("Semua gambar gagal diproses.")
        
    print("Semua gambar selesai diproses.")
    return results_paths

# --- Definisi Antarmuka Gradio ---

with gr.Blocks() as demo:
    gr.Markdown("# Peningkat Gambar dan Restorasi Wajah (Multi-Input)")
    gr.Markdown("Unggah banyak gambar. Aplikasi akan memprosesnya satu per satu. Hasil akan dikembalikan sebagai file ZIP yang berisi semua gambar hasil upscaling (JPG).")
    gr.Markdown(f"**Perhatian: Saat ini berjalan di {cl_device.upper()}. Pemrosesan di CPU akan SANGAT lambat.**")

    with gr.Row():
        with gr.Column():
            # Mengubah input menjadi gr.File dengan file_count="multiple"
            file_input = gr.File(
                file_count="multiple", 
                type="filepath", 
                label="Unggah Gambar Input (Banyak File Diperbolehkan)",
                file_types=["image"]
            )
            
            # Slider Downscale (tetap per gambar)
            downscale_factor_slider = gr.Slider(
                minimum=0.0,
                maximum=1.0,
                step=0.01,
                label="Faktor Skala Input (0.0 = minimal, 1.0 = asli)",
                value=1.0,
                interactive=True
            )
            # Menghapus dim_display_textbox karena multi-input membuatnya tidak praktis

            # Input lainnya
            model_upscaler_dropdown = gr.Dropdown(choices=list(UPSCALER_DICT_GUI.keys()), label="Model Upscaler", value="RealESRNet_x4plus")
            scale_slider = gr.Slider(minimum=1, maximum=8, step=0.1, label="Faktor Skala Upscale (x)", value=4)
            upscaler_tile_slider = gr.Slider(minimum=0, maximum=512, step=16, label="Ukuran Tile Upscaler (0 untuk seluruh gambar)", value=192)
            upscaler_tile_overlap_slider = gr.Slider(minimum=0, maximum=48, step=1, label="Tumpang Tindih Tile Upscaler", value=8)
            face_restoration_dropdown = gr.Dropdown(choices=["Disabled", "CodeFormer", "GFPGAN", "RestoreFormer"], label="Restorasi Wajah", value="GFPGAN")
            face_restoration_visibility_slider = gr.Slider(minimum=0, maximum=1, step=0.01, label="Visibilitas Restorasi Wajah", value=0.6)
            face_restoration_weight_slider = gr.Slider(minimum=0, maximum=1, step=0.01, label="Bobot Restorasi Wajah", value=0.5)
            upscaler_half_checkbox = gr.Checkbox(label="Upscaler Presisi Setengah (dapat mempercepat di GPU)", value=False, interactive=cl_device == "cuda")

            submit_button = gr.Button("Proses Semua Gambar")

        with gr.Column():
            gr.Markdown("## Hasil Pemrosesan Batch")
            # Mengubah output menjadi gr.Files (perhatikan 's' di akhir) untuk daftar file
            download_output_files = gr.Files(label="Unduh File Hasil Upscale (akan menjadi file ZIP)", interactive=False)
    
    # Menghapus interaksi dinamis untuk dimensi karena multi-input

    # Menjalankan fungsi utama saat tombol submit ditekan
    submit_button.click(
        fn=upscale_multiple_images,
        inputs=[
            file_input,
            downscale_factor_slider,
            model_upscaler_dropdown,
            scale_slider,
            upscaler_tile_slider,
            upscaler_tile_overlap_slider,
            face_restoration_dropdown,
            face_restoration_visibility_slider,
            face_restoration_weight_slider,
            upscaler_half_checkbox,
        ],
        outputs=[download_output_files]
    )


# Luncurkan aplikasi Gradio
if __name__ == "__main__":
    demo.launch(share=True, debug=True, inline=False)
