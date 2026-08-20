import { requestJson } from "../../../../shared/api/http-client.js";
import {
  buildPhoneValidationMessage,
  clearFormErrors,
  isValidPhoneInput,
  normalizePhone,
  setFieldError,
  showFormNotice,
  syncPhoneInput,
  validateRequired,
} from "../../../../shared/ui/forms.js";
import { showToast } from "../../../../shared/ui/toast.js";

const AVATAR_MAX_SIZE = 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function mountProfileForm({ root, signal }) {
  let avatarPreview = null;
  let profilePending = false;
  const profileControlStates = new Map();

  function setProfilePending(form, pending) {
    const controls = [
      ...form.querySelectorAll("input, select, button"),
      ...root.querySelectorAll("#avatar-input, [data-profile-avatar-button]"),
    ];

    if (pending) {
      controls.forEach((control) => {
        profileControlStates.set(control, control.disabled);
        control.disabled = true;
      });
      return;
    }

    controls.forEach((control) => {
      if (!profileControlStates.has(control)) return;

      control.disabled = profileControlStates.get(control);
      profileControlStates.delete(control);
    });
  }

  function setShellUserName(userName) {
    document.querySelectorAll("[data-user-shell-name]").forEach((element) => {
      element.textContent = userName;
    });
  }

  function setShellAvatar(avatar) {
    document.querySelectorAll("[data-user-shell-avatar]").forEach((element) => {
      if (element instanceof HTMLImageElement) {
        element.src = avatar;
        return;
      }

      const image = document.createElement("img");
      image.src = avatar;
      image.alt = "Avatar";
      image.className = "header__navbar-user-avt";
      image.dataset.userShellAvatar = "";
      element.replaceWith(image);
    });

    document
      .querySelectorAll("[data-user-shell-avatar-container]")
      .forEach((container) => {
        const image = document.createElement("img");

        image.src = avatar;
        image.alt = "Avatar";
        image.className = "user-sidebar__avatar";
        container.replaceChildren(image);
      });
  }

  function commitAvatarPreview(avatar) {
    if (!avatarPreview) return;

    URL.revokeObjectURL(avatarPreview.url);

    const image = document.createElement("img");

    image.src = avatar;
    image.alt = "Avatar";
    avatarPreview.wrapper.replaceChildren(image);
    root.querySelector("#avatar-input").value = "";
    avatarPreview = null;
  }

  function rollbackAvatarPreview() {
    if (!avatarPreview) return;

    URL.revokeObjectURL(avatarPreview.url);
    avatarPreview.wrapper.innerHTML = avatarPreview.originalHtml;
    avatarPreview = null;
  }

  function previewAvatar(input) {
    const file = input.files?.[0];

    if (!file) return;

    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      showToast("Vui lòng chọn tệp hình ảnh.", "error");
      rollbackAvatarPreview();
      input.value = "";
      return;
    }

    if (file.size > AVATAR_MAX_SIZE) {
      showToast("Dung lượng ảnh tối đa là 1 MB.", "error");
      rollbackAvatarPreview();
      input.value = "";
      return;
    }

    const wrapper = root.querySelector("[data-profile-avatar-image]");
    const url = URL.createObjectURL(file);

    if (avatarPreview) URL.revokeObjectURL(avatarPreview.url);

    avatarPreview = {
      wrapper,
      originalHtml: avatarPreview?.originalHtml || wrapper.innerHTML,
      url,
    };

    const image = document.createElement("img");

    image.src = url;
    image.alt = "Avatar preview";
    wrapper.replaceChildren(image);
  }

  function startFieldEditing(button) {
    const field = button.closest("[data-profile-edit-field]");
    const value = field.querySelector("[data-profile-field-value]");
    const input = field.querySelector("[data-profile-field-input]");

    value.hidden = true;
    input.hidden = false;
    button.hidden = true;
    input.focus();
    input.select();
  }

  function finishFieldEditing(input, value, emptyText = "") {
    const field = input.closest("[data-profile-edit-field]");
    const text = field.querySelector("[data-profile-field-value]");
    const button = field.querySelector("[data-edit-profile-field]");

    input.value = value;
    input.hidden = true;
    text.textContent = value || emptyText;
    text.hidden = false;
    button.hidden = false;
  }

  async function submitProfile(form) {
    if (profilePending) return;

    clearFormErrors(form);

    const userNameInput = form.elements.userName;
    const nameInput = form.elements.name;
    const phoneInput = form.elements.phone;
    const birthday = form.elements.birthday.value;

    if (!validateRequired(userNameInput, "Vui lòng nhập tên đăng nhập."))
      return;

    const userName = userNameInput.value.trim();

    if (!/^\S{3,30}$/.test(userName)) {
      setFieldError(
        userNameInput,
        "Tên đăng nhập phải có từ 3 đến 30 ký tự và không chứa khoảng trắng.",
      );
      return;
    }

    if (!validateRequired(nameInput, "Vui lòng nhập tên.")) return;

    const phone = normalizePhone(phoneInput.value);
    const isPhoneEditing = !phoneInput.hidden;

    phoneInput.value = phone;

    if (
      isPhoneEditing &&
      !validateRequired(phoneInput, "Vui lòng nhập số điện thoại.")
    ) {
      return;
    }

    if (isPhoneEditing && !isValidPhoneInput(phoneInput)) {
      setFieldError(phoneInput, buildPhoneValidationMessage(phoneInput));
      return;
    }

    const avatarFile = root.querySelector("#avatar-input").files[0];
    const submitted = {
      userName,
      name: nameInput.value.trim(),
      phone,
      gender: form.elements.gender.value,
      birthday,
      avatarFile,
    };

    profilePending = true;
    setProfilePending(form, true);

    try {
      const formData = new FormData();

      formData.set("userName", submitted.userName);
      formData.set("name", submitted.name);
      if (isPhoneEditing) formData.set("phone", submitted.phone);
      formData.set("gender", submitted.gender);
      formData.set("birthday", submitted.birthday);
      if (submitted.avatarFile)
        formData.set("avatar", submitted.avatarFile, submitted.avatarFile.name);

      const data = await requestJson("/api/account/profile", {
        method: "PATCH",
        body: formData,
        signal,
      });

      setShellUserName(submitted.userName);
      finishFieldEditing(userNameInput, submitted.userName);
      finishFieldEditing(nameInput, submitted.name);
      finishFieldEditing(phoneInput, phone, "Chưa cập nhật");

      if (submitted.avatarFile && data.avatar) {
        setShellAvatar(data.avatar);
        commitAvatarPreview(data.avatar);
      }

      showFormNotice(form, "Thông tin hồ sơ đã được cập nhật.");
    } catch (error) {
      showFormNotice(form, error.message);
    } finally {
      profilePending = false;
      setProfilePending(form, false);
    }
  }

  root.addEventListener(
    "click",
    (event) => {
      const editButton = event.target.closest("[data-edit-profile-field]");

      if (editButton) {
        startFieldEditing(editButton);
        return;
      }

      if (event.target.closest("[data-profile-avatar-button]"))
        root.querySelector("#avatar-input").click();
    },
    { signal },
  );

  root.addEventListener(
    "input",
    (event) => {
      const input = event.target.closest("[data-phone-max-digits]");

      if (input) syncPhoneInput(input);
    },
    { signal },
  );

  root.addEventListener(
    "change",
    (event) => {
      if (event.target.matches("#avatar-input")) {
        previewAvatar(event.target);
      }
    },
    { signal },
  );

  root.addEventListener(
    "submit",
    (event) => {
      if (!event.target.matches("#profile-form")) return;

      event.preventDefault();
      void submitProfile(event.target);
    },
    { signal },
  );

  return rollbackAvatarPreview;
}

export { mountProfileForm };
