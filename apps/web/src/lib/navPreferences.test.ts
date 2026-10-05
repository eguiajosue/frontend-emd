import { describe, expect, it } from "vitest";
import {
  DEFAULT_NAV_PREFERENCES,
  applyNavPreferences,
  isFavorite,
  isHidden,
  normalizeNavPreferences,
  orderGroupItems,
  pickPrimaryTabUrls,
  reorderFavorites,
  reorderGroup,
  resolveFavorites,
  setExpanded,
  setHidden,
  toggleFavorite,
  type NavGroupOf,
  type NavPreferences,
} from "./navPreferences";
import { MAX_PRIMARY_TABS, TAB_PRIORITY_URLS, buildMenuItems, isNavItemVisible } from "./navMenu";

type Item = { url: string; title: string };
const it_ = (url: string): Item => ({ url, title: url.toUpperCase() });

const GROUPS: NavGroupOf<Item>[] = [
  { groupLabel: "Operación", items: [it_("/a"), it_("/b"), it_("/c")] },
  { groupLabel: "Equipo", items: [it_("/d"), it_("/e")] },
  { groupLabel: "Admin", items: [it_("/f")] },
];

const prefs = (p: Partial<NavPreferences> = {}): NavPreferences => ({
  ...DEFAULT_NAV_PREFERENCES,
  order: {},
  ...p,
});

const urls = (items: { url: string }[]) => items.map((i) => i.url);
const shape = (r: ReturnType<typeof applyNavPreferences<Item>>) => ({
  favorites: urls(r.favorites),
  groups: r.groups.map((g) => [g.groupLabel, urls(g.items)]),
});

describe("normalizeNavPreferences", () => {
  it.each([null, undefined, 42, "x", [], true])("valor inválido %s → por defecto", (raw) => {
    expect(normalizeNavPreferences(raw)).toEqual(DEFAULT_NAV_PREFERENCES);
  });

  it("conserva lo válido y descarta lo demás", () => {
    expect(
      normalizeNavPreferences({
        favorites: ["/a", "/a", 3, "", "/b"],
        order: { Operación: ["/c", "/a", 9], Vacío: [], Mal: "no", Lista: null },
        hidden: "nope",
        expanded: "true",
      })
    ).toEqual({
      favorites: ["/a", "/b"],
      order: { Operación: ["/c", "/a"] },
      hidden: [],
      expanded: false,
    });
  });

  it("order como arreglo se ignora; expanded true se respeta", () => {
    expect(normalizeNavPreferences({ order: ["/a"], expanded: true })).toEqual({
      ...DEFAULT_NAV_PREFERENCES,
      expanded: true,
    });
  });

  it("limita la cantidad de ids", () => {
    const many = Array.from({ length: 300 }, (_, i) => `/x${i}`);
    expect(normalizeNavPreferences({ favorites: many }).favorites).toHaveLength(100);
  });

  it("no comparte el objeto `order` del valor por defecto", () => {
    const a = normalizeNavPreferences(null);
    a.order.X = ["/a"];
    expect(DEFAULT_NAV_PREFERENCES.order).toEqual({});
  });
});

describe("orderGroupItems", () => {
  it("sin orden guardado → orden por defecto", () => {
    expect(urls(orderGroupItems(GROUPS[0], prefs()))).toEqual(["/a", "/b", "/c"]);
  });

  it("aplica el orden guardado y agrega al final los nuevos/no listados", () => {
    expect(urls(orderGroupItems(GROUPS[0], prefs({ order: { Operación: ["/c", "/a"] } })))).toEqual([
      "/c",
      "/a",
      "/b",
    ]);
  });

  it("ignora urls desconocidas y repetidas", () => {
    expect(
      urls(orderGroupItems(GROUPS[0], prefs({ order: { Operación: ["/zz", "/b", "/b", "/d"] } })))
    ).toEqual(["/b", "/a", "/c"]);
  });

  it("el orden de otro grupo no afecta", () => {
    expect(urls(orderGroupItems(GROUPS[0], prefs({ order: { Equipo: ["/e", "/d"] } })))).toEqual([
      "/a",
      "/b",
      "/c",
    ]);
  });
});

describe("applyNavPreferences", () => {
  it("sin preferencias → igual que el menú, sin favoritos", () => {
    expect(shape(applyNavPreferences(GROUPS, prefs()))).toEqual({
      favorites: [],
      groups: [
        ["Operación", ["/a", "/b", "/c"]],
        ["Equipo", ["/d", "/e"]],
        ["Admin", ["/f"]],
      ],
    });
  });

  it("favoritos en el orden del usuario y fuera de sus grupos (sin duplicar)", () => {
    expect(shape(applyNavPreferences(GROUPS, prefs({ favorites: ["/e", "/b"] })))).toEqual({
      favorites: ["/e", "/b"],
      groups: [
        ["Operación", ["/a", "/c"]],
        ["Equipo", ["/d"]],
        ["Admin", ["/f"]],
      ],
    });
  });

  it("ocultos fuera de la barra", () => {
    expect(shape(applyNavPreferences(GROUPS, prefs({ hidden: ["/a", "/d"] })))).toEqual({
      favorites: [],
      groups: [
        ["Operación", ["/b", "/c"]],
        ["Equipo", ["/e"]],
        ["Admin", ["/f"]],
      ],
    });
  });

  it("un ítem oculto no aparece aunque esté en favoritos", () => {
    const r = applyNavPreferences(GROUPS, prefs({ favorites: ["/a"], hidden: ["/a"] }));
    expect(urls(r.favorites)).toEqual([]);
    expect(urls(r.groups[0].items)).toEqual(["/b", "/c"]);
  });

  it("ids desconocidos o ya no permitidos se ignoran", () => {
    expect(
      shape(
        applyNavPreferences(
          GROUPS,
          prefs({ favorites: ["/nope", "/f"], hidden: ["/otra"], order: { Fantasma: ["/a"] } })
        )
      )
    ).toEqual({
      favorites: ["/f"],
      groups: [
        ["Operación", ["/a", "/b", "/c"]],
        ["Equipo", ["/d", "/e"]],
      ],
    });
  });

  it("omite el grupo que quedó vacío (todo favorito u oculto)", () => {
    const r = applyNavPreferences(GROUPS, prefs({ favorites: ["/d"], hidden: ["/e"] }));
    expect(r.groups.map((g) => g.groupLabel)).toEqual(["Operación", "Admin"]);
  });

  it("orden por grupo + favoritos + ocultos combinados", () => {
    expect(
      shape(
        applyNavPreferences(
          GROUPS,
          prefs({ favorites: ["/c"], hidden: ["/b"], order: { Operación: ["/c", "/b", "/a"], Equipo: ["/e"] } })
        )
      )
    ).toEqual({
      favorites: ["/c"],
      groups: [
        ["Operación", ["/a"]],
        ["Equipo", ["/e", "/d"]],
        ["Admin", ["/f"]],
      ],
    });
  });

  it("ítem nuevo del menú aparece al final de su grupo", () => {
    const withNew = [{ ...GROUPS[0], items: [...GROUPS[0].items, it_("/nuevo")] }, ...GROUPS.slice(1)];
    const r = applyNavPreferences(withNew, prefs({ order: { Operación: ["/c", "/b", "/a"] } }));
    expect(urls(r.groups[0].items)).toEqual(["/c", "/b", "/a", "/nuevo"]);
  });

  it("una url repetida en dos grupos sólo aparece una vez", () => {
    const dup = [GROUPS[0], { groupLabel: "Otro", items: [it_("/a"), it_("/z")] }];
    const r = applyNavPreferences(dup, prefs());
    expect(r.groups.map((g) => urls(g.items))).toEqual([["/a", "/b", "/c"], ["/z"]]);
  });

  it("no muta la entrada", () => {
    const copy = JSON.stringify(GROUPS);
    applyNavPreferences(GROUPS, prefs({ favorites: ["/a"], order: { Operación: ["/c"] } }));
    expect(JSON.stringify(GROUPS)).toBe(copy);
  });

  it("funciona con el menú real filtrado por rol (recepción no ve Usuarios)", () => {
    const groups = buildMenuItems()
      .map((g) => ({ ...g, items: g.items.filter((i) => isNavItemVisible(i, ["recepcion"], false)) }))
      .filter((g) => g.items.length > 0);
    const r = applyNavPreferences(groups, prefs({ favorites: ["/dashboard/usuarios", "/dashboard/clientes"] }));
    expect(urls(r.favorites)).toEqual(["/dashboard/clientes"]);
    expect(r.groups.some((g) => g.items.some((i) => i.url === "/dashboard/clientes"))).toBe(false);
  });
});

describe("resolveFavorites", () => {
  it("dedup y orden del usuario", () => {
    expect(urls(resolveFavorites(GROUPS, prefs({ favorites: ["/f", "/a", "/f"] })))).toEqual(["/f", "/a"]);
  });
});

describe("cambios", () => {
  it("toggleFavorite agrega al final y quita; fijar un oculto lo muestra", () => {
    let p = toggleFavorite(prefs({ favorites: ["/a"], hidden: ["/b"] }), "/b");
    expect(p.favorites).toEqual(["/a", "/b"]);
    expect(p.hidden).toEqual([]);
    expect(isFavorite(p, "/b")).toBe(true);
    p = toggleFavorite(p, "/a");
    expect(p.favorites).toEqual(["/b"]);
  });

  it("setHidden oculta (y quita de favoritos) y muestra", () => {
    let p = setHidden(prefs({ favorites: ["/a"] }), "/a", true);
    expect(p).toMatchObject({ hidden: ["/a"], favorites: [] });
    expect(isHidden(p, "/a")).toBe(true);
    expect(setHidden(p, "/a", true)).toBe(p);
    p = setHidden(p, "/a", false);
    expect(p.hidden).toEqual([]);
    expect(setHidden(p, "/a", false)).toBe(p);
  });

  it("reorderFavorites conserva al final los favoritos no visibles", () => {
    const p = reorderFavorites(prefs({ favorites: ["/a", "/oculto-por-rol", "/b"] }), ["/b", "/a"]);
    expect(p.favorites).toEqual(["/b", "/a", "/oculto-por-rol"]);
  });

  it("reorderGroup guarda el orden de un grupo sin tocar los demás", () => {
    const p = reorderGroup(prefs({ order: { Equipo: ["/e", "/d"] } }), "Operación", ["/c", "/a", "/b", "/c"]);
    expect(p.order).toEqual({ Equipo: ["/e", "/d"], Operación: ["/c", "/a", "/b"] });
  });

  it("setExpanded", () => {
    const p = prefs();
    expect(setExpanded(p, false)).toBe(p);
    expect(setExpanded(p, true).expanded).toBe(true);
  });

  it("no mutan el objeto original", () => {
    const p = prefs({ favorites: ["/a"], hidden: ["/b"], order: { X: ["/a"] } });
    const copy = JSON.stringify(p);
    toggleFavorite(p, "/c");
    setHidden(p, "/a", true);
    reorderFavorites(p, ["/a"]);
    reorderGroup(p, "X", ["/b"]);
    setExpanded(p, true);
    expect(JSON.stringify(p)).toBe(copy);
  });
});

describe("pickPrimaryTabUrls", () => {
  const visible = ["/a", "/b", "/c", "/d", "/e", "/f"];
  const priority = ["/a", "/b", "/c", "/d", "/e", "/f"];

  it("sin preferencias → prioridad por defecto", () => {
    expect(pickPrimaryTabUrls(visible, prefs(), priority, 4)).toEqual(["/a", "/b", "/c", "/d"]);
  });

  it("favoritos primero, en su orden", () => {
    expect(pickPrimaryTabUrls(visible, prefs({ favorites: ["/f", "/e"] }), priority, 4)).toEqual([
      "/f",
      "/e",
      "/a",
      "/b",
    ]);
  });

  it("excluye ocultos y no visibles", () => {
    expect(
      pickPrimaryTabUrls(["/a", "/b", "/c", "/d", "/e"], prefs({ favorites: ["/zz"], hidden: ["/a", "/c"] }), priority, 4)
    ).toEqual(["/b", "/d", "/e"]);
  });

  it("con el menú real: un favorito de recepción entra primero", () => {
    const visibleUrls = buildMenuItems()
      .flatMap((g) => g.items)
      .filter((i) => isNavItemVisible(i, ["recepcion"], false))
      .map((i) => i.url);
    const picked = pickPrimaryTabUrls(
      visibleUrls,
      prefs({ favorites: ["/dashboard/clientes"] }),
      TAB_PRIORITY_URLS,
      MAX_PRIMARY_TABS
    );
    expect(picked[0]).toBe("/dashboard/clientes");
    expect(picked).toHaveLength(MAX_PRIMARY_TABS);
  });
});
