function mountProductMedia({ root, signal }) {
  const gallery = root.querySelector("[data-product-gallery]");
  const imageTemplate = root.querySelector("[data-product-image-template]");
  const input = root.querySelector("[data-product-images]");
  const errorElement = root.querySelector("[data-image-error]");
  const newImages = new Map();
  const maxImages = Number(root.dataset.maxProductImages);
  const maxUploadBytes = Number(root.dataset.maxProductUploadBytes);
  const maxImageBytes = Number(root.dataset.maxProductImageBytes);
  const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

  function removeImage(item) {
    const pending = newImages.get(item.dataset.imageKey);

    if (pending) {
      URL.revokeObjectURL(pending.previewUrl);
      newImages.delete(item.dataset.imageKey);
    }

    item.remove();
  }

  function createPreview(key, previewUrl) {
    const item = imageTemplate.content.firstElementChild.cloneNode(true);
    const image = item.querySelector("[data-product-image-preview]");

    item.dataset.imageKey = key;
    image.src = previewUrl;
    gallery.append(item);
  }

  gallery.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest("[data-remove-image]");

      if (button) removeImage(button.closest("[data-image-key]"));
    },
    { signal },
  );

  input.addEventListener(
    "change",
    () => {
      const files = [...input.files];

      errorElement.textContent = "";

      if (
        gallery.querySelectorAll("[data-image-key]").length + files.length >
        maxImages
      ) {
        errorElement.textContent = `Sản phẩm chỉ được có tối đa ${maxImages} ảnh.`;
        input.value = "";
        return;
      }

      const pendingBytes = [...newImages.values()].reduce(
        (total, image) => total + image.file.size,
        0,
      );
      const selectedBytes = files.reduce((total, file) => total + file.size, 0);

      if (pendingBytes + selectedBytes > maxUploadBytes) {
        errorElement.textContent =
          `Tổng dung lượng ảnh tải lên không được vượt quá ` +
          `${Math.ceil(maxUploadBytes / (1024 * 1024))} MB.`;
        input.value = "";
        return;
      }

      if (files.some((file) => !imageTypes.has(file.type))) {
        errorElement.textContent = "Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.";
        input.value = "";
        return;
      }

      if (files.some((file) => file.size > maxImageBytes)) {
        errorElement.textContent = `Dung lượng mỗi ảnh không được vượt quá ${Math.ceil(maxImageBytes / (1024 * 1024))} MB.`;
        input.value = "";
        return;
      }

      files.forEach((file) => {
        const key = `new:${window.crypto.randomUUID()}`;
        const previewUrl = URL.createObjectURL(file);

        newImages.set(key, { file, previewUrl });
        createPreview(key, previewUrl);
      });

      input.value = "";
    },
    { signal },
  );

  return {
    cleanup() {
      newImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      newImages.clear();
    },
    newImages,
    listRetainedImagePublicIds: () =>
      [...gallery.querySelectorAll("[data-existing-image]")].map(
        (item) => item.dataset.imageKey,
      ),
  };
}

export { mountProductMedia };
