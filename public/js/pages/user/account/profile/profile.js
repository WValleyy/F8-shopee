import { mountChangeEmail } from "./change-email.js";
import { createEmailWorkflowTools } from "./email-workflow.js";
import { mountProfileForm } from "./profile-form.js";
import { mountVerifyEmail } from "./verify-email.js";

function mount({ root, signal }) {
  const tools = createEmailWorkflowTools(root);
  const cleanupProfileForm = mountProfileForm({ root, signal });
  const cleanupChangeEmail = mountChangeEmail({ root, signal, tools });
  const cleanupVerifyEmail = mountVerifyEmail({ root, signal, tools });

  return () => {
    cleanupChangeEmail();
    cleanupVerifyEmail();
    tools.resetCountdown();
    cleanupProfileForm();
  };
}

export { mount };
