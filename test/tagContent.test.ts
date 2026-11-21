import { describe, expect, it, vi } from "vitest";

vi.mock("../src/components/styles/tagIndex.scss", () => ({ default: "" }));
vi.mock("../src/components/styles/listPage.scss", () => ({ default: "" }));

import TagContentConstructor from "../src/components/TagContent";

type VNode = { type: unknown; props: { class?: string; href?: string; children?: unknown } };

function isVNode(node: unknown): node is VNode {
  return typeof node === "object" && node !== null && "type" in node && "props" in node;
}

/** Every vnode in a rendered tree matching `predicate`, in document order. */
function findAll(node: unknown, predicate: (v: VNode) => boolean, out: VNode[] = []): VNode[] {
  if (Array.isArray(node)) {
    node.forEach((child) => findAll(child, predicate, out));
    return out;
  }
  if (!isVNode(node)) return out;
  if (predicate(node)) out.push(node);
  findAll(node.props.children, predicate, out);
  return out;
}

function classes(v: VNode): string[] {
  return (v.props.class ?? "").split(/\s+/).filter(Boolean);
}

function textOf(node: unknown): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isVNode(node)) return textOf(node.props.children);
  return "";
}

/** Every tag chip (`<a class="internal tag-link">`) in a rendered tree, as `{ href, text }`. */
function tagChips(node: unknown): { href: string | undefined; text: string }[] {
  return findAll(node, (v) => v.type === "a" && classes(v).includes("tag-link")).map((v) => ({
    href: v.props.href,
    text: textOf(v.props.children),
  }));
}

function page(slug: string, tags: string[] = [], filePath?: string) {
  return { slug, filePath, frontmatter: { title: slug, tags }, dates: {} };
}

function renderTagIndex(allFiles: ReturnType<typeof page>[]) {
  const TagContent = TagContentConstructor();
  const tagIndex = { slug: "tags/index", frontmatter: { title: "Tags" } };
  return TagContent({
    tree: { type: "root", children: [] },
    fileData: tagIndex,
    allFiles,
    cfg: { locale: "en-US" },
    displayClass: undefined,
  } as never);
}

describe("tag index", () => {
  it("renders a compact chip list instead of headings and per-tag listings", () => {
    const rendered = renderTagIndex([page("notes/a", ["plugin/component"])]);

    expect(
      findAll(rendered, (v) => v.type === "ul" && classes(v).includes("tag-index")),
    ).toHaveLength(1);
    expect(findAll(rendered, (v) => v.type === "h2")).toHaveLength(0);
    expect(findAll(rendered, (v) => classes(v).includes("page-listing"))).toHaveLength(0);
    expect(findAll(rendered, (v) => classes(v).includes("section-ul"))).toHaveLength(0);
    expect(textOf(rendered)).not.toContain("items with this tag");
  });

  it("links a parent tag to its virtual tags/<tag>/index page", () => {
    const rendered = renderTagIndex([page("notes/a", ["plugin/component"])]);

    expect(tagChips(rendered).map((chip) => chip.href)).toEqual([
      "../tags/plugin/",
      "../tags/plugin/component",
    ]);
    expect(textOf(rendered)).toContain("Found 2 total tags.");
  });

  it("links a parent tag to a hand-written tags/<tag> page where it is", () => {
    const chips = tagChips(
      renderTagIndex([
        page("notes/a", ["plugin/component"]),
        page("tags/plugin", [], "content/tags/plugin.md"),
      ]),
    );

    expect(chips.map((chip) => chip.href)).toEqual(["../tags/plugin", "../tags/plugin/component"]);
  });

  it("shows the number of matching articles inside each chip", () => {
    const rendered = renderTagIndex([
      page("notes/a", ["alpha"]),
      page("notes/b", ["alpha"]),
      page("notes/c", ["beta"]),
    ]);

    expect(tagChips(rendered).map((chip) => chip.href)).toEqual(["../tags/alpha", "../tags/beta"]);
    expect(tagChips(rendered).map((chip) => chip.text)).toEqual(["alpha2", "beta1"]);

    expect(
      findAll(rendered, (v) => v.type === "span" && classes(v).includes("tag-count")),
    ).toHaveLength(2);
  });

  it("sorts chips by article count descending, then by name ascending", () => {
    const rendered = renderTagIndex([
      page("notes/a", ["alpha", "beta", "aardvark"]),
      page("notes/b", ["alpha", "beta", "aardvark"]),
      page("notes/c", ["alpha"]),
      page("notes/d", ["zeta"]),
    ]);

    expect(tagChips(rendered).map((chip) => chip.text)).toEqual([
      "alpha3",
      "aardvark2",
      "beta2",
      "zeta1",
    ]);
  });
});
