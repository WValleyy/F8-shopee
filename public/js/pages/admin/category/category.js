import { requestJson } from "../../../shared/api/http-client.js";
import {
  close as closeModal,
  open as openModal,
} from "../../../shared/ui/modal.js";

function mount({ refreshPage, root, signal }) {
  const form = root.querySelector('[data-admin-editor-form="category"]');

  function openEditor(button) {
    const dialog = root.querySelector('[data-admin-editor-dialog="category"]');
    const row = button.closest("[data-admin-category-id]");

    form.reset();
    form.elements.id.value = "";
    form.querySelector("[data-form-notice]").textContent = "";
    [...form.elements.parentId.options].forEach((option) => {
      option.disabled = false;
    });

    if (row) {
      form.elements.id.value = row.dataset.adminCategoryId;
      form.elements.name.value = row.dataset.name;
      form.elements.parentId.value = row.dataset.parentId;
      form.elements.sortOrder.value = row.dataset.sortOrder;
      form.elements.isActive.checked = row.dataset.isActive === "true";
      const selfOption = [...form.elements.parentId.options].find(
        (option) => option.value === row.dataset.adminCategoryId,
      );

      if (selfOption) selfOption.disabled = true;

      form.querySelector("[data-editor-title]").textContent =
        "Chỉnh sửa danh mục";
    } else {
      form.querySelector("[data-editor-title]").textContent = "Thêm danh mục";
    }

    openModal(dialog, button);
  }

  root.addEventListener(
    "click",
    (event) => {
      const editorButton = event.target.closest(
        '[data-open-admin-editor="category"], [data-edit-admin-category]',
      );

      if (editorButton) {
        openEditor(editorButton);
      }
    },
    { signal },
  );

  form.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();
      const id = form.elements.id.value;
      const submit = form.querySelector('[type="submit"]');
      const notice = form.querySelector("[data-form-notice]");

      submit.disabled = true;

      try {
        await requestJson(
          id ? `/api/admin/categories/${id}` : "/api/admin/categories",
          {
            method: id ? "PATCH" : "POST",
            body: {
              name: form.elements.name.value,
              parentId: form.elements.parentId.value,
              sortOrder: Number(form.elements.sortOrder.value),
              isActive: form.elements.isActive.checked,
            },
            signal,
          },
        );
        closeModal(form.closest("[data-admin-editor-dialog]"), {
          reason: "success",
        });
        await refreshPage();
      } catch (error) {
        notice.textContent = error.message;
      } finally {
        submit.disabled = false;
      }
    },
    { signal },
  );
}

export { mount };
