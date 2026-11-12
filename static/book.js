(async () => {
    const book = document.querySelector("[data-book]");
    const controls = document.querySelector("[data-book-controls]");
    const status = document.querySelector("[data-page-status]");
    const hint = document.querySelector("[data-book-hint]");

    if (!book || !controls || !status || !hint) {
        return;
    }

    await document.fonts.ready;

    const measurementSpreads = [];

    function stagePageForMeasurement(page) {
        const spread = document.createElement("div");
        const blankPage = document.createElement("section");
        spread.className = "book-spread pagination-measure";
        blankPage.className = "book-page";
        spread.append(page, blankPage);
        book.append(spread);
        measurementSpreads.push(spread);
    }

    function createContinuationPage(sourcePage, pageNumber, listSelector) {
        const page = sourcePage.cloneNode(true);
        page.id = `${sourcePage.id}-continued-${pageNumber}`;
        page.classList.add("continued-page");
        page.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));

        const heading = page.querySelector("h1, h2");
        if (heading) {
            heading.id = `${page.id}-title`;
            page.setAttribute("aria-labelledby", heading.id);
        }

        const kicker = page.querySelector(".page-kicker, .eyebrow");

        if (listSelector) {
            page.querySelector(listSelector).replaceChildren();
        } else {
            const pageNumberElement = page.querySelector(".page-number");
            Array.from(page.children).forEach((child) => {
                if (
                    child !== pageNumberElement
                    && child !== kicker
                    && child !== heading
                    && !child.contains(kicker)
                    && !child.contains(heading)
                ) {
                    child.remove();
                }
            });
            const coverCopy = page.querySelector(".cover-copy");
            if (coverCopy && heading && kicker) {
                Array.from(coverCopy.children).forEach((child) => {
                    if (child !== heading && child !== kicker) {
                        child.remove();
                    }
                });
            }
        }
        stagePageForMeasurement(page);
        return page;
    }

    function paginatePage(page) {
        const list = page.querySelector(".entries, .projects");
        let currentPage = page;
        let currentItemContainer = list;
        let continuationCount = 0;
        const continuationPages = [];

        if (list) {
            const listSelector = list.classList.contains("projects") ? ".projects" : ".entries";
            const items = Array.from(list.children);
            items.forEach((item) => item.remove());

            items.forEach((item) => {
                currentItemContainer.append(item);
                if (
                    currentPage.scrollHeight > currentPage.clientHeight + 1
                    && (currentItemContainer.children.length > 1 || currentPage !== page)
                ) {
                    currentItemContainer.removeChild(item);
                    currentPage = createContinuationPage(page, ++continuationCount, listSelector);
                    currentItemContainer = currentPage.querySelector(listSelector);
                    currentItemContainer.append(item);
                    continuationPages.push(currentPage);
                }
            });
            return continuationPages;
        }

        const heading = page.querySelector("h1, h2");
        const kicker = page.querySelector(".page-kicker, .eyebrow");
        const pageNumber = page.querySelector(".page-number");
        const content = Array.from(page.children).filter(
            (child) => child !== pageNumber
                && child !== heading
                && child !== kicker
                && !child.contains(heading)
                && !child.contains(kicker)
        );
        content.forEach((element) => element.remove());

        let itemsOnPage = 0;
        content.forEach((element) => {
            currentPage.append(element);
            itemsOnPage += 1;
            if (currentPage.scrollHeight > currentPage.clientHeight + 1 && itemsOnPage > 0) {
                currentPage.removeChild(element);
                currentPage = createContinuationPage(page, ++continuationCount, null);
                currentPage.append(element);
                continuationPages.push(currentPage);
                itemsOnPage = 1;
            }
        });
        return continuationPages;
    }

    let spreads = Array.from(book.querySelectorAll(".book-spread"));
    if (!window.matchMedia("(max-width: 800px)").matches) {
        const pages = spreads.flatMap((spread) => Array.from(spread.querySelectorAll(".book-page")));
        const paginatedPages = pages.flatMap((page) => [page, ...paginatePage(page)]);
        spreads.forEach((spread) => spread.remove());
        measurementSpreads.forEach((spread) => spread.remove());
        for (let index = 0; index < paginatedPages.length;) {
            const spread = document.createElement("div");
            spread.className = "book-spread";
            const pageNumber = index + 1;
            const firstPage = paginatedPages[index];
            const isJacket = firstPage.classList.contains("book-jacket");
            const nextPageIsJacket = paginatedPages[index + 1]?.classList.contains("book-jacket");
            const pageCount = isJacket || nextPageIsJacket
                ? 1
                : 2;
            paginatedPages.slice(index, index + pageCount).forEach((page) => {
                const number = page.querySelector(".page-number");
                if (number) {
                    number.textContent = String(pageNumber + spread.childElementCount).padStart(2, "0");
                }
                spread.append(page);
            });
            if (
                !isJacket
                && ((pageCount === 2 && spread.childElementCount === 1) || nextPageIsJacket)
            ) {
                const blankPage = document.createElement("section");
                blankPage.className = "book-page blank-page";
                blankPage.setAttribute("aria-hidden", "true");
                blankPage.inert = true;
                spread.append(blankPage);
            }
            index += pageCount;
            if (isJacket) {
                spread.classList.add("single-page");
                spread.classList.add("cover-spread");
                spread.classList.add(
                    firstPage.classList.contains("book-front-cover")
                        ? "front-cover-spread"
                        : "back-cover-spread"
                );
            }
            book.append(spread);
        }
        spreads = Array.from(book.querySelectorAll(".book-spread"));
    }

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
            spread.querySelectorAll(".is-turn-page-hidden").forEach((page) => {
                page.classList.remove("is-turn-page-hidden");
            });
        });
        turnInProgress = false;
    }

    function focusPageHeading(pageId) {
        const target = document.getElementById(pageId);
        const heading = target?.matches("h1, h2, h3") ? target : target?.querySelector("h1, h2");
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

        const pageCount = spreads[activeSpread].querySelectorAll(".book-page").length;
        const actualFirstPage = spreads
            .slice(0, activeSpread)
            .reduce((count, spread) => count + spread.querySelectorAll(".book-page").length, 1);
        const lastPage = actualFirstPage + pageCount - 1;
        status.textContent = `Spread ${activeSpread + 1} of ${spreads.length} · pages ${actualFirstPage}–${lastPage}`;

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
        const fullSpreadTurn = mobileLayout;
        const currentPage = currentSpread.querySelector(goingForward ? ".book-page:last-child" : ".book-page:first-child");
        const reversePage = targetSpread.querySelector(goingForward ? ".book-page:first-child" : ".book-page:last-child");
        const sheet = document.createElement("div");
        const front = document.createElement("div");
        const back = document.createElement("div");

        sheet.className = `page-turn-sheet ${goingForward ? "turn-forward" : "turn-back"}${fullSpreadTurn ? " is-mobile" : ""}`;
        sheet.setAttribute("aria-hidden", "true");
        sheet.inert = true;
        front.className = "page-turn-face page-turn-front";
        back.className = "page-turn-face page-turn-back";
        front.append(cloneForTurn(fullSpreadTurn ? currentSpread : currentPage));
        back.append(cloneForTurn(fullSpreadTurn ? targetSpread : reversePage));
        sheet.append(front, back);
        if (!fullSpreadTurn) {
            currentPage.classList.add("is-turn-page-hidden");
        }

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
        turnTimeout = window.setTimeout(finishTurn, 850);
    }

    function turn(direction) {
        if (!turnInProgress) {
            animateToSpread(activeSpread + (direction === "forward" ? 1 : -1), direction);
        }
    }

    function navigateToHash(hash, updateHistory) {
        const pageId = hash.replace(/^#/, "");
        const target = document.getElementById(pageId);
        const pageElementId = pageSpread.has(pageId) ? pageId : target?.closest(".book-page")?.id;
        const spreadIndex = pageSpread.get(pageElementId);
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

    document.querySelectorAll('a[href^="#page-"], a[href="#certifications-title"]').forEach((link) => {
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
