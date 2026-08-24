const imageStateByRow = new WeakMap();
const registeredRows = new Set();

function registerRow(row) {
  if (registeredRows.has(row)) return;

  registeredRows.add(row);

  imageStateByRow.set(row, {
    file: null,
    previewUrl: "",
  });
}

function unregisterRow(row) {
  const state = imageStateByRow.get(row);

  if (state.previewUrl) {
    URL.revokeObjectURL(state.previewUrl);
  }

  imageStateByRow.delete(row);
  registeredRows.delete(row);
}

function renderRowPreview(row, url) {
  const previewImg = row.querySelector("[data-variant-image-preview]");
  const labelSpan = row.querySelector("[data-variant-image-label]");

  if (url) {
    previewImg.src = url;
    previewImg.hidden = false;
    labelSpan.textContent = "Thay ảnh";
  } else {
    previewImg.src = "";
    previewImg.hidden = true;
    labelSpan.textContent = "Chọn ảnh";
  }
}

function setRowImage(row, file) {
  registerRow(row);
  const current = imageStateByRow.get(row);

  if (current.previewUrl) {
    URL.revokeObjectURL(current.previewUrl);
  }

  const previewUrl = URL.createObjectURL(file);

  imageStateByRow.set(row, {
    file,
    previewUrl,
  });

  renderRowPreview(row, previewUrl);
}

function getState(row) {
  registerRow(row);
  return imageStateByRow.get(row);
}

function cleanup() {
  for (const row of registeredRows) {
    const state = imageStateByRow.get(row);

    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
    }

    imageStateByRow.delete(row);
  }

  registeredRows.clear();
}

export { cleanup, getState, registerRow, setRowImage, unregisterRow };
