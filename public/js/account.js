// ================= Constants =================

const PARTIAL_REQUEST_HEADER = 'X-Partial-Request';

const SELECTORS = {
    content: '[data-account-content]',
    sidebarLink: '[data-account-link]',
};

const ACTIVE_CLASS = 'account-sidebar__link--active';
const LOADING_CLASS = 'is-loading';


// ================= DOM =================

const content = document.querySelector(SELECTORS.content);

const sidebarLinks = [
    ...document.querySelectorAll(SELECTORS.sidebarLink),
];


// ================= State =================

let abortController = null;

const pageInitializers = {};


// ================= Init =================

init();

function init() {

    if (!content)
        return;

    bindEvents();

    updateActiveSidebar(window.location.pathname);

    initializeCurrentPage();

}


// ================= Event Binding =================

function bindEvents() {

    sidebarLinks.forEach(link => {

        link.addEventListener(
            'click',
            handleSidebarClick,
        );

    });

    window.addEventListener(
        'popstate',
        handlePopState,
    );

}


// ================= Event Handlers =================

async function handleSidebarClick(event) {

    const path = new URL(
        event.currentTarget.href,
    ).pathname;

    if (path === window.location.pathname)
        return;

    event.preventDefault();

    await navigate(path);

}


async function handlePopState() {

    await navigate(
        window.location.pathname,
        false,
    );

}


// ================= Navigation =================

async function navigate(path, pushState = true) {

    abortCurrentRequest();

    abortController = new AbortController();

    showLoading();

    try {

        const html = await fetchPartial(
            path,
            abortController.signal,
        );

        render(html);

        updateActiveSidebar(path);

        initializeCurrentPage();

        if (pushState) {

            history.pushState(
                { path },
                '',
                path,
            );

        }

    } catch (error) {

        if (error.name === 'AbortError')
            return;

        console.error(error);

        window.location.href = path;

    } finally {

        hideLoading();

    }

}


// ================= Fetch =================

async function fetchPartial(path, signal) {

    const response = await fetch(path, {

        headers: {
            [PARTIAL_REQUEST_HEADER]: 'true',
        },

        signal,

    });

    if (!response.ok)
        throw new Error('Failed to load page.');

    return response.text();

}


// ================= Render =================

function render(html) {

    content.innerHTML = html;

}


// ================= Sidebar =================

function updateActiveSidebar(path) {

    sidebarLinks.forEach(link => {

        const isActive =
            new URL(link.href).pathname === path;

        link.classList.toggle(
            ACTIVE_CLASS,
            isActive,
        );

    });

}


// ================= Loading =================

function showLoading() {

    content.classList.add(
        LOADING_CLASS,
    );

}


function hideLoading() {

    content.classList.remove(
        LOADING_CLASS,
    );

}


// ================= Abort =================

function abortCurrentRequest() {

    abortController?.abort();

}


// ================= Page =================

function initializeCurrentPage() {

    pageInitializers[
        window.location.pathname
    ]?.();

}