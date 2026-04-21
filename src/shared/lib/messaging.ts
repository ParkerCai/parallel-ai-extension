const DEFAULT_MESSAGE_TIMEOUT_MS = 2000;

interface SendMessageOptions {
  expectResponse?: boolean;
  timeout?: number;
}

export function sendMessageWithTimeout<Response = unknown>(
  message: unknown,
  options: SendMessageOptions = {},
) {
  const { timeout = DEFAULT_MESSAGE_TIMEOUT_MS, expectResponse = true } = options;

  return new Promise<Response | undefined>((resolve, reject) => {
    let completed = false;

    const timer = expectResponse
      ? window.setTimeout(() => {
          if (!completed) {
            completed = true;
            reject(
              new Error(
                `Message timeout${
                  typeof message === "object" &&
                  message !== null &&
                  "action" in message &&
                  typeof (message as { action?: unknown }).action === "string"
                    ? `: ${(message as { action: string }).action}`
                    : ""
                }`,
              ),
            );
          }
        }, timeout)
      : null;

    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (!expectResponse) {
          resolve(undefined);
          return;
        }

        if (completed) {
          return;
        }

        completed = true;
        if (timer) {
          window.clearTimeout(timer);
        }

        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }

        resolve(response as Response);
      });

      if (!expectResponse) {
        completed = true;
        if (timer) {
          window.clearTimeout(timer);
        }
        resolve(undefined);
      }
    } catch (error) {
      if (!completed) {
        if (timer) {
          window.clearTimeout(timer);
        }
        reject(error);
      }
    }
  });
}

export function notifyMessage(message: unknown) {
  return sendMessageWithTimeout(message, { expectResponse: false });
}
