export interface PrefixElementIdsOptions {
  /** Instance-specific prefix (e.g. `t16-` or `odontogram-abc123-`). Must be non-empty. */
  prefix: string;
  /** When true, also prefix `class` tokens that match id-like layer names (default false). */
  prefixClasses?: boolean;
}

const ID_ATTR = "id";
const HREF_ATTRS = ["href", "xlink:href"] as const;

/**
 * Prefix every element `id` and internal `url(#id)` references so multiple tooth
 * instances can be composed in one SVG document without id collisions.
 */
export function prefixElementIds(svgMarkup: string, options: PrefixElementIdsOptions): string {
  const prefix = options.prefix.trim();
  if (!prefix) {
    throw new Error("prefixElementIds: prefix must be a non-empty string");
  }
  if (typeof DOMParser === "undefined") {
    throw new Error("prefixElementIds requires DOMParser (browser or jsdom)");
  }

  const doc = new DOMParser().parseFromString(svgMarkup, "image/svg+xml");
  const root = doc.documentElement;
  if (root.localName !== "svg") {
    throw new Error("prefixElementIds: document root must be an svg element");
  }

  const idMap = new Map<string, string>();
  const elementsWithId = root.querySelectorAll("[id]");
  for (const el of elementsWithId) {
    const oldId = el.getAttribute(ID_ATTR);
    if (!oldId || oldId.startsWith(prefix)) continue;
    const newId = `${prefix}${oldId}`;
    idMap.set(oldId, newId);
    el.setAttribute(ID_ATTR, newId);
  }

  rewriteUrlReferences(root, idMap);

  if (options.prefixClasses) {
    for (const el of root.querySelectorAll("[class]")) {
      const cls = el.getAttribute("class");
      if (!cls) continue;
      el.setAttribute(
        "class",
        cls
          .split(/\s+/)
          .map((token) => (idMap.has(token) ? `${prefix}${token}` : token))
          .join(" "),
      );
    }
  }

  return new XMLSerializer().serializeToString(root);
}

function rewriteUrlReferences(root: Element, idMap: Map<string, string>): void {
  const urlPattern = /url\(#([^)]+)\)/g;

  for (const el of root.querySelectorAll("*")) {
    for (const attr of el.attributes) {
      if (HREF_ATTRS.includes(attr.name as (typeof HREF_ATTRS)[number])) {
        const href = attr.value;
        if (href.startsWith("#")) {
          const ref = href.slice(1);
          const mapped = idMap.get(ref);
          if (mapped) {
            el.setAttribute(attr.name, `#${mapped}`);
          }
        }
      } else if (urlPattern.test(attr.value)) {
        urlPattern.lastIndex = 0;
        const next = attr.value.replace(urlPattern, (_match, ref: string) => {
          const mapped = idMap.get(ref);
          return mapped ? `url(#${mapped})` : `url(#${ref})`;
        });
        el.setAttribute(attr.name, next);
      }
    }
  }

  // style attributes on root
  if (root.hasAttribute("style")) {
    const style = root.getAttribute("style") ?? "";
    root.setAttribute(
      "style",
      style.replace(urlPattern, (_match, ref: string) => {
        const mapped = idMap.get(ref);
        return mapped ? `url(#${mapped})` : `url(#${ref})`;
      }),
    );
  }
}

/** Serialize a live SVG element to markup (for tests). */
export function serializeSvgElement(element: SVGSVGElement): string {
  return new XMLSerializer().serializeToString(element);
}

/** Parse SVG markup to an element (throws on parser error). */
export function parseSvgMarkup(markup: string): SVGSVGElement {
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  const root = doc.documentElement;
  if (root.localName !== "svg") {
    throw new Error("parseSvgMarkup: expected svg root");
  }
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    throw new Error(`Invalid SVG: ${parserError.textContent ?? "parser error"}`);
  }
  return root as unknown as SVGSVGElement;
}
