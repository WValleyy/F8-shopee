import { open } from "./modal.js";

function mountImageLightbox(root, signal) {
  const modal = root.querySelector("[data-image-lightbox]");
  const lightboxImage = modal.querySelector("[data-image-lightbox-image]");

  root.addEventListener(
    "click",
    (event) => {
      const trigger = event.target.closest("[data-image-lightbox-src]");

      if (!trigger) return;

      const previewImage = trigger.querySelector("img");

      lightboxImage.src = trigger.dataset.imageLightboxSrc;
      lightboxImage.alt =
        trigger.dataset.imageLightboxAlt || previewImage?.alt || "";
      open(modal);
    },
    { signal },
  );
}

export { mountImageLightbox };
