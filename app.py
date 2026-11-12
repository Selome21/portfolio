import os
import sqlite3
import subprocess
import uuid
from datetime import datetime
from functools import wraps
from pathlib import Path
from urllib.parse import urlparse

from flask import Flask, flash, redirect, render_template, request, session, url_for
from werkzeug.utils import secure_filename


def load_local_env():
    env_file = Path(__file__).with_name(".env")
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_local_env()

app = Flask(__name__)
app.secret_key = os.environ.get("PORTFOLIO_SECRET_KEY", "local-development-secret-change-before-publishing")
ADMIN_USERNAME = os.environ.get("PORTFOLIO_ADMIN_USERNAME")
ADMIN_PASSWORD = os.environ.get("PORTFOLIO_ADMIN_PASSWORD")
if not ADMIN_USERNAME or not ADMIN_PASSWORD:
    raise RuntimeError("Add PORTFOLIO_ADMIN_USERNAME and PORTFOLIO_ADMIN_PASSWORD to the local .env file.")
DATABASE = Path(__file__).with_name("portfolio.db")
UPLOAD_FOLDER = Path(__file__).parent / "static" / "uploads"
ALLOWED_IMAGES = {"png", "jpg", "jpeg", "gif", "webp"}
PUBLIC_SITE_PATHS = ("index.html", "static/style.css", "static/book.js", "uploads")

DEFAULT_PROFILE = {
    "name": "Selome Tesfaye Deribe",
    "role": "Software Engineer · Research Assistant · Multilingual Communicator",
    "tagline": "I build thoughtful digital tools and help ideas move clearly across cultures.",
    "location": "Suwon, South Korea",
    "email": "yselome@gmail.com",
    "phone": "+82 10 6697 4697",
    "about": "I am a software engineering graduate and electrical and computer engineering researcher with experience across technology, education, interpretation, and project coordination.",
    "skills": "Python, JavaScript, C++, C#, Java, Angular, React, MySQL, MongoDB, Docker",
    "languages": "English · Amharic · Korean (TOPIK Level 5)",
    "profile_image": "",
    "ink_color": "#35243e",
    "paper_color": "#fff9ef",
    "accent_color": "#c2185b",
    "highlight_color": "#d4f000",
    "art_color": "#ffdc55",
}

DEFAULT_ENTRIES = [
    ("experience", "Research and Development Professional", "TreeM", "Fall 2026 – Present", ""),
    ("experience", "Financial Consultant", "Shinhan Life (Freelancer)", "Summer 2026 – Present", ""),
    ("experience", "Research Assistant", "Sungkyunkwan University Communication Lab", "Fall 2023 – February 2026", "Supported research work in an electrical and computer engineering lab."),
    ("experience", "Project Assistant", "Byucksan Power", "July 2021 – January 2022", "Supported project operations as a project assistant."),
    ("experience", "Project Assistant · Intern", "Nuri Telecom (NuriFlex)", "March – May 2021", "Supported projects as an intern project assistant."),
    ("experience", "Assistant Coordinator · Interpreter", "YongIn University", "Summer 2018, 2019, 2024, 2025", "Coordinated volunteer programs and interpreted for international participants."),
    ("experience", "Amharic Teacher", "KOICA", "July – August 2018", "Taught Amharic in a cross-cultural classroom."),
    ("education", "MSc. Electrical and Computer Engineering", "Sungkyunkwan University", "Fall 2023 – February 2026", "Communication laboratory researcher"),
    ("education", "BSc. Software Engineering", "Addis Ababa Science and Technology University", "September 2017 – September 2021", ""),
    ("education", "Disaster Engineering and Fire Fighting", "Kangwon National University", "Winter 2022 – Summer 2023", "Scholarship student"),
]

NEW_CERTIFICATIONS = [
    {
        "kind": "certification",
        "title": "Introduction to Cybersecurity",
        "organization": "Cisco",
        "issued": "April 2024",
        "credential_url": "https://www.credly.com/badges/c019aaf9-95b5-4518-8194-8ed917b479c3/linked_in_profile",
    },
    {
        "kind": "certification",
        "title": "AWS SimuLearn - Cloud Practitioner - Training Badge",
        "organization": "Amazon Web Services (AWS)",
        "issued": "November 2026",
        "credential_url": "https://www.credly.com/badges/556b8735-9a57-4886-964c-87744285fe92/linked_in_profile",
    },
]

DEFAULT_CERTIFICATIONS = [
    {
        "kind": "certification",
        "title": "IAB Digital Marketing and Media Foundations Certification",
        "organization": "Google Digital Garage",
        "issued": "December 2020",
        "credential_id": "59A J8C KWT",
    },
    {
        "kind": "certification",
        "title": "Digital Artists on Target-Oriented Graphics Design",
        "organization": "Share Plus",
        "issued": "January 2022",
    },
    {
        "kind": "certification",
        "title": "Training and Development Program for Korean Language and Cultural Experts / Korean Language Experts",
        "organization": "KOICA & Hallym University",
        "issued": "November 2020",
    },
    {
        "kind": "certification",
        "title": "Official TOPIK Score",
        "organization": "National Institute for International Education (NIIED)",
        "issued": "October 2025",
        "credential_id": "0364583305630020",
    },
    {
        "kind": "certification",
        "title": "Claude Academy: Model Context Protocol: Advanced Topics",
        "organization": "Anthropic",
        "issued": "October 2026",
        "credential_id": "fcb74d0a3f110686edbf42cade3ccb6e",
    },
    {
        "kind": "certification",
        "title": "TOEIC",
        "organization": "ETS한국TOEIC위원회",
        "issued": "July 2026",
        "expires": "July 2028",
        "credential_id": "150263",
    },
    {
        "kind": "certification",
        "title": "AWS Developer – Associate",
        "organization": "Amazon Web Services (AWS)",
        "issued": "October 2026",
    },
    *NEW_CERTIFICATIONS,
]


def db():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    return connection


def initialize():
    UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
    connection = db()
    certifications_table_exists = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='certifications'"
    ).fetchone()
    connection.execute("CREATE TABLE IF NOT EXISTS profile (id INTEGER PRIMARY KEY CHECK(id=1), " + ", ".join(f"{key} TEXT" for key in DEFAULT_PROFILE) + ")")
    connection.execute("CREATE TABLE IF NOT EXISTS entries (id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT, title TEXT, organization TEXT, period TEXT, description TEXT)")
    connection.execute("CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, url TEXT, stack TEXT, image TEXT DEFAULT '')")
    connection.execute("CREATE TABLE IF NOT EXISTS certifications (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL DEFAULT 'certification', title TEXT NOT NULL, organization TEXT NOT NULL, issued TEXT NOT NULL DEFAULT '', expires TEXT NOT NULL DEFAULT '', credential_id TEXT NOT NULL DEFAULT '', credential_url TEXT NOT NULL DEFAULT '')")
    certification_columns = {
        row["name"] for row in connection.execute("PRAGMA table_info(certifications)")
    }
    if "credential_url" not in certification_columns:
        connection.execute(
            "ALTER TABLE certifications ADD COLUMN credential_url TEXT NOT NULL DEFAULT ''"
        )
        for certification in NEW_CERTIFICATIONS:
            exists = connection.execute(
                "SELECT 1 FROM certifications WHERE title=? LIMIT 1",
                (certification["title"],),
            ).fetchone()
            if not exists:
                connection.execute(
                    "INSERT INTO certifications (kind,title,organization,issued,credential_url) "
                    "VALUES (:kind,:title,:organization,:issued,:credential_url)",
                    certification,
                )
    if connection.execute("SELECT COUNT(*) FROM profile").fetchone()[0] == 0:
        fields = ", ".join(DEFAULT_PROFILE)
        connection.execute(f"INSERT INTO profile (id, {fields}) VALUES (1, {','.join('?' for _ in DEFAULT_PROFILE)})", list(DEFAULT_PROFILE.values()))
    if connection.execute("SELECT COUNT(*) FROM entries").fetchone()[0] == 0:
        connection.executemany("INSERT INTO entries (category,title,organization,period,description) VALUES (?,?,?,?,?)", DEFAULT_ENTRIES)
    if not certifications_table_exists:
        connection.executemany(
            "INSERT INTO certifications (kind,title,organization,issued,expires,credential_id,credential_url) VALUES (:kind,:title,:organization,:issued,:expires,:credential_id,:credential_url)",
            [
                {
                    "expires": "",
                    "credential_id": "",
                    "credential_url": "",
                    **certification,
                }
                for certification in DEFAULT_CERTIFICATIONS
            ],
        )
    else:
        merged_titles = (
            "Training and Development Program for Korean Language and Cultural Experts",
            "Korean Language Experts",
        )
        merged_rows = connection.execute(
            "SELECT id, issued FROM certifications WHERE title IN (?,?) ORDER BY id",
            merged_titles,
        ).fetchall()
        if merged_rows:
            issued = next((row["issued"] for row in merged_rows if row["issued"]), "")
            connection.execute(
                "UPDATE certifications SET kind='certification',title=?,organization=?,issued=? WHERE id=?",
                (
                    "Training and Development Program for Korean Language and Cultural Experts / Korean Language Experts",
                    "KOICA & Hallym University",
                    issued,
                    merged_rows[0]["id"],
                ),
            )
            if len(merged_rows) > 1:
                connection.executemany(
                    "DELETE FROM certifications WHERE id=?",
                    [(row["id"],) for row in merged_rows[1:]],
                )
    connection.commit()
    connection.close()


def data():
    connection = db()
    profile = connection.execute("SELECT * FROM profile WHERE id=1").fetchone()
    entries = connection.execute("SELECT * FROM entries ORDER BY id").fetchall()
    projects = connection.execute("SELECT * FROM projects ORDER BY id DESC").fetchall()
    certifications = connection.execute("SELECT * FROM certifications").fetchall()
    connection.close()
    date_formats = ("%B %Y", "%b %Y", "%Y-%m", "%Y-%m-%d", "%Y")

    def certification_date(certification):
        issued = certification["issued"].strip()
        for date_format in date_formats:
            try:
                return datetime.strptime(issued, date_format)
            except ValueError:
                continue
        return datetime.min

    certifications = sorted(
        certifications,
        key=lambda certification: (certification_date(certification), certification["id"]),
        reverse=True,
    )
    return profile, entries, projects, certifications


def publish_static_site():
    try:
        from build_static import build

        build()
    except (OSError, ValueError) as error:
        return False, f"Saved locally, but the static site could not be built: {error}"

    branch = os.environ.get("PORTFOLIO_PUBLISH_BRANCH", "main")
    remote = os.environ.get("PORTFOLIO_GIT_REMOTE", "origin")
    git_dir = Path(__file__).parent
    try:
        current_branch = subprocess.run(
            ["git", "branch", "--show-current"],
            cwd=git_dir,
            check=True,
            capture_output=True,
            text=True,
            timeout=10,
        ).stdout.strip()
    except (OSError, subprocess.SubprocessError) as error:
        return False, f"Saved locally, but Git could not be checked: {error}"
    if current_branch != branch:
        return False, f"Saved locally, but auto-publishing requires the {branch} branch (currently on {current_branch or 'detached HEAD'})."

    try:
        environment = os.environ.copy()
        environment["GIT_TERMINAL_PROMPT"] = "0"
        environment["GCM_INTERACTIVE"] = "never"
        stage = subprocess.run(
            ["git", "add", "--", *PUBLIC_SITE_PATHS],
            cwd=git_dir,
            env=environment,
            capture_output=True,
            text=True,
            timeout=30,
        )
        if stage.returncode:
            details = stage.stderr.strip() or stage.stdout.strip()
            return False, f"Saved locally, but Git could not prepare the website update: {details}"

        changes = subprocess.run(
            ["git", "diff", "--cached", "--quiet", "--", *PUBLIC_SITE_PATHS],
            cwd=git_dir,
            env=environment,
            capture_output=True,
            text=True,
            timeout=30,
        )
        if changes.returncode not in (0, 1):
            details = changes.stderr.strip() or changes.stdout.strip()
            return False, f"Saved locally, but Git could not compare the website files: {details}"
        if changes.returncode == 1:
            commit = subprocess.run(
                [
                    "git",
                    "commit",
                    "-m",
                    "Publish portfolio updates",
                    "--only",
                    "--",
                    *PUBLIC_SITE_PATHS,
                ],
                cwd=git_dir,
                env=environment,
                capture_output=True,
                text=True,
                timeout=30,
            )
            if commit.returncode:
                details = commit.stderr.strip() or commit.stdout.strip()
                return False, f"Saved locally, but Git could not commit the website update: {details}"

        push = subprocess.run(
            ["git", "push", remote, branch],
            cwd=git_dir,
            env=environment,
            capture_output=True,
            text=True,
            timeout=90,
        )
        if push.returncode:
            details = push.stderr.strip() or push.stdout.strip()
            return False, f"Saved locally, but GitHub did not accept the update: {details}"
    except (OSError, subprocess.SubprocessError) as error:
        return False, f"Saved locally, but the GitHub update failed: {error}"

    return True, "Saved and pushed to GitHub. GitHub Pages may take a few minutes to update."


def publish_after_save():
    published, message = publish_static_site()
    flash(message, "success" if published else "error")


def upload(file):
    if not file or not file.filename:
        return ""
    extension = Path(file.filename).suffix.lower().lstrip(".")
    if extension not in ALLOWED_IMAGES:
        return ""
    filename = secure_filename(f"{uuid.uuid4().hex}.{extension}")
    file.save(UPLOAD_FOLDER / filename)
    return f"uploads/{filename}"


def login_required(view):
    @wraps(view)
    def wrapped_view(*args, **kwargs):
        if not session.get("admin_authenticated"):
            return redirect(url_for("login", next=request.path))
        return view(*args, **kwargs)

    return wrapped_view


@app.route("/")
def home():
    profile, entries, projects, certifications = data()
    theme = {"--ink": profile["ink_color"], "--paper": profile["paper_color"], "--accent": profile["accent_color"], "--highlight": profile["highlight_color"], "--art": profile["art_color"]}
    return render_template("index.html", profile=profile, entries=entries, projects=projects, certifications=certifications, theme=theme, static_site=False)


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        if request.form.get("username") == ADMIN_USERNAME and request.form.get("password") == ADMIN_PASSWORD:
            session.clear()
            session["admin_authenticated"] = True
            next_url = request.args.get("next") or request.form.get("next") or url_for("edit")
            return redirect(next_url if next_url.startswith("/") else url_for("edit"))
        return render_template("login.html", error="Those credentials do not match.", next=request.form.get("next", ""))
    return render_template("login.html", error=None, next=request.args.get("next", ""))


@app.post("/logout")
def logout():
    session.clear()
    return redirect(url_for("home"))


@app.route("/edit", methods=["GET", "POST"])
@login_required
def edit():
    connection = db()
    if request.method == "POST":
        values = [request.form.get(field, "").strip() for field in DEFAULT_PROFILE]
        image = upload(request.files.get("profile_image"))
        values[list(DEFAULT_PROFILE).index("profile_image")] = image or connection.execute("SELECT profile_image FROM profile WHERE id=1").fetchone()[0]
        assignments = ", ".join(f"{field}=?" for field in DEFAULT_PROFILE)
        connection.execute(f"UPDATE profile SET {assignments} WHERE id=1", values)
        connection.commit()
        connection.close()
        publish_after_save()
        return redirect(url_for("edit"))
    connection.close()
    profile, entries, projects, certifications = data()
    return render_template("edit.html", profile=profile, entries=entries, projects=projects, certifications=certifications)


@app.post("/edit/entry")
@login_required
def save_entry():
    values = [request.form.get(field, "").strip() for field in ("category", "title", "organization", "period", "description")]
    connection = db()
    entry_id = request.form.get("id")
    if entry_id:
        connection.execute("UPDATE entries SET category=?,title=?,organization=?,period=?,description=? WHERE id=?", values + [entry_id])
    else:
        connection.execute("INSERT INTO entries (category,title,organization,period,description) VALUES (?,?,?,?,?)", values)
    connection.commit(); connection.close()
    publish_after_save()
    return redirect(url_for("edit"))


@app.post("/edit/certification")
@login_required
def save_certification():
    kind = request.form.get("kind", "certification")
    if kind not in {"certification", "license"}:
        return "Invalid credential type.", 400
    credential_url = request.form.get("credential_url", "").strip()
    parsed_credential_url = urlparse(credential_url)
    if credential_url and (
        parsed_credential_url.scheme not in {"http", "https"}
        or not parsed_credential_url.netloc
    ):
        return "Credential URL must use HTTP or HTTPS.", 400
    values = [
        kind,
        request.form.get("title", "").strip(),
        request.form.get("organization", "").strip(),
        request.form.get("issued", "").strip(),
        request.form.get("expires", "").strip(),
        request.form.get("credential_id", "").strip(),
        credential_url,
    ]
    connection = db()
    certification_id = request.form.get("id")
    if certification_id:
        connection.execute(
            "UPDATE certifications SET kind=?,title=?,organization=?,issued=?,expires=?,credential_id=?,credential_url=? WHERE id=?",
            values + [certification_id],
        )
    else:
        connection.execute(
            "INSERT INTO certifications (kind,title,organization,issued,expires,credential_id,credential_url) VALUES (?,?,?,?,?,?,?)",
            values,
        )
    connection.commit()
    connection.close()
    publish_after_save()
    return redirect(url_for("edit"))


@app.post("/edit/project")
@login_required
def save_project():
    values = [request.form.get(field, "").strip() for field in ("title", "description", "url", "stack")]
    image = upload(request.files.get("image"))
    connection = db()
    project_id = request.form.get("id")
    if project_id:
        if image:
            connection.execute("UPDATE projects SET title=?,description=?,url=?,stack=?,image=? WHERE id=?", values + [image, project_id])
        else:
            connection.execute("UPDATE projects SET title=?,description=?,url=?,stack=? WHERE id=?", values + [project_id])
    else:
        connection.execute("INSERT INTO projects (title,description,url,stack,image) VALUES (?,?,?,?,?)", values + [image])
    connection.commit(); connection.close()
    publish_after_save()
    return redirect(url_for("edit"))


@app.post("/edit/delete/<kind>/<int:item_id>")
@login_required
def delete_item(kind, item_id):
    table = {"project": "projects", "entry": "entries", "certification": "certifications"}.get(kind)
    if not table:
        return "Unknown item type.", 404
    connection = db(); connection.execute(f"DELETE FROM {table} WHERE id=?", (item_id,)); connection.commit(); connection.close()
    publish_after_save()
    return redirect(url_for("edit"))


@app.post("/edit/publish")
@login_required
def publish():
    publish_after_save()
    return redirect(url_for("edit"))


initialize()

if __name__ == "__main__":
    app.run(debug=True)