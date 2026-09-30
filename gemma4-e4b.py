# @title 🤖 Gemma-4-E4B Heretic Q6_K • GPU-1 only • Vision • Cloudflare • Background
# @markdown ---
# Kaggle: model di /kaggle/tmp • hanya GPU kedua (CUDA_VISIBLE_DEVICES=1) • server jalan di background
# FIX: CUDA_VISIBLE_DEVICES hanya di-set di subprocess llama-server,
#      TIDAK global di notebook → ComfyUI tetap bisa pakai GPU 0.
Context_Size_Option = "131072"  # @param ["16384","32768","65536","131072"]
Action = "Start"  # @param ["Start","Stop"]
# ========== MODEL ==========
MODEL_REPO = "llmfan46/gemma-4-E4B-it-ultra-uncensored-heretic-GGUF"
MODEL_FILENAME = "gemma-4-E4B-it-ultra-uncensored-heretic-Q6_K.gguf"
MMPROJ_FILENAME = "gemma-4-E4B-it-mmproj-BF16.gguf"
Batch_Size = 2048
UBatch_Size = 2048
Startup_Timeout = 300
import atexit, base64, ctypes, gc, json, os, re, secrets, shutil, signal, socket, subprocess, tarfile, threading, time
from pathlib import Path
import requests
from huggingface_hub import hf_hub_download
from IPython.display import HTML, clear_output, display
# =========================================================
# CONFIG - KAGGLE
# =========================================================
ROOT = Path("/kaggle/tmp/gemma4_e4b_gpu1")
MODELS, RUNTIME, LOGS = [ROOT / x for x in ("models", "runtime", "logs")]
for p in (MODELS, RUNTIME, LOGS):
    p.mkdir(parents=True, exist_ok=True)
CTX = int(Context_Size_Option)
REPO = MODEL_REPO.strip()
MODEL = MODEL_FILENAME.strip()
MMPROJ = MMPROJ_FILENAME.strip()
MODEL_PATH = MODELS / MODEL
MMPROJ_PATH = MODELS / MMPROJ
MODEL_ID = Path(MODEL).stem
# ========== SAMPLING (Google Gemma 4 recommended) ==========
TEMP, TOP_P, TOP_K, MIN_P = 1.0, 0.95, 64, 0.0
PRESENCE_PENALTY = 0.0
REPEAT_PENALTY = 1.0
SERVER_LOG = LOGS / "server.log"
CF_LOG = LOGS / "cloudflared.log"
API_KEY = globals().get("API_KEY") or secrets.token_urlsafe(24)
server_proc = globals().get("server_proc")
tunnel_proc = globals().get("tunnel_proc")
server_log_file = None
cf_log_file = None
server_port = None
public_url = None
log_thread = None
log_stop = None
TQ_REPO = "XueJie1/llama.cpp-turboquant-cuda"
TQ_API = f"https://api.github.com/repos/{TQ_REPO}/releases/latest"
# GPU fisik yang dipakai llama.cpp (1 = GPU kedua di Kaggle dual-GPU)
LLAMA_GPU_INDEX = "1"
# =========================================================
# BASIC UTIL
# =========================================================
def status(text, kind="info"):
    c = {"info": "#2563eb", "ok": "#16a34a", "warn": "#d97706", "bad": "#dc2626"}
    display(HTML(f'<b style="color:{c.get(kind, c["info"])}">● {text}</b>'))
def tail(path, n=250):
    try:
        return "".join(path.read_text(errors="replace").splitlines(True)[-n:])
    except Exception:
        return ""
def free_port(a=8080, b=8120):
    for p in range(a, b):
        try:
            with socket.socket() as s:
                s.bind(("127.0.0.1", p))
                return p
        except OSError:
            pass
    raise RuntimeError("Tidak ada port kosong.")
def gpu():
    r = subprocess.run(
        ["nvidia-smi", "--query-gpu=name,memory.total,memory.used,memory.free", "--format=csv,noheader,nounits"],
        capture_output=True, text=True, timeout=15
    )
    if r.returncode:
        raise RuntimeError("nvidia-smi gagal.")
    return [
        dict(zip(("name", "total", "used", "free"), [x.strip() for x in l.split(",")]))
        for l in r.stdout.strip().splitlines()
    ]
def find_exe(root, name):
    p = next((x for x in root.rglob(name) if x.is_file()), None)
    if p:
        try:
            p.chmod(0o755)
        except Exception:
            pass
    return p
def flag(h, *names):
    return next(
        (x for x in names if x in h or re.search(rf"(?m)^\s*{re.escape(x)}(?:\s|,|$)", h)),
        None
    )
def add(cmd, h, names, val=None):
    f = flag(h, *names)
    if f:
        cmd.append(f) if val is None else cmd.extend([f, str(val)])
    return f
# =========================================================
# ENV HELPERS — CUDA_VISIBLE_DEVICES HANYA di subprocess
# =========================================================
def base_env():
    """Environment dasar (LD_LIBRARY_PATH dll) TANPA membatasi GPU."""
    e = os.environ.copy()
    # Pastikan tidak ada sisa CUDA_VISIBLE_DEVICES dari run sebelumnya
    e.pop("CUDA_VISIBLE_DEVICES", None)
    return e

def llama_env():
    """
    Environment khusus untuk proses llama-server.
    Hanya GPU fisik index LLAMA_GPU_INDEX yang terlihat → menjadi CUDA:0 di dalam proses.
    Notebook / ComfyUI TIDAK terpengaruh.
    """
    e = base_env()
    e["CUDA_VISIBLE_DEVICES"] = LLAMA_GPU_INDEX
    return e

def prepare_ld_library_path(env_dict):
    """Tambah path library TurboQuant / CUDA ke env_dict."""
    libs = []
    for n in (
        "libggml-cuda.so",
        "libggml.so",
        "libcudart.so",
        "libcublas.so",
        "libcublasLt.so",
    ):
        libs += [str(p.parent) for p in RUNTIME.rglob(n)]
    libs += [
        "/usr/local/cuda/lib64",
        "/usr/local/nvidia/lib64",
        "/usr/lib/x86_64-linux-gnu",
    ]
    if x := env_dict.get("LD_LIBRARY_PATH"):
        libs.append(x)
    env_dict["LD_LIBRARY_PATH"] = ":".join(dict.fromkeys(x for x in libs if x))
    return env_dict
# =========================================================
# LOG STREAM
# =========================================================
def log_stream():
    global log_stop
    pos = 0
    while not log_stop.is_set():
        try:
            if SERVER_LOG.exists():
                with open(SERVER_LOG, "r", errors="replace") as f:
                    f.seek(pos)
                    while True:
                        line = f.readline()
                        if not line:
                            break
                        print(f"[llama.cpp] {line.rstrip()}", flush=True)
                    pos = f.tell()
        except Exception:
            pass
        log_stop.wait(0.25)
def start_log_stream():
    global log_thread, log_stop
    stop_log_stream()
    log_stop = threading.Event()
    log_thread = threading.Thread(target=log_stream, daemon=True)
    log_thread.start()
def stop_log_stream():
    global log_thread, log_stop
    if log_stop:
        log_stop.set()
    if log_thread:
        try:
            log_thread.join(timeout=2)
        except Exception:
            pass
    log_thread = None
    log_stop = None
# =========================================================
# PROCESS / DEEP CLEAN
# =========================================================
def close_logs():
    global server_log_file, cf_log_file
    stop_log_stream()
    for f in (server_log_file, cf_log_file):
        if f:
            try:
                f.flush()
            except Exception:
                pass
            try:
                f.close()
            except Exception:
                pass
    server_log_file = None
    cf_log_file = None
def stop_proc(p):
    if not p:
        return
    try:
        if p.poll() is None:
            try:
                os.killpg(os.getpgid(p.pid), signal.SIGTERM)
            except Exception:
                try:
                    p.terminate()
                except Exception:
                    pass
            try:
                p.wait(5)
            except Exception:
                try:
                    os.killpg(os.getpgid(p.pid), signal.SIGKILL)
                except Exception:
                    try:
                        p.kill()
                    except Exception:
                        pass
    except Exception:
        pass
def deep_clean():
    global server_proc, tunnel_proc, server_port, public_url
    print("\n========================================")
    print("🧹 DEEP CLEAN")
    print("========================================")
    stop_proc(tunnel_proc)
    stop_proc(server_proc)
    tunnel_proc = None
    server_proc = None
    server_port = None
    public_url = None
    close_logs()
    for _ in range(3):
        gc.collect()
    try:
        libc = ctypes.CDLL("libc.so.6")
        libc.malloc_trim(0)
    except Exception:
        pass
    try:
        import torch
        if torch.cuda.is_available():
            for i in range(torch.cuda.device_count()):
                try:
                    with torch.cuda.device(i):
                        torch.cuda.synchronize()
                        torch.cuda.empty_cache()
                        if hasattr(torch.cuda, "ipc_collect"):
                            torch.cuda.ipc_collect()
                except Exception:
                    pass
    except Exception:
        pass
    for _ in range(2):
        gc.collect()
    try:
        libc = ctypes.CDLL("libc.so.6")
        libc.malloc_trim(0)
    except Exception:
        pass
    time.sleep(1)
    print("✅ llama-server dihentikan")
    print("✅ Cloudflare dihentikan")
    print("✅ Python GC selesai")
    print("✅ libc malloc_trim selesai")
    print("✅ CUDA cache dibersihkan")
    print("✅ VRAM llama.cpp dilepas")
    try:
        print("\n========== GPU AFTER CLEAN ==========")
        for g in gpu():
            print(f"GPU: {g['name']} | VRAM {g['free']}/{g['total']} MiB free")
    except Exception:
        pass
def stop_all():
    deep_clean()
if not globals().get("_gemma_atexit"):
    atexit.register(stop_all)
    _gemma_atexit = True
# =========================================================
# DOWNLOAD
# =========================================================
def download_url(url, dst):
    if dst.exists() and dst.stat().st_size:
        return dst
    status(f"Downloading {dst.name}...")
    with requests.get(url, stream=True, timeout=300) as r:
        r.raise_for_status()
        with open(dst, "wb") as f:
            for ch in r.iter_content(8 * 1024 * 1024):
                if ch:
                    f.write(ch)
    return dst
def get_file(repo, name, dst):
    p = Path(hf_hub_download(repo, name, local_dir=str(MODELS)))
    if p != dst:
        try:
            if dst.exists():
                dst.unlink()
            p.replace(dst)
        except Exception:
            pass
    return dst
# =========================================================
# RUNTIME
# =========================================================
def runtime():
    llama = find_exe(RUNTIME, "llama-server")
    meta = ROOT / "runtime.json"
    try:
        info = requests.get(TQ_API, timeout=30).json()
        asset = next(
            (a for a in info.get("assets", []) if a.get("name", "").endswith("-amd64.tar.gz")),
            None
        )
        if not asset:
            raise RuntimeError("TurboQuant amd64 asset tidak ditemukan.")
        latest = {
            "name": asset["name"],
            "url": asset["browser_download_url"]
        }
        current = json.loads(meta.read_text()) if meta.exists() else {}
        if llama and current.get("name") == latest["name"]:
            return llama
        arc = ROOT / latest["name"]
        if not arc.exists():
            download_url(latest["url"], arc)
        status("Extracting TurboQuant...")
        for p in RUNTIME.iterdir():
            try:
                shutil.rmtree(p) if p.is_dir() else p.unlink()
            except Exception:
                pass
        with tarfile.open(arc, "r:gz") as t:
            try:
                t.extractall(RUNTIME, filter="data")
            except TypeError:
                t.extractall(RUNTIME)
        meta.write_text(json.dumps(latest))
        llama = find_exe(RUNTIME, "llama-server")
    except Exception as e:
        if not llama:
            raise RuntimeError(f"Gagal menyiapkan TurboQuant: {e}")
    if not llama:
        raise RuntimeError("llama-server tidak ditemukan.")
    return llama

def helptext(llama, env_dict):
    r = subprocess.run(
        [str(llama), "--help"],
        capture_output=True,
        text=True,
        timeout=30,
        env=env_dict
    )
    return r.stdout or r.stderr or ""

def devices(llama, h, env_dict):
    if not flag(h, "--list-devices"):
        return ""
    r = subprocess.run(
        [str(llama), "--list-devices"],
        capture_output=True,
        text=True,
        timeout=30,
        env=env_dict
    )
    return (r.stdout or r.stderr or "").strip()
# =========================================================
# COMMAND (Single GPU = GPU kedua saja, dari sudut pandang subprocess)
# =========================================================
def build(llama, h, dev, port, ctx):
    cmd = [
        str(llama),
        "-m", str(MODEL_PATH),
        "--host", "127.0.0.1",
        "--port", str(port),
        "-c", str(ctx),
        "-np", "1",
        "-b", str(Batch_Size),
        "-ub", str(UBatch_Size),
    ]
    # Vision
    if MMPROJ_PATH.exists():
        cmd += ["--mmproj", str(MMPROJ_PATH)]
    add(cmd, h, ("--flash-attn", "-fa"), "on")
    # KV cache turbo4 jika binary mendukung
    k = flag(h, "--cache-type-k", "-ctk")
    v = flag(h, "--cache-type-v", "-ctv")
    if k and v:
        cmd += [k, "turbo4", v, "turbo4"]
    # ========== SINGLE GPU (yang terlihat di subprocess = GPU fisik kedua) ==========
    # Karena CUDA_VISIBLE_DEVICES=1 di env subprocess, GPU fisik 1 → CUDA:0
    add(cmd, h, ("--n-gpu-layers", "-ngl"), 999)
    add(cmd, h, ("--main-gpu", "-mg"), 0)
    # Tidak ada --split-mode / --tensor-split
    # ================================================================
    # mmproj device
    if f := flag(h, "--mmproj-device"):
        ds = re.findall(r"CUDA\d+", dev, re.I)
        if ds:
            cmd += [f, ds[0].upper()]
    elif f := flag(h, "--mmproj-offload"):
        cmd.append(f)
    add(cmd, h, ("--alias",), MODEL_ID)
    add(cmd, h, ("--api-key",), API_KEY)
    add(cmd, h, ("--temp",), TEMP)
    add(cmd, h, ("--top-p",), TOP_P)
    add(cmd, h, ("--top-k",), TOP_K)
    add(cmd, h, ("--min-p",), MIN_P)
    add(cmd, h, ("--repeat-penalty", "--repeat_penalty"), REPEAT_PENALTY)
    add(cmd, h, ("--presence-penalty",), PRESENCE_PENALTY)
    add(cmd, h, ("--reasoning-format",), "auto")
    add(cmd, h, ("--jinja",))
    if f := flag(h, "--reasoning"):
        cmd += [f, "on"]
    return cmd
# =========================================================
# SERVER
# =========================================================
def wait_ready(port, proc):
    end = time.time() + Startup_Timeout
    while time.time() < end:
        if not proc or proc.poll() is not None:
            return False
        log = tail(SERVER_LOG, 120)
        if re.search(
            r"segmentation fault|sigabrt|sigsegv|cudaMalloc failed|"
            r"out of memory|failed to allocate|GGML_ASSERT|"
            r"unknown projector|mismatch between text model|"
            r"clip_model_loader|mtmd_init_from_file",
            log,
            re.I
        ):
            return False
        try:
            r = requests.get(f"http://127.0.0.1:{port}/health", timeout=2)
            if r.status_code == 200:
                return True
        except Exception:
            pass
        time.sleep(1.2)
    return False

def start_backend(llama, h, dev, ctx, env_dict):
    global server_proc, server_port, server_log_file
    stop_proc(server_proc)
    server_proc = None
    close_logs()
    server_port = free_port()
    cmd = build(llama, h, dev, server_port, ctx)
    SERVER_LOG.write_text("")
    server_log_file = open(SERVER_LOG, "w", buffering=1)
    # PENTING: env_dict sudah berisi CUDA_VISIBLE_DEVICES=1
    # Notebook process TIDAK terpengaruh → ComfyUI tetap lihat semua GPU
    server_proc = subprocess.Popen(
        cmd,
        stdout=server_log_file,
        stderr=subprocess.STDOUT,
        env=env_dict,
        start_new_session=True
    )
    start_log_stream()
    if not wait_ready(server_port, server_proc):
        log = tail(SERVER_LOG, 400)
        stop_proc(server_proc)
        server_proc = None
        raise RuntimeError(log[-8000:])
    return cmd
# =========================================================
# VISION TEST
# =========================================================
def test_vision(port):
    try:
        from PIL import Image, ImageDraw
        p = ROOT / "vision_test.jpg"
        im = Image.new("RGB", (320, 320), "white")
        d = ImageDraw.Draw(im)
        d.rectangle((40, 40, 280, 280), fill="#1e40af")
        d.ellipse((90, 80, 230, 220), fill="#fbbf24")
        d.text((95, 250), "VISION TEST", fill="black")
        im.save(p, "JPEG", quality=92)
        b = base64.b64encode(p.read_bytes()).decode()
        body = {
            "model": MODEL_ID,
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "text", "text": "Describe this image briefly in one sentence."},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b}"}}
                ]
            }],
            "temperature": 0.2,
            "max_tokens": 96,
            "stream": False
        }
        r = requests.post(
            f"http://127.0.0.1:{port}/v1/chat/completions",
            headers={"Authorization": f"Bearer {API_KEY}"},
            json=body,
            timeout=180
        )
        if r.status_code != 200:
            return False, f"HTTP {r.status_code}: {r.text[:2500]}"
        j = r.json()
        msg = (j.get("choices") or [{}])[0].get("message", {})
        c = msg.get("content") or msg.get("reasoning_content") or ""
        if isinstance(c, list):
            c = "".join(x.get("text", "") for x in c if isinstance(x, dict))
        return bool(str(c).strip()), str(c).strip()[:1200]
    except Exception as e:
        return False, repr(e)
# =========================================================
# CLOUDFLARE
# =========================================================
def cloudflared():
    p = ROOT / "cloudflared"
    if not p.exists():
        download_url(
            "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64",
            p
        )
    p.chmod(0o755)
    return p
def tunnel(cf, port):
    global tunnel_proc, cf_log_file
    CF_LOG.write_text("")
    cf_log_file = open(CF_LOG, "w", buffering=1)
    # cloudflared tidak butuh GPU; pakai base_env agar bersih
    tunnel_proc = subprocess.Popen(
        [str(cf), "tunnel", "--url", f"http://127.0.0.1:{port}"],
        stdout=cf_log_file,
        stderr=subprocess.STDOUT,
        env=base_env(),
        start_new_session=True
    )
    end = time.time() + 35
    while time.time() < end:
        m = re.search(r"https://[a-z0-9-]+\.trycloudflare\.com", tail(CF_LOG, 150), re.I)
        if m:
            return m.group(0).rstrip("/") + "/v1"
        if tunnel_proc.poll() is not None:
            break
        time.sleep(1)
    return None
# =========================================================
# START (background — cell selesai setelah ready)
# =========================================================
def start_server():
    global public_url
    stop_all()
    clear_output(wait=True)

    # ============================================================
    # FIX UTAMA:
    # JANGAN set os.environ["CUDA_VISIBLE_DEVICES"] secara global.
    # Hanya set di env dict yang dikirim ke subprocess llama-server.
    # Dengan begitu notebook + ComfyUI tetap melihat semua GPU (0 dan 1).
    # ============================================================
    # Hapus sisa CUDA_VISIBLE_DEVICES dari session sebelumnya (jika ada)
    os.environ.pop("CUDA_VISIBLE_DEVICES", None)

    print(
        "========== GEMMA-4-E4B HERETIC Q6_K • GPU-1 ONLY • VISION ==========\n"
        "Kaggle mode | Model dir: /kaggle/tmp | CUDA_VISIBLE_DEVICES=1 HANYA di subprocess llama\n"
        "Notebook / ComfyUI TIDAK dibatasi → bisa pakai GPU 0"
    )
    try:
        for i, g in enumerate(gpu()):
            print(f"GPU fisik {i}: {g['name']} | VRAM {g['free']}/{g['total']} MiB free")
    except Exception as e:
        print("nvidia-smi:", e)
    print(
        f"Model        : {MODEL}\n"
        f"MMProj       : {MMPROJ}\n"
        f"Context      : {CTX:,}\n"
        f"KV Cache     : TURBO4 (jika didukung)\n"
        f"Batch/UBatch : {Batch_Size}/{UBatch_Size}\n"
        f"Temp/TopP/K  : {TEMP}/{TOP_P}/{TOP_K}\n"
        f"Presence/Rep : {PRESENCE_PENALTY}/{REPEAT_PENALTY}\n"
        f"Vision       : ON\n"
        f"GPU llama    : hanya GPU fisik {LLAMA_GPU_INDEX} (via env subprocess)\n"
        f"Mode         : BACKGROUND (cell selesai, server tetap hidup)\n"
        f"Storage      : {ROOT}"
    )
    status("Checking model...")
    get_file(REPO, MODEL, MODEL_PATH)
    status("Checking MMProj (vision)...")
    try:
        get_file(REPO, MMPROJ, MMPROJ_PATH)
    except Exception as e:
        status(f"MMProj gagal: {e} — coba nama alternatif", "warn")
        for alt in ("mmproj-BF16.gguf", "mmproj-F16.gguf", "mmproj-F32.gguf", "mmproj.gguf"):
            try:
                get_file(REPO, alt, MMPROJ_PATH)
                status(f"MMProj ditemukan: {alt}", "ok")
                break
            except Exception:
                pass

    llama = runtime()

    # Siapkan env khusus llama (CUDA_VISIBLE_DEVICES=1 + LD_LIBRARY_PATH)
    env_dict = prepare_ld_library_path(llama_env())

    h = helptext(llama, env_dict)
    dev = devices(llama, h, env_dict)
    print("\n========== DEVICES (di dalam subprocess CUDA_VISIBLE_DEVICES=1) ==========\n" + (dev or "Unavailable"))
    print("(Di sini hanya 1 GPU yang terlihat = GPU fisik kedua → CUDA:0)")

    candidates = list(dict.fromkeys([CTX, 65536, 32768, 16384]))
    backend = None
    selected_ctx = None
    for ctx in candidates:
        print(f"\n========== START CTX={ctx:,} ==========")
        try:
            cmd = start_backend(llama, h, dev, ctx, env_dict)
            print("✅ Server ready")
            ok, res = test_vision(server_port)
            if ok:
                print("✅ Vision test PASSED")
                print("Response:", res)
            else:
                print("⚠️ Vision test failed / skipped:", res)
            backend = cmd
            selected_ctx = ctx
            break
        except Exception as e:
            print("❌", e)
        stop_proc(server_proc)
    if backend is None:
        raise RuntimeError("Tidak ada context yang berhasil.\n\n" + tail(SERVER_LOG, 400))
    cf = cloudflared()
    status("Creating Cloudflare Tunnel...")
    public_url = tunnel(cf, server_port)
    if not public_url:
        raise RuntimeError("Cloudflare Tunnel gagal.")
    print(
        "\n========================================\n"
        "   ✅ GEMMA-4-E4B HERETIC READY (GPU-1 • BACKGROUND)\n"
        "========================================"
    )
    print(
        f"OpenAI Base URL : {public_url}\n"
        f"API Key         : {API_KEY}\n"
        f"Model           : {MODEL_ID}\n"
        f"Context         : {selected_ctx:,}\n"
        f"KV              : TURBO4 (jika didukung)\n"
        f"Vision          : ON\n"
        f"Sampling        : T={TEMP} P={TOP_P} K={TOP_K}\n"
        f"GPU llama       : CUDA_VISIBLE_DEVICES={LLAMA_GPU_INDEX} (hanya di subprocess)\n"
        f"Notebook GPU    : TIDAK dibatasi (ComfyUI bisa pakai GPU 0)\n"
        f"Mode            : BACKGROUND — cell ini selesai, server tetap jalan"
    )
    try:
        print("\n========== GPU STATUS (setelah start) ==========")
        for i, x in enumerate(gpu()):
            print(f"GPU fisik {i}: {x['name']} | used {x['used']}/{x['total']} MiB | free {x['free']} MiB")
    except Exception:
        pass
    display(HTML(f"""
        <hr>
        <div style="padding:8px">
            <b>Hermes / OpenAI Base URL</b><br>
            <code>{public_url}</code>
        </div>
        <div style="padding:8px">
            <b>API Key</b><br>
            <code>{API_KEY}</code>
        </div>
        <div style="padding:8px">
            <b>Gemma-4-E4B Settings (Google recommended)</b><br>
            <code>
            temperature={TEMP}, top_p={TOP_P}, top_k={TOP_K}, min_p={MIN_P}<br>
            presence_penalty={PRESENCE_PENALTY}, repeat_penalty={REPEAT_PENALTY}<br>
            ubatch={UBatch_Size}, batch={Batch_Size}<br>
            GPU llama = hanya GPU fisik {LLAMA_GPU_INDEX} (via subprocess env)<br>
            Notebook / ComfyUI = tidak dibatasi (bisa pakai GPU 0)<br>
            Mode = BACKGROUND (jalankan cell lain bebas)
            </code>
        </div>
        <div style="padding:8px;color:#16a34a">
            <b>🟢 Server berjalan di background.</b><br>
            Untuk stop: set Action = "Stop" lalu jalankan ulang cell ini.
        </div>
        <div style="padding:8px;color:#2563eb">
            <b>💡 Tips ComfyUI:</b><br>
            Jalankan ComfyUI di cell lain. Karena notebook tidak dibatasi GPU,<br>
            ComfyUI akan otomatis pakai GPU 0 (yang kosong). Atau set eksplisit:<br>
            <code>os.environ["CUDA_VISIBLE_DEVICES"] = "0"</code> sebelum start ComfyUI.
        </div>
    """))
    # Simpan state agar cell lain / Action=Stop bisa akses
    globals()["server_proc"] = server_proc
    globals()["tunnel_proc"] = tunnel_proc
    globals()["server_port"] = server_port
    globals()["public_url"] = public_url
    globals()["API_KEY"] = API_KEY
# =========================================================
# MAIN
# =========================================================
if Action == "Start":
    try:
        start_server()
        # TIDAK ada keep_alive() → cell selesai, proses tetap hidup di background
        print("\n✅ Cell selesai. Server + Cloudflare tetap aktif di background.")
        print("   Jalankan cell lain sesuka hati. Stop lewat Action='Stop'.")
        print("   ComfyUI di cell lain akan melihat GPU 0 (tidak terpengaruh).")
    except KeyboardInterrupt:
        print("\n🛑 Cell dihentikan user.")
        deep_clean()
    except Exception as e:
        status(f"GAGAL: {e}", "bad")
        deep_clean()
else:
    stop_all()
