function mountProductSpecifications({ root, signal }) {
  const form = root.querySelector("[data-product-form]");
  const list = root.querySelector("[data-specification-list]");
  const template = root.querySelector("[data-specification-row-template]");
  const categoryField = form.elements.categoryId;
  const maxSpecifications = Number(root.dataset.maxSpecifications);
  const addButton = root.querySelector("[data-add-specification]");

  function syncAddButton() {
    const categoryId = categoryField.value;
    const usedAttributeIds = new Set(
      [...list.querySelectorAll("[data-specification-attribute]")]
        .map(select => select.value)
        .filter(Boolean),
    );
    const hasAvailableAttribute = [...template.content.querySelectorAll("option")].some(
      option => option.value
        && option.dataset.categoryId === categoryId
        && !usedAttributeIds.has(option.value),
    );

    addButton.disabled = !categoryId
      || !hasAvailableAttribute
      || list.children.length >= maxSpecifications;
  }

  function filterAttributes() {
    const categoryId = categoryField.value;

    list.querySelectorAll("[data-specification-attribute]").forEach((select) => {
      [...select.options].forEach((option) => {
        if (!option.value) {
          option.hidden = false;
          return;
        }

        option.hidden = Boolean(categoryId) && option.dataset.categoryId !== categoryId;
      });

      const selectedOption = select.options[select.selectedIndex];
      if (selectedOption?.hidden) {
        select.value = "";
        select
          .closest("[data-specification-row]")
          .querySelector("[data-specification-value]").value = "";
      }
    });

    syncAddButton();
  }

  function collect() {
    const specifications = [];

    list.querySelectorAll("[data-specification-row]").forEach((row, index) => {
      const attributeId = row.querySelector("[data-specification-attribute]").value;
      const value = row.querySelector("[data-specification-value]").value.trim();

      if (!attributeId && !value) return;
      if (!attributeId || !value) {
        throw new Error(`Vui lòng hoàn thành thông số thứ ${index + 1}.`);
      }

      specifications.push({ attributeId, value });
    });

    return specifications;
  }

  addButton.addEventListener(
    "click",
    () => {
      list.append(template.content.firstElementChild.cloneNode(true));
      filterAttributes();
      list.lastElementChild.querySelector("[data-specification-attribute]").focus();
    },
    { signal },
  );

  list.addEventListener(
    "click",
    (event) => {
      const removeButton = event.target.closest("[data-remove-specification]");
      if (!removeButton) return;

      removeButton.closest("[data-specification-row]").remove();
      syncAddButton();
    },
    { signal },
  );

  categoryField.addEventListener("change", filterAttributes, { signal });
  filterAttributes();

  return { collect };
}

export { mountProductSpecifications };
