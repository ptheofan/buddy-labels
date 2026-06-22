const copyButtons = document.querySelectorAll('[data-copy-target]');

function copyTextFallback(text) {
  const source = document.createElement('textarea');
  source.value = text;
  source.setAttribute('readonly', '');
  source.style.position = 'fixed';
  source.style.top = '-1000px';
  source.style.left = '-1000px';
  document.body.appendChild(source);
  source.select();
  const copied = document.execCommand('copy');
  source.remove();
  if (!copied) throw new Error('Copy command failed');
}

function textFromTarget(target) {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return target.value;
  return target?.textContent || '';
}

function statusForButton(button) {
  const statusId = button.getAttribute('data-copy-status');
  if (statusId) return document.getElementById(statusId);
  return document.querySelector('#copy-status');
}

copyButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    const targetId = button.getAttribute('data-copy-target');
    const target = targetId ? document.getElementById(targetId) : null;
    const text = textFromTarget(target).trim();
    if (!text) return;
    const status = statusForButton(button);
    const success = button.getAttribute('data-copy-success') || 'Copied.';
    const error = button.getAttribute('data-copy-error') || 'Clipboard blocked by browser.';

    try {
      await navigator.clipboard.writeText(text);
      if (status) status.textContent = success;
    } catch {
      try {
        copyTextFallback(text);
        if (status) status.textContent = success;
      } catch {
        if (status) status.textContent = error;
      }
    }
  });
});
