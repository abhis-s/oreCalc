export function getNavigationDOMElements() {
    return {
        tabs: {
            buttons: document.querySelectorAll('.tab-button, .nav-button, .navigation-drawer__tab'),
            contents: document.querySelectorAll('.tab-content'),
        },
        drawer: {
            button: document.querySelector('.hamburger'),
            drawer: document.querySelector('.navigation-drawer'),
            overlay: document.querySelector('.navigation-drawer__overlay'),
            close: document.querySelector('.navigation-drawer__close'),
            tabs: document.querySelectorAll('.navigation-drawer__tab'),
        },
        fab: {
            main: document.getElementById('main-fab'),
            menu: document.querySelector('.fab-menu'),
            pills: {
                refresh: document.getElementById('fab-refresh-pill'),
                saveData: document.getElementById('fab-save-data-pill'),
            },
        },
    };
}
