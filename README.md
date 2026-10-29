# My Portfolio

Run `python -m pip install -r requirements.txt`, then `python app.py`.

Open `http://127.0.0.1:5000/` for the portfolio and `/edit` to update your resume, colors, and photos. Uploaded photos are displayed cleanly without decorative overlays or marks.

## Publish on GitHub Pages

GitHub Pages serves static files and cannot run the Flask editor. To publish the portfolio using the local profile, projects, and photos, run this on the machine with the populated `portfolio.db`, uploaded photos, and configured `.env`:

```powershell
python build_static.py
```

Commit the generated `index.html` and `uploads/` files, then push them to `main`. The public site is <https://selome21.github.io/portfolio/>. The admin editor remains available only when running the Flask app locally.

The generated page and copied images are public. The local database, `.env`, and original upload folder remain excluded from Git.

The portfolio is presented as an interactive book with a 3D page-flip animation. Use the page navigation, Previous/Next buttons, arrow keys while the book is focused, or swipe on touch screens. Reduced-motion preferences are respected.
