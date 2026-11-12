import hashlib
import shutil
from pathlib import Path, PurePosixPath

from flask import render_template

ROOT = Path(__file__).resolve().parent
VERSIONED_ASSETS = ("style.css", "book.js", "cover-front.svg", "cover-back.svg")
if not (ROOT / "portfolio.db").is_file():
    raise FileNotFoundError("portfolio.db is required to build the public portfolio.")

import app as portfolio


def build():
    profile, entries, projects, certifications = portfolio.data()
    theme = {
        "--ink": profile["ink_color"],
        "--paper": profile["paper_color"],
        "--accent": profile["accent_color"],
        "--highlight": profile["highlight_color"],
        "--art": profile["art_color"],
    }

    assets = {
        image
        for image in [profile["profile_image"], *(project["image"] for project in projects)]
        if image
    }
    for asset in assets:
        asset_path = PurePosixPath(asset)
        if (
            not asset_path.parts
            or asset_path.parts[0] != "uploads"
            or any(part in {".", ".."} for part in asset_path.parts)
        ):
            raise ValueError(f"Unsupported portfolio image path: {asset}")

        source = ROOT / "static" / Path(*asset_path.parts)
        if not source.is_file():
            raise FileNotFoundError(f"Portfolio image is missing: {source}")

    for asset in assets:
        asset_path = PurePosixPath(asset)
        destination = ROOT / Path(*asset_path.parts)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / "static" / Path(*asset_path.parts), destination)

    # Changes whenever the public CSS, JS, or cover art changes, so browsers
    # never pair a new index.html with stale cached assets.
    digest = hashlib.sha256()
    for name in VERSIONED_ASSETS:
        digest.update((ROOT / "static" / name).read_bytes())
    asset_version = digest.hexdigest()[:10]

    with portfolio.app.test_request_context("/"):
        html = render_template(
            "index.html",
            profile=profile,
            entries=entries,
            projects=projects,
            certifications=certifications,
            theme=theme,
            static_site=True,
            asset_version=asset_version,
        )

    html = "\n".join(line.rstrip() for line in html.splitlines()) + "\n"
    (ROOT / "index.html").write_text(html, encoding="utf-8", newline="\n")
    print(f"Built {ROOT / 'index.html'} with {len(assets)} image asset(s).")


if __name__ == "__main__":
    build()
