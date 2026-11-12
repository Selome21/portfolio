(async () => {
    const book = document.querySelector("[data-book]");
    const controls = document.querySelector("[data-book-controls]");
    const status = document.querySelector("[data-page-status]");
    const hint = document.querySelector("[data-book-hint]");

    if (!book || !controls || !status || !hint) {
        return;
    }

    const mobileLayout = window.matchMedia("(max-width: 800px)").matches;
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

    function createInsideCover(side) {
        const page = document.createElement("section");
        page.className = `book-page book-jacket book-cover-interior book-${side}-cover`;
        page.setAttribute("aria-label", `Inside ${side} cover`);
        page.setAttribute("aria-hidden", "true");
        page.inert = true;
        return page;
    }

    function splitMobileProject(item) {
        const description = item.querySelector("p");
        const words = description?.textContent.trim().split(/\s+/) ?? [];
        if (words.join(" ").length <= 250) {
            return [item];
        }

        const chunks = [];
        let chunk = [];
        words.forEach((word) => {
            if (chunk.join(" ").length + word.length + 1 > 250 && chunk.length) {
                chunks.push(chunk.join(" "));
                chunk = [];
            }
            chunk.push(word);
        });
        if (chunk.length) {
            chunks.push(chunk.join(" "));
        }

        return chunks.map((text, index) => {
            const project = index === 0 ? item : item.cloneNode(true);
            project.querySelector("p").textContent = text;
            if (index > 0) {
                project.querySelector("a")?.remove();
                project.querySelector("small")?.remove();
            }
            return project;
        });
    }

    function paginateMobilePage(page) {
        const pageNumber = page.querySelector(".page-number");
        const heading = page.querySelector("h1, h2");
        const kicker = page.querySelector(".page-kicker, .eyebrow");
        const list = page.querySelector(".entries, .projects, .facts");
        const listSelector = list?.classList.contains("projects")
            ? ".projects"
            : list?.classList.contains("facts")
                ? ".facts"
                : list
                    ? ".entries"
                    : null;
        const content = [];

        Array.from(page.children).forEach((element) => {
            if (
                element === pageNumber
                || element === heading
                || element === kicker
                || element.contains(heading)
                || element.contains(kicker)
            ) {
                return;
            }

            if (element === list) {
                Array.from(list.children).forEach((item) => {
                    const items = listSelector === ".projects" ? splitMobileProject(item) : [item];
                    items.forEach((listItem) => content.push({ element: listItem, listSelector }));
                    item.remove();
                });
            } else {
                content.push({ element, listSelector: null });
                element.remove();
            }
        });

        const continuationPages = [];
        let currentPage = page;
        let continuationCount = 0;

        content.forEach(({ element, listSelector: itemListSelector }) => {
            let container = itemListSelector && currentPage.querySelector(itemListSelector);
            if (itemListSelector && !container) {
                container = page.querySelector(itemListSelector).cloneNode(false);
                const currentPageNumber = currentPage.querySelector(".page-number");
                if (currentPageNumber) {
                    currentPageNumber.before(container);
                } else {
                    currentPage.append(container);
                }
            }

            if (container) {
                container.append(element);
            } else {
                const currentPageNumber = currentPage.querySelector(".page-number");
                if (currentPageNumber) {
                    currentPageNumber.before(element);
                } else {
                    currentPage.append(element);
                }
            }

            if (currentPage.scrollHeight > currentPage.clientHeight + 1) {
                element.remove();
                const nextPage = createContinuationPage(page, ++continuationCount, null);
                if (itemListSelector) {
                    const nextContainer = page.querySelector(itemListSelector).cloneNode(false);
                    const nextPageNumber = nextPage.querySelector(".page-number");
                    if (nextPageNumber) {
                        nextPageNumber.before(nextContainer);
                    } else {
                        nextPage.append(nextContainer);
                    }
                    nextContainer.append(element);
                } else {
                    const nextPageNumber = nextPage.querySelector(".page-number");
                    if (nextPageNumber) {
                        nextPageNumber.before(element);
                    } else {
                        nextPage.append(element);
                    }
                }
                currentPage = nextPage;
                continuationPages.push(nextPage);
            }
        });

        return continuationPages;
    }

    function paginatePage(page) {
        if (mobileLayout) {
            return paginateMobilePage(page);
        }

        const list = page.querySelector(".entries, .projects, .facts");
        let currentPage = page;
        let currentItemContainer = list;
        let continuationCount = 0;
        const continuationPages = [];

        if (list) {
            const listSelector = list.classList.contains("projects")
                ? ".projects"
                : list.classList.contains("facts")
                    ? ".facts"
                    : ".entries";
            const items = Array.from(list.children);
            items.forEach((item) => item.remove());

            items.forEach((item) => {
                currentItemContainer.append(item);
                if (
                    currentPage.scrollHeight > currentPage.clientHeight + 1
                    && (
                        currentItemContainer.children.length > 1
                        || (currentPage === page && currentItemContainer.children.length === 1)
                    )
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
    const pages = spreads.flatMap((spread) => Array.from(spread.querySelectorAll(".book-page")));
    const paginatedPages = pages.flatMap((page) => [page, ...paginatePage(page)]);
    const bookPages = [];
    paginatedPages.forEach((page) => {
        bookPages.push(page);
        if (page.classList.contains("book-front-cover") && page.classList.contains("outer-cover")) {
            if (!mobileLayout) {
                bookPages.push(createInsideCover("front"));
            }
        }
    });

    spreads.forEach((spread) => spread.remove());
    measurementSpreads.forEach((spread) => spread.remove());
    for (let index = 0; index < bookPages.length;) {
        const spread = document.createElement("div");
        spread.className = "book-spread";
        const pageNumber = index + 1;
        const firstPage = bookPages[index];
        const isOuterCover = firstPage.classList.contains("outer-cover");
        const nextPageIsOuterCover = bookPages[index + 1]?.classList.contains("outer-cover");
        const pageCount = mobileLayout || isOuterCover || nextPageIsOuterCover ? 1 : 2;
        bookPages.slice(index, index + pageCount).forEach((page) => {
            const number = page.querySelector(".page-number");
            if (number) {
                number.textContent = String(pageNumber + spread.childElementCount).padStart(2, "0");
            }
            spread.append(page);
        });
        if (!mobileLayout && !isOuterCover && spread.childElementCount === 1) {
            const blankPage = document.createElement("section");
            blankPage.className = "book-page blank-page";
            blankPage.setAttribute("aria-hidden", "true");
            blankPage.inert = true;
            spread.append(blankPage);
        }
        index += pageCount;
        if (mobileLayout) {
            spread.classList.add("single-page");
        }
        if (isOuterCover) {
            spread.classList.add("single-page", "cover-spread");
            spread.classList.add(
                firstPage.classList.contains("book-front-cover")
                    ? "front-cover-spread"
                    : "back-cover-spread"
            );
        }
        book.append(spread);
    }
    spreads = Array.from(book.querySelectorAll(".book-spread"));

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

    function setBookPosition(spread) {
        // A closed book is centred on its cover; an open book is centred on its spine.
        book.classList.toggle("is-closed-front", spread.classList.contains("front-cover-spread"));
        book.classList.toggle("is-closed-back", spread.classList.contains("back-cover-spread"));
    }

    function clearTurnSheet() {
        window.clearTimeout(turnTimeout);
        book.querySelector(".page-turn-sheet")?.remove();
        book.classList.remove("is-sliding");
        spreads.forEach((spread) => {
            spread.classList.remove(
                "is-turn-underlay",
                "is-cover-turn-underlay",
                "is-turn-current",
                "is-turn-forward-underlay",
                "is-turn-back-underlay"
            );
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
        setBookPosition(spreads[activeSpread]);

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

    function finishTurnToSpread(targetIndex, pageId) {
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
        if (fullSpreadTurn) {
            front.append(cloneForTurn(currentSpread));
            back.append(cloneForTurn(targetSpread));
        } else {
            front.append(cloneForTurn(currentPage));
            back.append(cloneForTurn(reversePage));
        }
        if (!fullSpreadTurn) {
            currentPage.classList.add("is-turn-page-hidden");
            currentSpread.classList.add("is-turn-current");
        }
        const coverTurn = !fullSpreadTurn && (
            currentSpread.classList.contains("cover-spread")
            || targetSpread.classList.contains("cover-spread")
        );
        if (coverTurn) {
            // The page printed on the back of the turning sheet must not be
            // visible underneath before the sheet lands on it.
            reversePage.classList.add("is-turn-page-hidden");
            targetSpread.classList.add("is-cover-turn-underlay");
        }
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
        if (coverTurn) {
            book.classList.add("is-sliding");
            setBookPosition(targetSpread);
        }
        sheet.addEventListener("animationend", (event) => {
            if (event.target === sheet) {
                finishTurnToSpread(targetIndex, pageId);
            }
        });
        turnTimeout = window.setTimeout(() => finishTurnToSpread(targetIndex, pageId), 850);
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
