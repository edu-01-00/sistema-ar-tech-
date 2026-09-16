import { describe, expect, it } from "vitest";
import { hasPermission, hasAnyPermission } from "@/lib/permissions";

describe("hasPermission", () => {
  it("retorna true quando a permissão está na lista do usuário", () => {
    expect(hasPermission(["clients.view", "clients.manage"], "clients.manage")).toBe(true);
  });

  it("retorna false quando a permissão não está na lista", () => {
    expect(hasPermission(["clients.view"], "clients.manage")).toBe(false);
  });

  it("retorna false quando a lista de permissões é indefinida", () => {
    expect(hasPermission(undefined, "clients.view")).toBe(false);
  });
});

describe("hasAnyPermission", () => {
  it("retorna true se ao menos uma das permissões estiver presente", () => {
    expect(hasAnyPermission(["proposals.view"], ["proposals.manage", "proposals.view"])).toBe(true);
  });

  it("retorna false se nenhuma das permissões estiver presente", () => {
    expect(hasAnyPermission(["clients.view"], ["proposals.manage", "proposals.view"])).toBe(false);
  });
});
