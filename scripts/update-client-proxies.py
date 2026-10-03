"""Rebuild legacy ZIP patches using the shared backend-routing source (Python 3)."""
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ARCHIVES = ("client.zip", "client v12.zip", "client v13.zip")
template = (ROOT / "client/proxy-routing.mjs").read_text(encoding="utf-8")
template = re.sub(r"^export ", "", template, flags=re.MULTILINE)
helper = (ROOT / "client/proxy-helper.mjs").read_bytes()

for name in ARCHIVES:
    archive = ROOT / name
    entries = []
    with zipfile.ZipFile(archive) as source:
        for info in source.infolist():
            data = source.read(info)
            if Path(info.filename).name in ("package.mjs", "views.mjs"):
                text = data.decode("utf-8")
                marker = "// ╔" if "// ╔" in text else "/** Client transport entry point."
                start = text.index(marker)
                if "package.mjs" in info.filename:
                    end = text.index("class PackageAssetField", start)
                else:
                    end = text.index("export async function getPackages", start)
                text = text[:start] + template + "\n" + text[end:]
                text = text.replace("手动配置代理列表", "后端统一管理代理列表")
                data = text.encode("utf-8")
            elif Path(info.filename).name == "proxy-helper.mjs":
                data = helper
            entries.append((info, data))
    replacement = archive.with_suffix(".zip.tmp")
    with zipfile.ZipFile(replacement, "w") as output:
        for info, data in entries:
            output.writestr(info, data)
    replacement.replace(archive)
    print(f"Updated {name}")
