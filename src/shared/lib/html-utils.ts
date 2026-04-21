export interface SafeHtml {
  __isSafeHtml: true;
  html: string;
}

export function escapeHtml(text: unknown) {
  if (text === null || text === undefined) {
    return "";
  }

  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

export function unsafeHtml(htmlString: string): SafeHtml {
  return {
    __isSafeHtml: true,
    html: htmlString,
  };
}

export function html(strings: TemplateStringsArray, ...values: unknown[]) {
  return strings.reduce((result, string, index) => {
    const value = values[index];

    if (value === undefined || value === null) {
      return result + string;
    }

    if (
      typeof value === "object" &&
      value !== null &&
      "__isSafeHtml" in value &&
      (value as SafeHtml).__isSafeHtml
    ) {
      return result + string + (value as SafeHtml).html;
    }

    return result + string + escapeHtml(String(value));
  }, "");
}

export function renderList<T>(
  items: T[] | null | undefined,
  templateFn: (item: T, index: number) => string,
  separator = "",
) {
  if (!Array.isArray(items)) {
    return "";
  }

  return items.map(templateFn).join(separator);
}
