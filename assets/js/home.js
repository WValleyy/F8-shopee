(function () {
    const SEARCH_HISTORY_KEY = 'f8-shopee.home-search-history';
    const MAX_SEARCH_HISTORY_ITEMS = 6;
    const PRODUCTS_PER_PAGE = 10;
    const SORT_TYPES = {
        POPULAR: 'popular',
        NEWEST: 'newest',
        BEST_SELLING: 'best-selling',
        PRICE_ASC: 'price-asc',
        PRICE_DESC: 'price-desc',
    };
    const products = Array.isArray(window.F8_SHOPEE_PRODUCTS)
        ? window.F8_SHOPEE_PRODUCTS
        : [];
    const homeState = {
        activeCategory: 'all',
        activeSort: SORT_TYPES.POPULAR,
        currentPage: 1,
    };

    let refreshHomeProducts = () => {};

    const normalizeTerm = (term) => term.trim().replace(/\s+/g, ' ');

    const loadSearchHistory = () => {
        try {
            const rawValue = localStorage.getItem(SEARCH_HISTORY_KEY);

            if (!rawValue) {
                return [];
            }

            const parsedValue = JSON.parse(rawValue);

            return Array.isArray(parsedValue)
                ? parsedValue.filter(Boolean)
                : [];
        } catch (error) {
            return [];
        }
    };

    const saveSearchHistory = (items) => {
        localStorage.setItem(
            SEARCH_HISTORY_KEY,
            JSON.stringify(items.slice(0, MAX_SEARCH_HISTORY_ITEMS))
        );
    };

    const parsePriceValue = (value) => Number(String(value || '').replace(/[^\d]/g, '')) || 0;

    const parseSoldCount = (value) => {
        const normalizedValue = String(value || '')
            .toLowerCase()
            .replace(/\s+/g, '')
            .replace('đãbán', '')
            .replace('dạbán', '')
            .replace('dãbán', '');

        const kiloMatch = normalizedValue.match(/^([\d.,]+)k$/);

        if (kiloMatch) {
            return Math.round(Number(kiloMatch[1].replace(',', '.')) * 1000) || 0;
        }

        return Number(normalizedValue.replace(/[^\d]/g, '')) || 0;
    };

    const getProductPriceValue = (product) => {
        if (Number.isFinite(Number(product.priceValue))) {
            return Number(product.priceValue);
        }

        return parsePriceValue(product.priceCurrent);
    };

    const getProductSoldCount = (product) => {
        if (Number.isFinite(Number(product.soldCount))) {
            return Number(product.soldCount);
        }

        return parseSoldCount(product.sold);
    };

    const getProductPopularityScore = (product) => {
        if (Number.isFinite(Number(product.popularityScore))) {
            return Number(product.popularityScore);
        }

        return (getProductSoldCount(product) * 100) + (Number(product.rating) || 0) * 10;
    };

    const sortProducts = (items, sortType) => {
        const sortedItems = [...items];

        switch (sortType) {
            case SORT_TYPES.NEWEST:
                return sortedItems.sort((leftItem, rightItem) => (
                    (Number(rightItem.id) || 0) - (Number(leftItem.id) || 0)
                ));
            case SORT_TYPES.BEST_SELLING:
                return sortedItems.sort((leftItem, rightItem) => {
                    const soldDifference = getProductSoldCount(rightItem) - getProductSoldCount(leftItem);

                    if (soldDifference !== 0) {
                        return soldDifference;
                    }

                    return (Number(rightItem.id) || 0) - (Number(leftItem.id) || 0);
                });
            case SORT_TYPES.PRICE_ASC:
                return sortedItems.sort((leftItem, rightItem) => {
                    const priceDifference = getProductPriceValue(leftItem) - getProductPriceValue(rightItem);

                    if (priceDifference !== 0) {
                        return priceDifference;
                    }

                    return (Number(rightItem.id) || 0) - (Number(leftItem.id) || 0);
                });
            case SORT_TYPES.PRICE_DESC:
                return sortedItems.sort((leftItem, rightItem) => {
                    const priceDifference = getProductPriceValue(rightItem) - getProductPriceValue(leftItem);

                    if (priceDifference !== 0) {
                        return priceDifference;
                    }

                    return (Number(rightItem.id) || 0) - (Number(leftItem.id) || 0);
                });
            case SORT_TYPES.POPULAR:
            default:
                return sortedItems.sort((leftItem, rightItem) => {
                    const popularityDifference = getProductPopularityScore(rightItem) - getProductPopularityScore(leftItem);

                    if (popularityDifference !== 0) {
                        return popularityDifference;
                    }

                    return (Number(rightItem.id) || 0) - (Number(leftItem.id) || 0);
                });
        }
    };

    const createEmptyStateMarkup = () => `
        <div class="home-product__empty-state">
            <img src="assets/img/shopee_icon/no_purchase.png" alt="no purchase" class="home-product__empty-state-img">
            <h3 class="home-product__empty-state-heading">Chưa có sản phẩm</h3>
        </div>
    `;

    const renderProductStars = (rating) => {
        const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));

        return Array.from({ length: 5 }, (_, index) => `
            <i class="${index < safeRating ? 'home-product-item__star--gold ' : ''}fa-solid fa-star"></i>
        `).join('');
    };

    const renderProductCard = (product) => `
        <div class="grid__column-2-4">
            <a class="home-product-item" href="product.html">
                <div class="home-product-item__img" style="background-image: url('${product.image}');"></div>
                <h4 class="home-product-item__name">${product.name}</h4>
                <div class="home-product-item__price">
                    <span class="home-product-item__price-old">${product.priceOld}</span>
                    <span class="home-product-item__price-current">${product.priceCurrent}</span>
                </div>
                <div class="home-product-item__action">
                    <span class="home-product-item__like">
                        <i class="home-product-item__like-icon fa-solid fa-heart"></i>
                        <i class="home-product-item__like-icon fa-regular fa-heart"></i>
                    </span>
                    <span class="home-product-item__rating">
                        ${renderProductStars(product.rating)}
                    </span>
                    <span class="home-product-item__sold">${product.sold}</span>
                </div>
                <div class="home-product-item__favorite">
                    <i class="fa-solid fa-check"></i>
                    <span class="home-product-item__favorite-msg">Yêu thích</span>
                </div>
                <div class="home-product-item__sale-off">
                    <span class="home-product-item__sale-off-percent">${product.discount}</span>
                    <span class="home-product-item__sale-off-label">GIẢM</span>
                </div>
            </a>
        </div>
    `;

    const renderProducts = (productList, items) => {
        if (!items.length) {
            productList.innerHTML = createEmptyStateMarkup();
            return;
        }

        productList.innerHTML = items.map(renderProductCard).join('');
    };

    const filterProductsByCategory = (category) => {
        if (!category || category === 'all') {
            return products;
        }

        return products.filter((product) => product.category === category);
    };

    const getPageProducts = (items, currentPage) => {
        const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;

        return items.slice(startIndex, startIndex + PRODUCTS_PER_PAGE);
    };

    const renderPagination = (paginationList, currentPage, totalPages) => {
        if (!paginationList) {
            return;
        }

        if (!totalPages) {
            paginationList.innerHTML = '';
            paginationList.hidden = true;
            return;
        }

        paginationList.hidden = false;

        const previousDisabled = currentPage === 1;
        const nextDisabled = currentPage === totalPages;

        const pageItems = [
            `
                <li class="pagination-item ${previousDisabled ? 'pagination-item--disabled' : ''}">
                    <a href="#" class="pagination-item__link" data-page="${currentPage - 1}" data-navigation="prev">
                        <i class="pagination-item__icon fa-solid fa-chevron-left"></i>
                    </a>
                </li>
            `,
            Array.from({ length: totalPages }, (_, index) => {
                const page = index + 1;

                return `
                    <li class="pagination-item ${page === currentPage ? 'pagination-item--active' : ''}">
                        <a href="#" class="pagination-item__link" data-page="${page}">${page}</a>
                    </li>
                `;
            }).join(''),
            `
                <li class="pagination-item ${nextDisabled ? 'pagination-item--disabled' : ''}">
                    <a href="#" class="pagination-item__link" data-page="${currentPage + 1}" data-navigation="next">
                        <i class="pagination-item__icon fa-solid fa-chevron-right"></i>
                    </a>
                </li>
            `,
        ];

        paginationList.innerHTML = pageItems.join('');
    };

    const renderSearchHistory = (historyList, terms) => {
        historyList.innerHTML = '';

        if (!terms.length) {
            return;
        }

        terms.forEach((term) => {
            const listItem = document.createElement('li');
            listItem.className = 'searchbar-history__item';

            const link = document.createElement('a');
            link.href = '#';
            link.textContent = term;

            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'searchbar-history__remove';
            removeButton.textContent = 'Xóa';
            removeButton.dataset.term = term;

            listItem.appendChild(link);
            listItem.appendChild(removeButton);

            historyList.appendChild(listItem);
        });
    };

    const setupSearchBar = () => {
    const searchForm = document.querySelector('.shopee-searchbar');
    const searchInput = document.querySelector('.shopee-searchbar-input__input');
    const historyList = document.querySelector('.searchbar-history__list');
    const historyBox = document.querySelector('.searchbar-history');
    const searchWrapper = document.querySelector('.shopee-searchbar-wrapper');

    if (!searchForm || !searchInput || !historyList || !historyBox || !searchWrapper) {
        return;
    }

    renderSearchHistory(historyList, loadSearchHistory());

    // Hiện lịch sử
    searchInput.addEventListener('focus', () => {
        if (historyList.children.length) {
            historyBox.classList.add('searchbar-history--show');
        }
    });

    // Ẩn lịch sử khi click ra ngoài
    document.addEventListener('click', (event) => {
        if (!event.target.closest('.shopee-searchbar-wrapper')) {
            historyBox.classList.remove('searchbar-history--show');
        }
    });

    // Submit
    searchForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const searchTerm = normalizeTerm(searchInput.value);

        if (!searchTerm) {
            return;
        }

        const history = loadSearchHistory();

        const nextHistory = [
            searchTerm,
            ...history.filter((item) => item !== searchTerm),
        ].slice(0, MAX_SEARCH_HISTORY_ITEMS);

        saveSearchHistory(nextHistory);
        renderSearchHistory(historyList, nextHistory);

        searchInput.value = '';

        historyBox.classList.add('searchbar-history--show');
    });

    // Click trong lịch sử
    historyList.addEventListener('click', (event) => {

        const removeButton = event.target.closest('.searchbar-history__remove');

        if (removeButton) {
            event.preventDefault();
            event.stopPropagation();

            const term = removeButton.dataset.term;

            const nextHistory = loadSearchHistory().filter(
                (item) => item !== term
            );

            saveSearchHistory(nextHistory);
            renderSearchHistory(historyList, nextHistory);
            if (!nextHistory.length) {
                historyBox.classList.remove('searchbar-history--show');
            }

            return;
        }

        const link = event.target.closest('a');

        if (!link) {
            return;
        }

        event.preventDefault();

        searchInput.value = link.textContent.trim();
        searchInput.focus();
    });
    };

    const setupSortButtons = () => {
        const sortButtons = Array.from(document.querySelectorAll('.home-filter__btn[data-sort]'));
        const sortOptions = Array.from(document.querySelectorAll('.select-filter__item-link[data-sort]'));
        const sortOptionsItems = Array.from(document.querySelectorAll('.select-filter__item'));
        const sortLabel = document.querySelector('.select-filter__label');

        if (!sortButtons.length && !sortOptions.length) {
            return;
        }

        const sortLabelMap = {
            [SORT_TYPES.POPULAR]: 'Phổ biến',
            [SORT_TYPES.NEWEST]: 'Mới nhất',
            [SORT_TYPES.BEST_SELLING]: 'Bán chạy',
            [SORT_TYPES.PRICE_ASC]: 'Giá: Thấp đến cao',
            [SORT_TYPES.PRICE_DESC]: 'Giá: Cao đến thấp',
        };

        const syncSortUI = () => {
            sortButtons.forEach((button) => {
                button.classList.toggle('btn--primary', button.dataset.sort === homeState.activeSort);
            });

            sortOptionsItems.forEach((item) => {
                const sortOptionLink = item.querySelector('.select-filter__item-link');

                item.classList.toggle('select-filter__item--active', sortOptionLink?.dataset.sort === homeState.activeSort);
            });

            if (sortLabel) {
                sortLabel.dataset.defaultLabel ??= sortLabel.textContent.trim();
                sortLabel.textContent = sortLabelMap[homeState.activeSort] || sortLabel.dataset.defaultLabel || 'Giá';
            }
        };

        const setActiveSort = (nextSortType) => {
            homeState.activeSort = nextSortType;
            homeState.currentPage = 1;
            syncSortUI();
            refreshHomeProducts();
        };

        sortButtons.forEach((button) => {
            button.addEventListener('click', () => {
                setActiveSort(button.dataset.sort || SORT_TYPES.POPULAR);
            });
        });

        sortOptions.forEach((sortOption) => {
            sortOption.addEventListener('click', (event) => {
                event.preventDefault();

                setActiveSort(sortOption.dataset.sort || SORT_TYPES.PRICE_ASC);
            });
        });

        syncSortUI();
    };

    const setupProductNavigation = () => {
        const categoryLinks = Array.from(document.querySelectorAll('.category-item__link'));
        const productList = document.querySelector('.home-product .grid__row');
        const paginationList = document.querySelector('.home-product__pagination');
        const pageCurrent = document.querySelector('.home-filter__page-current');
        const pageTotal = document.querySelector('.home-filter__page-total');
        const pageControlButtons = Array.from(document.querySelectorAll('.home-filter__page-btn'));

        if (!categoryLinks.length || !productList || !paginationList) {
            return;
        }

        const isTypingField = (target) => {
            const element = target instanceof Element ? target : null;

            return Boolean(
                element?.closest('input, textarea, select, [contenteditable="true"]')
            );
        };

        const getFilteredProducts = () => filterProductsByCategory(homeState.activeCategory);

        const getSortedProducts = () => sortProducts(getFilteredProducts(), homeState.activeSort);

        const getTotalPages = (filteredProducts) => Math.max(
            0,
            Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE)
        );

        const goToPage = (nextPage) => {
            const filteredProducts = getSortedProducts();

            if (!filteredProducts.length) {
                return;
            }

            const totalPages = getTotalPages(filteredProducts);
            const boundedPage = Math.min(Math.max(1, nextPage), totalPages);

            homeState.currentPage = boundedPage;
            syncView();
        };

        const goToPreviousPage = () => {
            goToPage(currentPage - 1);
        };

        const goToNextPage = () => {
            goToPage(currentPage + 1);
        };

        const updatePageControls = (totalPages) => {
            pageControlButtons.forEach((button, index) => {
                const isPreviousButton = button.dataset.navigation === 'prev' || index === 0;
                const isDisabled = totalPages <= 1
                    || (isPreviousButton && homeState.currentPage === 1)
                    || (!isPreviousButton && homeState.currentPage === totalPages);

                button.classList.toggle('btn--disable', isDisabled);
                button.setAttribute('aria-disabled', String(isDisabled));
            });
        };

        const syncView = () => {
            const filteredProducts = getSortedProducts();
            const totalPages = getTotalPages(filteredProducts);

            if (filteredProducts.length) {
                homeState.currentPage = Math.min(homeState.currentPage, totalPages);
            }

            const pageProducts = filteredProducts.length
                ? getPageProducts(filteredProducts, homeState.currentPage)
                : [];

            categoryLinks.forEach((currentLink) => {
                currentLink.closest('.category-item')
                    ?.classList.toggle(
                        'category-item--active',
                        (currentLink.dataset.category || 'all') === homeState.activeCategory
                    );
            });

            if (pageCurrent) {
                pageCurrent.textContent = String(filteredProducts.length ? homeState.currentPage : 0);
            }

            if (pageTotal) {
                pageTotal.textContent = String(filteredProducts.length ? totalPages : 0);
            }

            updatePageControls(totalPages || 1);

            if (!filteredProducts.length) {
                renderProducts(productList, []);
                renderPagination(paginationList, 0, 0);
                return;
            }

            renderProducts(productList, pageProducts);
            renderPagination(paginationList, homeState.currentPage, totalPages);
        };

        refreshHomeProducts = syncView;

        categoryLinks.forEach((link) => {
            link.addEventListener('click', (event) => {
                event.preventDefault();

                homeState.activeCategory = link.dataset.category || 'all';
                homeState.currentPage = 1;
                syncView();
            });
        });

        paginationList.addEventListener('click', (event) => {
            const paginationLink = event.target.closest('.pagination-item__link');

            if (!paginationLink || paginationLink.parentElement?.classList.contains('pagination-item--disabled')) {
                return;
            }

            event.preventDefault();

            const nextPage = Number(paginationLink.dataset.page);
            const filteredProducts = filterProductsByCategory(activeCategory);
            const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE));

            if (!Number.isFinite(nextPage) || nextPage < 1 || nextPage > totalPages) {
                return;
            }

            goToPage(nextPage);
        });

        pageControlButtons.forEach((button, index) => {
            button.setAttribute('data-navigation', index === 0 ? 'prev' : 'next');
            button.addEventListener('click', (event) => {
                event.preventDefault();

                if (button.classList.contains('btn--disable')) {
                    return;
                }

                if (button.dataset.navigation === 'prev' || index === 0) {
                    goToPreviousPage();
                    return;
                }

                goToNextPage();
            });
        });

        document.addEventListener('keydown', (event) => {
            if (isTypingField(event.target)) {
                return;
            }

            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                goToPreviousPage();
            }

            if (event.key === 'ArrowRight') {
                event.preventDefault();
                goToNextPage();
            }
        });

        syncView();
    };

    const setupWishlistToggle = () => {
        const productList = document.querySelector('.home-product .grid__row');

        if (!productList) {
            return;
        }

        productList.addEventListener('click', (event) => {
            const wishButton = event.target.closest('.home-product-item__like');

            if (!wishButton) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            wishButton.classList.toggle('home-product-item__like--liked');
        });
    };

    document.addEventListener('DOMContentLoaded', () => {
        setupSearchBar();
        setupSortButtons();
        setupProductNavigation();
        setupWishlistToggle();
    });
})();