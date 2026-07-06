(function () {
    const CART_STORAGE_KEY = 'f8-shopee.cart';

    const parsePrice = (value) => {
        const numericValue = String(value || '').replace(/[^\d]/g, '');
        return numericValue ? Number(numericValue) : 0;
    };

    const formatPrice = (value) => new Intl.NumberFormat('vi-VN').format(Math.max(0, Math.round(value)));

    const loadCartItems = () => {
        try {
            const rawValue = localStorage.getItem(CART_STORAGE_KEY);

            if (!rawValue) {
                return [];
            }

            const parsedValue = JSON.parse(rawValue);

            if (!Array.isArray(parsedValue)) {
                return [];
            }

            return parsedValue.map((item) => ({
                ...item,
                quantity: Math.max(1, Number(item.quantity) || 1),
                selected: Boolean(item.selected),
                removed: Boolean(item.removed),
                price: Number(item.price) || 0,
            }));
        } catch (error) {
            return [];
        }
    };

    const saveCartItems = (items) => {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    };

    const seedCartFromRows = (rows) => rows.map((row) => ({
        name: row.querySelector('.cart__product-name')?.textContent.trim() || '',
        classify: row.querySelector('.cart__product-classify')?.textContent.trim() || '',
        image: row.querySelector('.cart__product-img')?.getAttribute('src') || '',
        price: parsePrice(row.querySelector('.cart__price')?.textContent),
        quantity: Math.max(1, Number(row.querySelector('.cart__quantity input')?.value) || 1),
        selected: row.querySelector('.cart__checkbox')?.checked ?? true,
        removed: false,
    }));

    const syncHeaderCartNotice = () => {
        const activeItemCount = loadCartItems().filter((item) => !item.removed).length;

        document.querySelectorAll('.header__cart-notice').forEach((notice) => {
            notice.textContent = String(activeItemCount);
            notice.hidden = activeItemCount === 0;
        });
    };

    const setupPurchaseFilters = () => {
        const filterButtons = document.querySelectorAll('.purchase-filter__item');

        if (!filterButtons.length) {
            return;
        }

        filterButtons.forEach((button) => {
            button.addEventListener('click', () => {
                filterButtons.forEach((currentButton) => {
                    currentButton.classList.remove('purchase-filter__item--active');
                });

                button.classList.add('purchase-filter__item--active');
            });
        });
    };

    const setupCheckoutPayments = () => {
        const paymentButtons = document.querySelectorAll('.checkout-payment__item');

        if (!paymentButtons.length) {
            return;
        }

        paymentButtons.forEach((button) => {
            button.addEventListener('click', () => {
                paymentButtons.forEach((currentButton) => {
                    currentButton.classList.remove('checkout-payment__item--active');
                });

                button.classList.add('checkout-payment__item--active');
            });
        });
    };

    const setupCartPage = () => {
        const cartRows = Array.from(document.querySelectorAll('.cart__item'));

        if (!cartRows.length) {
            return;
        }

        const storedItems = loadCartItems();
        const cartItems = cartRows.map((row, index) => {
            const seededItem = seedCartFromRows([row])[0];

            return {
                ...seededItem,
                ...storedItems[index],
                quantity: Math.max(1, Number(storedItems[index]?.quantity ?? seededItem.quantity) || 1),
                selected: storedItems[index]?.selected ?? seededItem.selected,
                removed: storedItems[index]?.removed ?? false,
            };
        });

        const headerSelectAllCheckbox = document.querySelector('.cart__header .cart__checkbox');
        const footerSelectAllCheckbox = document.querySelector('.cart-footer .cart__checkbox');
        const footerSummaryLabel = document.querySelector('.cart-footer__left span');
        const footerSummaryTotal = document.querySelector('.cart-footer__right strong');
        const deleteSelectedButton = document.querySelector('.cart-footer__left a');

        const renderCart = () => {
            cartRows.forEach((row, index) => {
                const currentItem = cartItems[index];

                if (!currentItem) {
                    return;
                }

                row.hidden = currentItem.removed;

                if (currentItem.removed) {
                    return;
                }

                const checkbox = row.querySelector('.cart__checkbox');
                const quantityInput = row.querySelector('.cart__quantity input');
                const decreaseButton = row.querySelector('.cart__quantity button:first-of-type');
                const increaseButton = row.querySelector('.cart__quantity button:last-of-type');
                const priceElement = row.querySelector('.cart__price');
                const totalElement = row.querySelector('.cart__total');
                const removeButton = row.querySelector('.cart__action a');

                if (checkbox) {
                    checkbox.checked = currentItem.selected;
                }

                if (quantityInput) {
                    quantityInput.value = String(currentItem.quantity);
                }

                if (priceElement) {
                    priceElement.innerHTML = `${formatPrice(currentItem.price)}<sup>đ</sup>`;
                }

                if (totalElement) {
                    totalElement.textContent = `₫${formatPrice(currentItem.price * currentItem.quantity)}`;
                }

                if (quantityInput && !quantityInput.dataset.bound) {
                    quantityInput.dataset.bound = 'true';
                    quantityInput.addEventListener('change', () => {
                        const nextQuantity = Math.max(1, Number(quantityInput.value) || 1);

                        currentItem.quantity = nextQuantity;
                        saveCartItems(cartItems);
                        renderCart();
                    });
                }

                if (decreaseButton && !decreaseButton.dataset.bound) {
                    decreaseButton.dataset.bound = 'true';
                    decreaseButton.addEventListener('click', (event) => {
                        event.preventDefault();
                        currentItem.quantity = Math.max(1, currentItem.quantity - 1);
                        saveCartItems(cartItems);
                        renderCart();
                    });
                }

                if (increaseButton && !increaseButton.dataset.bound) {
                    increaseButton.dataset.bound = 'true';
                    increaseButton.addEventListener('click', (event) => {
                        event.preventDefault();
                        currentItem.quantity += 1;
                        saveCartItems(cartItems);
                        renderCart();
                    });
                }

                if (checkbox && !checkbox.dataset.bound) {
                    checkbox.dataset.bound = 'true';
                    checkbox.addEventListener('change', () => {
                        currentItem.selected = checkbox.checked;
                        saveCartItems(cartItems);
                        renderCart();
                    });
                }

                if (removeButton && !removeButton.dataset.bound) {
                    removeButton.dataset.bound = 'true';
                    removeButton.addEventListener('click', (event) => {
                        event.preventDefault();
                        currentItem.removed = true;
                        saveCartItems(cartItems);
                        renderCart();
                    });
                }
            });

            const activeItems = cartItems.filter((item) => !item.removed);
            const selectedItems = activeItems.filter((item) => item.selected);
            const selectedAmount = selectedItems.reduce((total, item) => total + item.price * item.quantity, 0);
            const areAllActiveItemsSelected = activeItems.length > 0 && activeItems.every((item) => item.selected);

            if (headerSelectAllCheckbox) {
                headerSelectAllCheckbox.checked = areAllActiveItemsSelected;
                headerSelectAllCheckbox.indeterminate = selectedItems.length > 0 && !areAllActiveItemsSelected;

                if (!headerSelectAllCheckbox.dataset.bound) {
                    headerSelectAllCheckbox.dataset.bound = 'true';
                    headerSelectAllCheckbox.addEventListener('change', () => {
                        cartItems.forEach((item) => {
                            if (!item.removed) {
                                item.selected = headerSelectAllCheckbox.checked;
                            }
                        });

                        saveCartItems(cartItems);
                        renderCart();
                    });
                }
            }

            if (footerSelectAllCheckbox) {
                footerSelectAllCheckbox.checked = areAllActiveItemsSelected;
                footerSelectAllCheckbox.indeterminate = selectedItems.length > 0 && !areAllActiveItemsSelected;

                if (!footerSelectAllCheckbox.dataset.bound) {
                    footerSelectAllCheckbox.dataset.bound = 'true';
                    footerSelectAllCheckbox.addEventListener('change', () => {
                        cartItems.forEach((item) => {
                            if (!item.removed) {
                                item.selected = footerSelectAllCheckbox.checked;
                            }
                        });

                        saveCartItems(cartItems);
                        renderCart();
                    });
                }
            }

            if (footerSummaryLabel) {
                footerSummaryLabel.textContent = `Chọn tất cả (${activeItems.length})`;
            }

            if (footerSummaryTotal) {
                footerSummaryTotal.textContent = `₫${formatPrice(selectedAmount)}`;
            }

            if (deleteSelectedButton && !deleteSelectedButton.dataset.bound) {
                deleteSelectedButton.dataset.bound = 'true';
                deleteSelectedButton.addEventListener('click', (event) => {
                    event.preventDefault();

                    cartItems.forEach((item) => {
                        if (item.selected) {
                            item.removed = true;
                        }
                    });

                    saveCartItems(cartItems);
                    renderCart();
                });
            }
        };

        saveCartItems(cartItems);
        renderCart();
    };

    document.addEventListener('DOMContentLoaded', () => {
        setupHeaderCartNavigation();
        syncHeaderCartNotice();
        setupCartPage();
        setupPurchaseFilters();
        setupCheckoutPayments();
        syncHeaderCartNotice();
    });
})();