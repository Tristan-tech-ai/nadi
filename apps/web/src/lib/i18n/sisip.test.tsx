import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { sisip } from "./sisip";

describe("sisip", () => {
  it("menaruh simpul di tempat {kunci} dan membiarkan kunci tak dikenal", () => {
    expect(renderToStaticMarkup(<p>{sisip("Masih ada {n} usulan {x}.", { n: <b>12</b> })}</p>)).toBe("<p>Masih ada <b>12</b> usulan {x}.</p>");
    expect(renderToStaticMarkup(<p>{sisip("{n} more suggestions.", { n: <b>3</b> })}</p>)).toBe("<p><b>3</b> more suggestions.</p>");
  });
});
