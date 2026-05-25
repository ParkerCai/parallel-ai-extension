import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useProviderContext } from "@/shared/contexts/ProviderContext";
import { useSettingsContext } from "@/shared/contexts/SettingsContext";
import { renderHookWithProviders } from "../helpers/hook";
import { readStorage } from "../setup/chrome-mock";

describe("ProviderContext", () => {
  it("exposes the ordered provider list", async () => {
    const { result } = renderHookWithProviders(() => useProviderContext());
    expect(Array.isArray(result.current.providers)).toBe(true);
    expect(result.current.providers.length).toBeGreaterThan(0);
  });

  it("toggleProvider adds and removes a provider from the enabled set", async () => {
    const { result } = renderHookWithProviders(() => ({
      providers: useProviderContext(),
      settings: useSettingsContext(),
    }));
    await waitFor(() => expect(result.current.settings.loaded).toBe(true));

    const initialEnabled = result.current.settings.settings.enabledProviders;
    expect(initialEnabled).toContain("chatgpt");

    await act(async () => {
      await result.current.providers.toggleProvider("chatgpt");
    });
    expect(result.current.settings.settings.enabledProviders).not.toContain("chatgpt");

    await act(async () => {
      await result.current.providers.toggleProvider("chatgpt");
    });
    expect(result.current.settings.settings.enabledProviders).toContain("chatgpt");
  });

  it("reorderProvider swaps two providers in the order list", async () => {
    const { result } = renderHookWithProviders(() => ({
      providers: useProviderContext(),
      settings: useSettingsContext(),
    }));
    await waitFor(() => expect(result.current.settings.loaded).toBe(true));

    const initial = result.current.providers.providers.map((p) => p.id);
    const [first, second] = [initial[0]!, initial[1]!];

    await act(async () => {
      await result.current.providers.reorderProvider(first, second);
    });
    const after = result.current.providers.providers.map((p) => p.id);
    expect(after[0]).toBe(second);
    expect(after[1]).toBe(first);
  });

  it("reorderProvider is a no-op when ids match", async () => {
    const { result } = renderHookWithProviders(() => ({
      providers: useProviderContext(),
      settings: useSettingsContext(),
    }));
    await waitFor(() => expect(result.current.settings.loaded).toBe(true));

    const before = result.current.providers.providers.map((p) => p.id);
    await act(async () => {
      await result.current.providers.reorderProvider("chatgpt", "chatgpt");
    });
    const after = result.current.providers.providers.map((p) => p.id);
    expect(after).toEqual(before);
  });

  it("reorderProvider is a no-op when the provider isn't in the list", async () => {
    const { result } = renderHookWithProviders(() => ({
      providers: useProviderContext(),
      settings: useSettingsContext(),
    }));
    await waitFor(() => expect(result.current.settings.loaded).toBe(true));

    const before = result.current.providers.providers.map((p) => p.id);
    await act(async () => {
      await result.current.providers.reorderProvider(
        "not-a-provider" as never,
        "chatgpt",
      );
    });
    expect(result.current.providers.providers.map((p) => p.id)).toEqual(before);
  });

  it("setGoogleMode persists the value to settings", async () => {
    const { result } = renderHookWithProviders(() => ({
      providers: useProviderContext(),
      settings: useSettingsContext(),
    }));
    await waitFor(() => expect(result.current.settings.loaded).toBe(true));

    await act(async () => {
      await result.current.providers.setGoogleMode("search");
    });
    expect(readStorage("sync").googleProviderMode).toBe("search");
  });

  it("setGoogleMode coerces unknown values to 'ai'", async () => {
    const { result } = renderHookWithProviders(() => ({
      providers: useProviderContext(),
      settings: useSettingsContext(),
    }));
    await waitFor(() => expect(result.current.settings.loaded).toBe(true));

    await act(async () => {
      await result.current.providers.setGoogleMode("weird" as never);
    });
    expect(readStorage("sync").googleProviderMode).toBe("ai");
  });
});
