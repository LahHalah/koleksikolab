import os

# Path ComfyUI di Kaggle
comfy_path = "/kaggle/working/ComfyUI"
custom_nodes_dir = os.path.join(comfy_path, "custom_nodes")
fix_file = os.path.join(custom_nodes_dir, "fix_memfd.py")

# Buat folder custom_nodes kalau belum ada
os.makedirs(custom_nodes_dir, exist_ok=True)

# Isi file fix
content = '''import os
import sys
import tempfile
import uuid
import comfy.anonymous_file as af

_original = af.create_anonymous_file

def create_anonymous_file_safe(size=0):
    size = af.operator.index(size)
    if size < 0 or size > 0x7fffffffffffffff:
        raise ValueError("size must fit a nonnegative signed 64-bit file offset")

    if os.name == "nt":
        return _original(size)

    if hasattr(os, "memfd_create"):
        file = open("aimdo", "w+b", buffering=0,
                    opener=lambda name, mode: os.memfd_create(name, os.MFD_CLOEXEC))
    else:
        # Pakai NamedTemporaryFile supaya otomatis dihapus saat close
        file = tempfile.NamedTemporaryFile(prefix="aimdo-", suffix=".tmp", delete=True, mode="w+b", buffering=0)

    try:
        file.truncate(size)
        return file
    except BaseException:
        file.close()
        raise

af.create_anonymous_file = create_anonymous_file_safe
print("[fix_memfd] Patched create_anonymous_file (auto-delete temp file)")
'''

# Tulis file
with open(fix_file, "w") as f:
    f.write(content)

print(f"✅ File berhasil dibuat: {fix_file}")
print("Silakan restart ComfyUI agar patch aktif.")
