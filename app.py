import os
import sqlite3
import uuid
from functools import wraps
from pathlib import Path

from flask import Flask, redirect, render_template, request, session, url_for
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.secret_key = os.environ.get("PORTFOLIO_SECRET_KEY", "local-development-secret-change-before-publishing")
ADMIN_USERNAME = os.environ.get("PORTFOLIO_ADMIN_USERNAME", "selome")
ADMIN_PASSWORD = os.environ.get("PORTFOLIO_ADMIN_PASSWORD", "change-selome-now")
DATABASE = Path(__file__).with_name("portfolio.db")
UPLOAD_FOLDER = Path(__file__).parent / "static" / "uploads"
ALLOWED_IMAGES = {"png", "jpg", "jpeg", "gif", "webp"}

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
    "ink_color": "#172320",
    "paper_color": "#f5f4ef",
    "accent_color": "#ef785f",
    "highlight_color": "#d8f276",
    "art_color": "#cbc6fa",
}

DEFAULT_ENTRIES = [
    ("experience", "Research Assistant", "Sungkyunkwan University Communication Lab", "Fall 2023 – February 2026", "Supported research work in an electrical and computer engineering lab."),
    ("experience", "Project Assistant", "Byucksan Power", "July 2021 – January 2022", "Supported project operations as a project assistant."),
    ("experience", "Project Assistant · Intern", "Nuri Telecom (NuriFlex)", "March – May 2021", "Supported projects as an intern project assistant."),
    ("experience", "Assistant Coordinator · Interpreter", "YongIn University", "2018, 2019, 2024", "Coordinated volunteer programs and interpreted for international participants."),
    ("experience", "Amharic Teacher", "KOICA", "July – August 2018", "Taught Amharic in a cross-cultural classroom."),
    ("education", "MSc. Electrical and Computer Engineering", "Sungkyunkwan University", "Fall 2023 – February 2026", "Communication laboratory researcher"),
    ("education", "BSc. Software Engineering", "Addis Ababa Science and Technology University", "September 2017 – September 2021", ""),
    ("education", "Disaster Engineering and Fire Fighting", "Kangwon National University", "2022 – 2023", "Scholarship student"),
]


def db():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    return connection


def initialize():
    UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
    connection = db()
    connection.execute("CREATE TABLE IF NOT EXISTS profile (id INTEGER PRIMARY KEY CHECK(id=1), " + ", ".join(f"{key} TEXT" for key in DEFAULT_PROFILE) + ")")
    connection.execute("CREATE TABLE IF NOT EXISTS entries (id INTEGER PRIMARY KEY AUTOINCREMENT, category TEXT, title TEXT, organization TEXT, period TEXT, description TEXT)")
    connection.execute("CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, url TEXT, stack TEXT, image TEXT DEFAULT '')")
    if connection.execute("SELECT COUNT(*) FROM profile").fetchone()[0] == 0:
        fields = ", ".join(DEFAULT_PROFILE)
        connection.execute(f"INSERT INTO profile (id, {fields}) VALUES (1, {','.join('?' for _ in DEFAULT_PROFILE)})", list(DEFAULT_PROFILE.values()))
    if connection.execute("SELECT COUNT(*) FROM entries").fetchone()[0] == 0:
        connection.executemany("INSERT INTO entries (category,title,organization,period,description) VALUES (?,?,?,?,?)", DEFAULT_ENTRIES)
    connection.commit()
    connection.close()


def data():
    connection = db()
    profile = connection.execute("SELECT * FROM profile WHERE id=1").fetchone()
    entries = connection.execute("SELECT * FROM entries ORDER BY id").fetchall()
    projects = connection.execute("SELECT * FROM projects ORDER BY id DESC").fetchall()
    connection.close()
    return profile, entries, projects


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
    profile, entries, projects = data()
    theme = {"--ink": profile["ink_color"], "--paper": profile["paper_color"], "--accent": profile["accent_color"], "--highlight": profile["highlight_color"], "--art": profile["art_color"]}
    return render_template("index.html", profile=profile, entries=entries, projects=projects, theme=theme)


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
        return redirect(url_for("edit"))
    connection.close()
    profile, entries, projects = data()
    return render_template("edit.html", profile=profile, entries=entries, projects=projects)


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
    return redirect(url_for("edit"))


@app.post("/edit/delete/<kind>/<int:item_id>")
@login_required
def delete_item(kind, item_id):
    table = "projects" if kind == "project" else "entries"
    connection = db(); connection.execute(f"DELETE FROM {table} WHERE id=?", (item_id,)); connection.commit(); connection.close()
    return redirect(url_for("edit"))


initialize()

if __name__ == "__main__":
    app.run(debug=True)