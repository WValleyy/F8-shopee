'use strict';

(function () {

    /* ==========================================================
        Selector
    ========================================================== */

    const $ = (selector) => document.querySelector(selector);

    const $$ = (selector) => [...document.querySelectorAll(selector)];

    /* ==========================================================
        Storage
    ========================================================== */

    const STORAGE_KEYS = {
        USERS: 'f8_users',
        CURRENT_USER: 'f8_current_user'
    };

    /* ==========================================================
        Header
    ========================================================== */

    const guestItems = $$('.header__navbar-item--guest');

    const userItem = $('.header__navbar-item-user');

    const userName = $('.header__navbar-user-name');

    const logoutBtn = $('#logout-btn');

    /* ==========================================================
        Modal
    ========================================================== */

    const modal = $('#auth-modal');

    const overlay = $('.modal__overlay');

    const closeButtons = $$('.auth-close');

    /* ==========================================================
        Open Modal Button
    ========================================================== */

    const loginBtn = $('#login-btn');

    const registerBtn = $('#register-btn');

    /* ==========================================================
        Auth Form
    ========================================================== */

    const loginForm = $('.auth-form--login');

    const registerForm = $('.auth-form--register');

    const switchButtons = $$('[data-switch]');

    /* ==========================================================
        Register
    ========================================================== */

    const registerName = $('#register-name');

    const registerEmail = $('#register-email');

    const registerPassword = $('#register-password');

    const registerConfirmPassword = $('#register-confirm-password');

    const registerSubmit = $('#register-submit');

    /* ==========================================================
        Login
    ========================================================== */

    const loginEmail = $('#login-email');

    const loginPassword = $('#login-password');

    const loginSubmit = $('#login-submit');

    /* ==========================================================
        Storage
    ========================================================== */

    function getUsers() {

        return JSON.parse(
            localStorage.getItem(STORAGE_KEYS.USERS)
        ) ?? [];

    }

    function saveUsers(users) {

        localStorage.setItem(
            STORAGE_KEYS.USERS,
            JSON.stringify(users)
        );

    }

    function getCurrentUser() {

        return JSON.parse(
            localStorage.getItem(STORAGE_KEYS.CURRENT_USER)
        );

    }

    function saveCurrentUser(user) {

        localStorage.setItem(
            STORAGE_KEYS.CURRENT_USER,
            JSON.stringify(user)
        );

    }

    function removeCurrentUser() {

        localStorage.removeItem(
            STORAGE_KEYS.CURRENT_USER
        );

    }

    /* ==========================================================
        Modal
    ========================================================== */

    function openModal() {

        modal.classList.remove('is-hidden');

    }

    function closeModal() {

        clearRegisterForm();

        clearLoginForm();

        showLoginForm();

        modal.classList.add('is-hidden');

    }

    function showLoginForm() {

        loginForm.classList.remove('is-hidden');

        registerForm.classList.add('is-hidden');

    }

    function showRegisterForm() {

        registerForm.classList.remove('is-hidden');

        loginForm.classList.add('is-hidden');

    }

    function setupModal() {

        loginBtn.addEventListener('click', (event) => {

            event.preventDefault();

            openModal();

            showLoginForm();

        });

        registerBtn.addEventListener('click', (event) => {

            event.preventDefault();

            openModal();

            showRegisterForm();

        });

        overlay.addEventListener(
            'click',
            closeModal
        );

        closeButtons.forEach(button => {

            button.addEventListener(
                'click',
                closeModal
            );

        });

    }

    function setupSwitchForm() {

        switchButtons.forEach(button => {

            button.addEventListener('click', () => {

                const target = button.dataset.switch;

                if (target === 'login') {

                    showLoginForm();

                }

                else {

                    showRegisterForm();

                }

            });

        });

    }

    /* ==========================================================
        Validator
    ========================================================== */

    function showError(input, message) {

        const group = input.closest('.auth-form__group');

        const messageElement = group.querySelector('.auth-form__message');

        input.classList.add('auth-form__input--error');

        messageElement.textContent = message;

    }

    function clearError(input) {

        const group = input.closest('.auth-form__group');

        const messageElement = group.querySelector('.auth-form__message');

        input.classList.remove('auth-form__input--error');

        messageElement.textContent = '';

    }

    function validateEmail(email) {

        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    }

    function validateRegister() {

        let isValid = true;

        [
            registerName,
            registerEmail,
            registerPassword,
            registerConfirmPassword
        ].forEach(clearError);

        if (!registerName.value.trim()) {

            showError(
                registerName,
                'Vui lòng nhập tên.'
            );

            isValid = false;

        }

        if (!registerEmail.value.trim()) {

            showError(
                registerEmail,
                'Vui lòng nhập email.'
            );

            isValid = false;

        }

        else if (!validateEmail(registerEmail.value.trim())) {

            showError(
                registerEmail,
                'Email không hợp lệ.'
            );

            isValid = false;

        }

        if (!registerPassword.value) {

            showError(
                registerPassword,
                'Vui lòng nhập mật khẩu.'
            );

            isValid = false;

        }

        else if (registerPassword.value.length < 6) {

            showError(
                registerPassword,
                'Mật khẩu phải có ít nhất 6 ký tự.'
            );

            isValid = false;

        }

        if (!registerConfirmPassword.value) {

            showError(
                registerConfirmPassword,
                'Vui lòng xác nhận mật khẩu.'
            );

            isValid = false;

        }

        else if (
            registerConfirmPassword.value !==
            registerPassword.value
        ) {

            showError(
                registerConfirmPassword,
                'Mật khẩu xác nhận không khớp.'
            );

            isValid = false;

        }

        return isValid;

    }

    function validateLogin() {

        let isValid = true;

        [
            loginEmail,
            loginPassword
        ].forEach(clearError);

        if (!loginEmail.value.trim()) {

            showError(
                loginEmail,
                'Vui lòng nhập email.'
            );

            isValid = false;

        }

        else if (!validateEmail(loginEmail.value.trim())) {

            showError(
                loginEmail,
                'Email không hợp lệ.'
            );

            isValid = false;

        }

        if (!loginPassword.value) {

            showError(
                loginPassword,
                'Vui lòng nhập mật khẩu.'
            );

            isValid = false;

        }

        return isValid;

    }

    /* ==========================================================
        Register
    ========================================================== */

    function setupRegister() {

        registerSubmit.addEventListener('click', () => {

            if (!validateRegister()) {

                return;

            }

            const users = getUsers();

            const email = registerEmail.value.trim();

            const existedUser = users.find(user => {

                return user.email === email;

            });

            if (existedUser) {

                showError(
                    registerEmail,
                    'Email đã được sử dụng.'
                );

                return;

            }

            const newUser = {

                id: crypto.randomUUID(),

                name: registerName.value.trim(),

                email,

                password: registerPassword.value,

                avatar: 'https://media.tenor.com/S8Vv6-uLUA0AAAAM/cute-cat.gif',

                createdAt: Date.now()

            };

            users.push(newUser);

            saveUsers(users);

            saveCurrentUser(newUser);

            renderHeader();

            closeModal();

        });

    }

    /* ==========================================================
        Clear Form
    ========================================================== */

    function clearRegisterForm() {

        registerName.value = '';

        registerEmail.value = '';

        registerPassword.value = '';

        registerConfirmPassword.value = '';

        [
            registerName,
            registerEmail,
            registerPassword,
            registerConfirmPassword
        ].forEach(clearError);

    }

    function clearLoginForm() {

        loginEmail.value = '';

        loginPassword.value = '';

        [
            loginEmail,
            loginPassword
        ].forEach(clearError);

    }

    /* ==========================================================
        Login
    ========================================================== */

    function setupLogin() {

        loginSubmit.addEventListener('click', () => {

            if (!validateLogin()) {

                return;

            }

            const users = getUsers();

            const email = loginEmail.value.trim();

            const password = loginPassword.value;

            const currentUser = users.find(user => {

                return (
                    user.email === email &&
                    user.password === password
                );

            });

            if (!currentUser) {

                showError(
                    loginPassword,
                    'Email hoặc mật khẩu không đúng.'
                );

                return;

            }

            saveCurrentUser(currentUser);

            renderHeader();

            closeModal();

        });

    }

    /* ==========================================================
        Logout
    ========================================================== */

    function setupLogout() {

        logoutBtn.addEventListener('click', (event) => {

            event.preventDefault();

            removeCurrentUser();

            renderHeader();

        });

    }

    /* ==========================================================
        Header
    ========================================================== */

    function renderHeader() {

        const currentUser = getCurrentUser();

        if (currentUser) {

            guestItems.forEach(item => {

                item.classList.add('is-hidden');

            });

            userItem.classList.remove('is-hidden');

            userName.textContent = currentUser.name;

        }

        else {

            guestItems.forEach(item => {

                item.classList.remove('is-hidden');

            });

            userItem.classList.add('is-hidden');

        }

    }

    /* ==========================================================
        Init
    ========================================================== */

    function init() {

        setupModal();

        setupSwitchForm();

        setupRegister();

        setupLogin();

        setupLogout();

        renderHeader();

    }

    init();

})();