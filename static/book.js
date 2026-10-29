(() => {
    const book = document.querySelector("[data-book]");
    const controls = document.querySelector("[data-book-controls]");
    const previous = document.querySelector("[data-previous]");
    const next = document.querySelector("[data-next]");
    const status = document.querySelector("[data-page-status]");
    const hint = document.querySelector("[data-book-hint]");

    if (!book || !controls || !previous || !next || !status || !hint) {
        return;
    }

    const spreads = Array.from(book.querySelectorAll(".book-spread"));
    const pageSpread = new Map();
    spreads.forEach((spread, index) => {
        spread.querySelectorAll(".book-page[id]").forEach((page) => {
            pageSpread.set(page.id, index);
        });
    });

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let activeSpread = 0;
    let touchStartX = null;
    let touchStartY = null;
    let suppressClickUntil = 0;
    let turnTimeout;

    function renderSpread(index, direction, pageId) {
        activeSpread = Math.max(0, Math.min(index, spreads.length - 1));

        spreads.forEach((spread, spreadIndex) => {
            const active = spreadIndex === activeSpread;
            spread.hidden = !active;
            spread.inert = !active;
            spread.setAttribute("aria-hidden", String(!active));
            spread.classList.remove("is-active", "is-turning-forward", "is-turning-back");
            if (active) {
                spread.classList.add("is-active");
                if (!reducedMotion.matches && direction) {
                    spread.classList.add(direction === "forward" ? "is-turning-forward" : "is-turning-back");
                }
            }
        });

        previous.disabled = activeSpread === 0;
        next.disabled = activeSpread === spreads.length - 1;
        const firstPage = activeSpread * 2 + 1;
        const lastPage = firstPage + 1;
        status.textContent = `Spread ${activeSpread + 1} of ${spreads.length} · pages ${firstPage}–${lastPage}`;

        window.clearTimeout(turnTimeout);
        turnTimeout = window.setTimeout(() => {
            spreads[activeSpread].classList.remove("is-turning-forward", "is-turning-back");
        }, reducedMotion.matches ? 0 : 500);

        if (pageId) {
            const heading = document.querySelector(`#${CSS.escape(pageId)} h1, #${CSS.escape(pageId)} h2`);
            if (heading) {
                heading.focus({ preventScroll: true });
                heading.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "nearest" });
            }
        }
    }

    function turn(direction) {
        renderSpread(activeSpread + (direction === "forward" ? 1 : -1), direction);
    }

    function navigateToHash(hash, updateHistory) {
        const pageId = hash.replace(/^#/, "");
        const spreadIndex = pageSpread.get(pageId);
        if (spreadIndex === undefined) {
            return false;
        }

        renderSpread(spreadIndex, spreadIndex >= activeSpread ? "forward" : "back", pageId);
        if (updateHistory) {
            window.history.pushState(null, "", `#${pageId}`);
        }
        return true;
    }

    book.querySelectorAll(".book-page h1, .book-page h2").forEach((heading) => {
        heading.tabIndex = -1;
    });
    document.body.classList.add("book-ready");
    controls.hidden = false;
    hint.hidden = false;

    const initialHash = window.location.hash;
    if (!navigateToHash(initialHash, false)) {
        renderSpread(0);
    }

    previous.addEventListener("click", () => turn("back"));
    next.addEventListener("click", () => turn("forward"));

    document.querySelectorAll('a[href^="#page-"]').forEach((link) => {
        link.addEventListener("click", (event) => {
            if (navigateToHash(link.hash, true)) {
                event.preventDefault();
            }
        });
    });

    window.addEventListener("popstate", () => {
        if (!navigateToHash(window.location.hash, false)) {
            renderSpread(0);
        }
    });

    book.addEventListener("keydown", (event) => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest("a, button, input, textarea, select")) {
            return;
        }
        if (event.key === "ArrowRight") {
            event.preventDefault();
            turn("forward");
        } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            turn("back");
        }
    });

    book.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "touch") {
            touchStartX = event.clientX;
            touchStartY = event.clientY;
        }
    });

    book.addEventListener("pointerup", (event) => {
        if (touchStartX === null || touchStartY === null || event.target.closest("a, button")) {
            touchStartX = null;
            touchStartY = null;
            return;
        }
        const distanceX = event.clientX - touchStartX;
        const distanceY = event.clientY - touchStartY;
        touchStartX = null;
        touchStartY = null;
        if (Math.abs(distanceX) > 70 && Math.abs(distanceX) > Math.abs(distanceY) * 1.25) {
            suppressClickUntil = Date.now() + 500;
            turn(distanceX < 0 ? "forward" : "back");
        }
    });

    book.addEventListener("pointercancel", () => {
        touchStartX = null;
        touchStartY = null;
    });

    book.addEventListener("click", (event) => {
        if (Date.now() < suppressClickUntil || event.button !== 0 || event.target.closest("a, button, input, textarea, select, label")) {
            return;
        }

        const spread = spreads[activeSpread];
        const bounds = spread.getBoundingClientRect();
        const midpoint = bounds.left + bounds.width / 2;
        turn(event.clientX >= midpoint ? "forward" : "back");
    });
})();
