import { open as openModal } from "../../../shared/ui/modal.js";

function mountProductGallery(root) {
  const lightbox = createProductLightbox();

  const gallery = mountProductImageGallery(root, lightbox);
  mountProductReviewImages(root);

  return gallery;
}

function createProductLightbox() {
  const lightbox = document.querySelector("[data-product-lightbox]");
  const lightboxImage = lightbox.querySelector("[data-product-lightbox-image]");
  const lightboxThumbs = lightbox.querySelector(
    "[data-product-lightbox-thumbs]",
  );
  const lightboxTitle = lightbox.querySelector("[data-product-lightbox-title]");

  let images = [];
  let title = "";
  let activeIndex = 0;

  function syncLightbox() {
    const nextImage = images[activeIndex] || images[0];

    if (!nextImage) {
      return;
    }

    lightboxImage.src = nextImage;
    lightboxImage.alt = title || "Ảnh sản phẩm";

    lightboxThumbs
      .querySelectorAll("[data-product-lightbox-thumb]")
      .forEach((button, index) => {
        button.setAttribute("aria-pressed", String(index === activeIndex));
      });

    lightboxTitle.textContent =
      title || document.title.replace("Shopee Việt Nam | ", "");
  }

  function renderThumbs() {
    const thumbs = images.map((imageUrl, index) => {
      const button = document.createElement("button");
      const image = document.createElement("img");

      button.type = "button";
      button.className = "product-lightbox__thumb";
      button.setAttribute("aria-pressed", "false");
      button.dataset.productLightboxThumb = "";
      button.dataset.lightboxIndex = String(index);
      image.src = imageUrl;
      image.alt = `Ảnh sản phẩm ${index + 1}`;
      button.append(image);
      return button;
    });

    lightboxThumbs.replaceChildren(...thumbs);
  }

  function move(delta) {
    if (!images.length) {
      return;
    }

    activeIndex = (activeIndex + delta + images.length) % images.length;
    syncLightbox();
  }

  lightbox.addEventListener("click", (event) => {
    const navButton = event.target.closest("[data-product-lightbox-nav]");
    const thumbButton = event.target.closest("[data-product-lightbox-thumb]");

    if (navButton) {
      move(navButton.dataset.productLightboxNav === "prev" ? -1 : 1);
      return;
    }

    if (thumbButton) {
      activeIndex = Number(thumbButton.dataset.lightboxIndex);
      syncLightbox();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (lightbox.hidden) {
      return;
    }

    if (event.key === "ArrowLeft") {
      move(-1);
    }

    if (event.key === "ArrowRight") {
      move(1);
    }
  });

  return {
    open(nextImages = [], nextIndex = 0, nextTitle = "") {
      images = nextImages.filter(Boolean);
      title = nextTitle;
      activeIndex = nextIndex >= 0 ? nextIndex : 0;

      if (!images.length) {
        return;
      }

      renderThumbs();
      syncLightbox();
      openModal(lightbox);
    },
  };
}

function mountProductImageGallery(root, lightbox) {
  const detail = root.querySelector("[data-product-detail]");
  const mainImage = detail.querySelector("[data-product-main-image]");
  const galleryThumbs = detail.querySelector("[data-product-gallery-thumbs]");
  const galleryButtons = [...detail.querySelectorAll("[data-gallery-image]")];
  const images = galleryButtons
    .map((button) => button.dataset.galleryImage)
    .filter(Boolean);

  const defaultImage = mainImage.getAttribute("src") || mainImage.src;
  const defaultButton = galleryButtons.find(
    (button) => button.dataset.galleryImage === defaultImage,
  );
  let activeButton =
    galleryButtons.find(
      (button) => button.getAttribute("aria-pressed") === "true",
    ) ||
    galleryButtons[0] ||
    null;

  const productTitle = document.title.replace("Shopee Việt Nam | ", "");

  function setImageButton(button, { scroll = true } = {}) {
    const imageUrl = button?.dataset.galleryImage;

    if (!imageUrl) return;

    activeButton = button;
    mainImage.src = imageUrl;
    galleryButtons.forEach((galleryButton) => {
      galleryButton.setAttribute(
        "aria-pressed",
        String(galleryButton === button),
      );
    });
    if (scroll) button.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function setImage(imageUrl, { scroll = false } = {}) {
    if (!imageUrl) return;

    const button = galleryButtons.find(
      (galleryButton) => galleryButton.dataset.galleryImage === imageUrl,
    );

    if (button) {
      setImageButton(button, { scroll });
      return;
    }

    activeButton = null;
    mainImage.src = imageUrl;
    galleryButtons.forEach((galleryButton) => {
      galleryButton.setAttribute("aria-pressed", "false");
    });
  }

  galleryThumbs?.addEventListener("click", (event) => {
    const imageButton = event.target.closest("[data-gallery-image]");
    const navButton = event.target.closest("[data-gallery-nav]");

    if (imageButton) {
      setImageButton(imageButton);
      return;
    }

    if (!navButton) return;

    const activeIndex = Math.max(
      0,
      galleryButtons.findIndex(
        (button) => button.getAttribute("aria-pressed") === "true",
      ),
    );
    const nextIndex =
      (activeIndex +
        (navButton.dataset.galleryNav === "prev" ? -1 : 1) +
        galleryButtons.length) %
      galleryButtons.length;

    setImageButton(galleryButtons[nextIndex]);
  });

  mainImage.addEventListener("click", () => {
    if (!images.length) return;

    const currentIndex = Math.max(0, galleryButtons.indexOf(activeButton));

    lightbox.open(images, currentIndex >= 0 ? currentIndex : 0, productTitle);
  });

  return {
    reset() {
      if (defaultButton) setImageButton(defaultButton, { scroll: false });
      else if (galleryButtons[0])
        setImageButton(galleryButtons[0], { scroll: false });
      else setImage(defaultImage, { scroll: false });
    },
    setImage,
  };
}

function mountProductReviewImages(root) {
  const reviews = root.querySelector("[data-product-reviews]");

  reviews.addEventListener("click", (event) => {
    const reviewImageButton = event.target.closest("[data-review-image]");
    const navButton = event.target.closest("[data-review-viewer-nav]");

    if (navButton) {
      event.preventDefault();

      const reviewArticle = navButton.closest("[data-product-review]");
      const viewer = reviewArticle.querySelector("[data-review-viewer]");
      const viewerImage = reviewArticle.querySelector(
        "[data-review-viewer-image]",
      );
      const imageButtons = [
        ...reviewArticle.querySelectorAll("[data-review-image]"),
      ];

      let activeIndex = imageButtons.findIndex(
        (button) => button.getAttribute("aria-pressed") === "true",
      );

      if (activeIndex < 0) {
        activeIndex = 0;
      }

      const delta = navButton.dataset.reviewViewerNav === "prev" ? -1 : 1;
      const nextIndex =
        (activeIndex + delta + imageButtons.length) % imageButtons.length;
      const nextButton = imageButtons[nextIndex];

      imageButtons.forEach((button, index) => {
        button.setAttribute("aria-pressed", String(index === nextIndex));
      });

      viewer.hidden = false;
      viewerImage.src = nextButton.querySelector("img").getAttribute("src");
      return;
    }

    if (!reviewImageButton) {
      return;
    }

    event.preventDefault();
    const reviewArticle = reviewImageButton.closest("[data-product-review]");
    const viewer = reviewArticle.querySelector("[data-review-viewer]");
    const viewerImage = reviewArticle.querySelector(
      "[data-review-viewer-image]",
    );
    const imageButtons = [
      ...reviewArticle.querySelectorAll("[data-review-image]"),
    ];
    const clickedIndex = Number(reviewImageButton.dataset.reviewImageIndex);
    const isActive = reviewImageButton.getAttribute("aria-pressed") === "true";

    if (!viewer.hidden && isActive) {
      imageButtons.forEach((button) => {
        button.setAttribute("aria-pressed", "false");
      });
      viewer.hidden = true;
      return;
    }

    imageButtons.forEach((button, index) => {
      button.setAttribute("aria-pressed", String(index === clickedIndex));
    });

    viewer.hidden = false;
    viewerImage.src = reviewImageButton
      .querySelector("img")
      .getAttribute("src");
  });
}

export { mountProductGallery };
