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
    let turnInProgress = false;
    let pendingNavigation = null;
    let turnTimeout;

    function clearTurnSheet() {
        window.clearTimeout(turnTimeout);
        book.querySelector(".page-turn-sheet")?.remove();
        spreads.forEach((spread) => {
            spread.classList.remove("is-turn-underlay", "is-turn-forward-underlay", "is-turn-back-underlay");
        });
        turnInProgress = false;
    }

    function focusPageHeading(pageId) {
        const heading = document.querySelector(`#${CSS.escape(pageId)} h1, #${CSS.escape(pageId)} h2`);
        if (heading) {
            heading.focus({ preventScroll: true });
            heading.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "nearest" });
        }
    }

    function renderSpread(index, pageId) {
        clearTurnSheet();
        activeSpread = Math.max(0, Math.min(index, spreads.length - 1));

        spreads.forEach((spread, spreadIndex) => {
            const active = spreadIndex === activeSpread;
            spread.hidden = !active;
            spread.inert = !active;
            spread.setAttribute("aria-hidden", String(!active));
            spread.classList.remove("is-active");
            if (active) {
                spread.classList.add("is-active");
            }
        });

        previous.disabled = activeSpread === 0;
        next.disabled = activeSpread === spreads.length - 1;
        const firstPage = activeSpread * 2 + 1;
        const lastPage = firstPage + 1;
        status.textContent = `Spread ${activeSpread + 1} of ${spreads.length} · pages ${firstPage}–${lastPage}`;

        if (pageId) {
            focusPageHeading(pageId);
        }
    }

    function cloneForTurn(element) {
        const clone = element.cloneNode(true);
        clone.removeAttribute("id");
        clone.querySelectorAll("[id]").forEach((item) => item.removeAttribute("id"));
        clone.setAttribute("aria-hidden", "true");
        clone.inert = true;
        return clone;
    }

    function animateToSpread(index, direction, pageId) {
        const targetIndex = Math.max(0, Math.min(index, spreads.length - 1));
        if (targetIndex === activeSpread) {
            if (pageId) {
                focusPageHeading(pageId);
            }
            return;
        }
        if (turnInProgress) {
            return;
        }
        if (reducedMotion.matches) {
            renderSpread(targetIndex, pageId);
            return;
        }

        const currentSpread = spreads[activeSpread];
        const targetSpread = spreads[targetIndex];
        const goingForward = direction === "forward";
        const mobileLayout = window.matchMedia("(max-width: 800px)").matches;
        const currentPage = currentSpread.querySelector(goingForward ? ".book-page:last-child" : ".book-page:first-child");
        const reversePage = targetSpread.querySelector(goingForward ? ".book-page:first-child" : ".book-page:last-child");
        const sheet = document.createElement("div");
        const front = document.createElement("div");
        const back = document.createElement("div");

        sheet.className = `page-turn-sheet ${goingForward ? "turn-forward" : "turn-back"}${mobileLayout ? " is-mobile" : ""}`;
        sheet.setAttribute("aria-hidden", "true");
        sheet.inert = true;
        front.className = "page-turn-face page-turn-front";
        back.className = "page-turn-face page-turn-back";
        front.append(cloneForTurn(mobileLayout ? currentSpread : currentPage));
        back.append(cloneForTurn(mobileLayout ? targetSpread : reversePage));
        sheet.append(front, back);

        turnInProgress = true;
        pendingNavigation = null;
        targetSpread.hidden = false;
        targetSpread.inert = true;
        targetSpread.setAttribute("aria-hidden", "true");
        targetSpread.classList.add(
            "is-turn-underlay",
            goingForward ? "is-turn-forward-underlay" : "is-turn-back-underlay"
        );
        currentSpread.after(targetSpread);
        book.append(sheet);
        previous.disabled = true;
        next.disabled = true;

        const finishTurn = () => {
            if (!turnInProgress) {
                return;
            }
            const queued = pendingNavigation;
            const completedPageId = queued && queued.index === targetIndex ? queued.pageId : pageId;
            renderSpread(targetIndex, completedPageId);
            if (queued && queued.index !== targetIndex) {
                const nextDirection = queued.index >= activeSpread ? "forward" : "back";
                animateToSpread(queued.index, nextDirection, queued.pageId);
            }
        };

        sheet.addEventListener("animationend", (event) => {
            if (event.target === sheet) {
                finishTurn();
            }
        });
        turnTimeout = window.setTimeout(finishTurn, 1100);
    }

    function turn(direction) {
        if (!turnInProgress) {
            animateToSpread(activeSpread + (direction === "forward" ? 1 : -1), direction);
        }
    }

    function navigateToHash(hash, updateHistory) {
        const pageId = hash.replace(/^#/, "");
        const spreadIndex = pageSpread.get(pageId);
        if (spreadIndex === undefined) {
            return false;
        }

        const direction = spreadIndex >= activeSpread ? "forward" : "back";
        if (turnInProgress) {
            pendingNavigation = { index: spreadIndex, pageId };
        } else {
            animateToSpread(spreadIndex, direction, pageId);
        }
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
