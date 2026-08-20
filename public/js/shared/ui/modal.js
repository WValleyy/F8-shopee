const MODAL_STATE_SCOPE = "modal";
const NO_FOCUS_RESTORE_REASONS = new Set([
  "navigation",
  "region-replace",
  "replace-active",
]);
const workflows = new Map();
let activeModal = null;
let activeWorkflow = null;
let returnFocus = null;
let navigationExitPromise = null;

function resolveModal(target) {
  if (typeof target === "string") return document.querySelector(target);

  return target instanceof HTMLElement ? target : null;
}

function getFocusableElements(modal) {
  return [
    ...modal.querySelectorAll(
      [
        "a[href]",
        "button:not([disabled])",
        'input:not([disabled]):not([type="hidden"])',
        "select:not([disabled])",
        "textarea:not([disabled])",
        '[tabindex]:not([tabindex="-1"])',
      ].join(","),
    ),
  ].filter((element) => !element.closest("[hidden]"));
}

function focusModal(modal) {
  const visibleFormControl = [
    ...modal.querySelectorAll(
      'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled])',
    ),
  ].find((element) => !element.closest("[hidden]"));
  const focusTarget =
    modal.querySelector("[autofocus]") ||
    visibleFormControl ||
    getFocusableElements(modal)[0] ||
    modal.querySelector("[data-modal-content]");

  if (
    focusTarget &&
    !focusTarget.hasAttribute("tabindex") &&
    focusTarget.matches("[data-modal-content]")
  ) {
    focusTarget.setAttribute("tabindex", "-1");
  }

  focusTarget?.focus();
}

function openElement(
  modal,
  {
    opener = document.activeElement,
    reason = "replace-active",
    preserveWorkflow = false,
  } = {},
) {
  if (!modal) return null;

  if (activeModal && activeModal !== modal) {
    closeElement(activeModal, {
      reason,
      restoreFocus: false,
      preserveWorkflow,
    });
  }

  activeModal = modal;
  returnFocus =
    opener instanceof HTMLElement && document.contains(opener)
      ? opener
      : returnFocus;
  modal.hidden = false;
  document.body.dataset.modalOpen = "true";
  focusModal(modal);
  return modal;
}

function callWorkflowClose(reason) {
  if (!activeWorkflow) return;

  const workflow = workflows.get(activeWorkflow.id);
  workflow?.onClose?.({
    reason,
    state: { ...activeWorkflow.state },
  });
}

function closeElement(
  modal,
  {
    reason = "dismiss",
    restoreFocus = !NO_FOCUS_RESTORE_REASONS.has(reason),
    preserveWorkflow = false,
  } = {},
) {
  if (!modal) return;

  modal.hidden = true;

  if (activeModal !== modal) return;

  const focusTarget = returnFocus;

  if (!preserveWorkflow) callWorkflowClose(reason);

  activeModal = null;
  delete document.body.dataset.modalOpen;

  if (!preserveWorkflow) activeWorkflow = null;

  returnFocus = null;
  modal.dispatchEvent(new Event("modal:closed", { bubbles: true }));

  if (restoreFocus && focusTarget && document.contains(focusTarget))
    focusTarget.focus();
}

function resolveWorkflowModal(workflow, step) {
  const target = workflow.steps?.[step];

  if (typeof target === "function") return resolveModal(target());

  return resolveModal(target);
}

function applyModalState(state, options = {}) {
  const workflow = workflows.get(state.workflowId);

  if (!workflow || !workflow.steps?.[state.step]) return null;

  const modal = resolveWorkflowModal(workflow, state.step);

  if (!modal) return null;

  const sameWorkflow = activeWorkflow?.id === state.workflowId;
  const previousStep = sameWorkflow ? activeWorkflow.state.step : "";
  const opener =
    options.opener || (sameWorkflow ? returnFocus : document.activeElement);

  activeWorkflow = {
    id: state.workflowId,
    state: { ...state },
  };
  openElement(modal, {
    opener,
    reason: "replace-active",
    preserveWorkflow: true,
  });
  workflow.onApply?.({
    step: state.step,
    previousStep,
  });
  focusModal(modal);
  return modal;
}

function register(workflowId, config) {
  if (!workflowId || !config?.steps)
    throw new TypeError("Modal workflow requires an id and steps.");

  workflows.set(workflowId, config);

  if (
    history.state?.scope === MODAL_STATE_SCOPE &&
    history.state.workflowId === workflowId
  ) {
    window.queueMicrotask(() => applyModalState(history.state));
  }

  return () => {
    if (activeWorkflow?.id === workflowId)
      close(activeModal, { reason: "navigation" });

    workflows.delete(workflowId);
  };
}

function open(target, options = {}) {
  const {
    opener,
    history: useHistory = false,
    workflowId = "",
    step = "",
  } = options;

  if (!useHistory) return openElement(resolveModal(target), { opener });

  const normalizedWorkflowId = String(workflowId).trim();
  const workflow = workflows.get(normalizedWorkflowId);
  const normalizedStep = String(step || workflow?.initialStep || "").trim();

  if (!workflow || !workflow.steps?.[normalizedStep])
    throw new Error("History modal workflow is not registered.");

  if (!resolveWorkflowModal(workflow, normalizedStep)) return null;

  document.dispatchEvent(new Event("partial-navigation:cancel"));

  const state = {
    scope: MODAL_STATE_SCOPE,
    workflowId: normalizedWorkflowId,
    step: normalizedStep,
    stepIndex: 0,
  };

  history.pushState(state, "", window.location.href);
  return applyModalState(state, { opener });
}

function goToStep(step, { replace = false } = {}) {
  if (!activeWorkflow) throw new Error("No modal workflow is active.");

  const workflow = workflows.get(activeWorkflow.id);

  if (!workflow?.steps?.[step])
    throw new Error(`Unknown modal workflow step: ${step}`);

  const state = {
    ...activeWorkflow.state,
    scope: MODAL_STATE_SCOPE,
    step,
    stepIndex: replace
      ? activeWorkflow.state.stepIndex
      : activeWorkflow.state.stepIndex + 1,
  };

  if (replace) history.replaceState(state, "", window.location.href);
  else history.pushState(state, "", window.location.href);

  return applyModalState(state);
}

function close(target = activeModal, options = {}) {
  const modal = resolveModal(target);
  const reason = options.reason || "dismiss";

  if (!modal) return;

  if (
    activeWorkflow &&
    activeModal === modal &&
    history.state?.scope === MODAL_STATE_SCOPE &&
    reason !== "history" &&
    reason !== "replace-active"
  ) {
    const distance = Math.max(
      1,
      Number(activeWorkflow.state.stepIndex || 0) + 1,
    );

    closeElement(modal, { ...options, reason });
    history.go(-distance);
    return;
  }

  closeElement(modal, { ...options, reason });
}

function exitForNavigation(reason = "navigation") {
  if (navigationExitPromise) return navigationExitPromise;

  if (!activeModal) return Promise.resolve();

  if (!activeWorkflow || history.state?.scope !== MODAL_STATE_SCOPE) {
    closeElement(activeModal, { reason });
    return Promise.resolve();
  }

  const modal = activeModal;
  const distance = Math.max(1, Number(activeWorkflow.state.stepIndex || 0) + 1);

  navigationExitPromise = new Promise((resolve) => {
    const handlePopState = (event) => {
      if (event.state?.scope === MODAL_STATE_SCOPE) return;

      window.removeEventListener("popstate", handlePopState);
      navigationExitPromise = null;
      resolve();
    };

    window.addEventListener("popstate", handlePopState);
    closeElement(modal, { reason });
    history.go(-distance);
  });

  return navigationExitPromise;
}

function back() {
  if (activeWorkflow) history.back();
}

function getActiveWorkflow() {
  return activeWorkflow
    ? {
        id: activeWorkflow.id,
        state: { ...activeWorkflow.state },
      }
    : null;
}

function closeWithin(container) {
  if (activeModal && container.contains(activeModal))
    closeElement(activeModal, { reason: "region-replace" });
}

function requestClose(target = activeModal) {
  const modal = resolveModal(target);

  if (modal) close(modal, { reason: "dismiss" });
}

document.addEventListener("click", (event) => {
  const backButton = event.target.closest("[data-modal-back]");

  if (backButton && backButton.closest("[data-modal]")) {
    event.preventDefault();
    back();
    return;
  }

  const closeTarget = event.target.closest("[data-modal-close]");
  const modal = closeTarget?.closest("[data-modal]");

  if (!modal) return;

  event.preventDefault();
  requestClose(modal);
});

document.addEventListener("keydown", (event) => {
  if (!activeModal) return;

  if (event.key === "Escape") {
    event.preventDefault();
    requestClose(activeModal);
    return;
  }

  if (event.key !== "Tab") return;

  const focusable = getFocusableElements(activeModal);

  if (!focusable.length) {
    event.preventDefault();
    focusModal(activeModal);
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

window.addEventListener("popstate", (event) => {
  if (event.state?.scope === MODAL_STATE_SCOPE) {
    applyModalState(event.state);
    return;
  }

  if (activeWorkflow) closeElement(activeModal, { reason: "history" });
});

function isModalState(state) {
  return state?.scope === MODAL_STATE_SCOPE;
}

export {
  close,
  closeWithin,
  exitForNavigation,
  getActiveWorkflow,
  goToStep,
  isModalState,
  open,
  register,
};
