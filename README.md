# My Portfolio

Run `python -m pip install -r requirements.txt`, then `python app.py`.

Open `http://127.0.0.1:5000/` for the portfolio and `/edit` to update your resume, certifications and licenses, colors, and photos. Successful admin changes rebuild the static site and push `index.html`, the public CSS and JavaScript, and public images to the `main` branch so GitHub Pages can update. The editor also has a button to retry publishing. Uploaded photos are displayed cleanly without decorative overlays or marks.

Automatic publishing uses the local Git checkout, the `origin` remote, and your existing GitHub/Git credential configuration. Set up GitHub CLI authentication with `gh auth login` and `gh auth setup-git` if needed, and configure your Git commit name and email. No GitHub token is stored in the portfolio or `.env`. If a push fails, the editor reports the error; fix the Git configuration or connection and retry publishing from the editor.

## Publish on GitHub Pages

GitHub Pages serves static files and cannot run the Flask editor. To publish the portfolio using the local profile, projects, and photos, run this on the machine with the populated `portfolio.db`, uploaded photos, and configured `.env`:

```powershell
python build_static.py
```

The public site is <https://selome21.github.io/portfolio/>. The admin editor remains available only when running the Flask app locally.

The generated page and copied images are public. The local database, `.env`, and original upload folder remain excluded from Git.

The portfolio is presented as an interactive book with a 3D page-flip animation, a yellow-and-pink cover, and a matching “Bye” back cover. Long sections automatically continue onto additional pages without a continuation label, and credentials appear from newest to oldest by issue date. Turn pages by clicking either side of the book, using the page navigation, pressing the arrow keys while the book is focused, or swiping on touch screens. Reduced-motion preferences are respected.
