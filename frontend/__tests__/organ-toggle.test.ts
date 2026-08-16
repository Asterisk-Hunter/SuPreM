import { describe, it, expect } from "vitest";

// Simulate the organ toggle logic from page.tsx
function createOrganToggle(initialOrgans: string[]) {
  let activeOrgans = new Set<string>(initialOrgans);

  const toggleOrgan = (organ: string) => {
    const next = new Set(activeOrgans);
    if (next.has(organ)) {
      next.delete(organ);
    } else {
      next.add(organ);
    }
    activeOrgans = next;
    return activeOrgans;
  };

  const selectAll = (organs: string[]) => {
    activeOrgans = new Set(organs);
    return activeOrgans;
  };

  const deselectAll = () => {
    activeOrgans = new Set();
    return activeOrgans;
  };

  const getActive = () => activeOrgans;

  return { toggleOrgan, selectAll, deselectAll, getActive };
}

describe("Organ Toggle Logic", () => {
  const organs = ["Spleen", "Liver", "Right Kidney", "Left Kidney", "Aorta"];

  it("should initialize with all organs active", () => {
    const { getActive } = createOrganToggle(organs);
    const active = getActive();
    expect(active.size).toBe(organs.length);
    organs.forEach((organ) => expect(active.has(organ)).toBe(true));
  });

  it("should toggle organ off", () => {
    const { toggleOrgan, getActive } = createOrganToggle(organs);
    toggleOrgan("Spleen");
    const active = getActive();
    expect(active.has("Spleen")).toBe(false);
    expect(active.size).toBe(organs.length - 1);
  });

  it("should toggle organ back on", () => {
    const { toggleOrgan, getActive } = createOrganToggle(organs);
    toggleOrgan("Spleen");
    toggleOrgan("Spleen");
    const active = getActive();
    expect(active.has("Spleen")).toBe(true);
    expect(active.size).toBe(organs.length);
  });

  it("should select all organs", () => {
    const { deselectAll, selectAll, getActive } = createOrganToggle([]);
    deselectAll();
    selectAll(organs);
    const active = getActive();
    expect(active.size).toBe(organs.length);
  });

  it("should deselect all organs", () => {
    const { deselectAll, getActive } = createOrganToggle(organs);
    deselectAll();
    const active = getActive();
    expect(active.size).toBe(0);
  });

  it("should handle multiple toggles", () => {
    const { toggleOrgan, getActive } = createOrganToggle(organs);
    toggleOrgan("Spleen");
    toggleOrgan("Liver");
    toggleOrgan("Aorta");
    const active = getActive();
    expect(active.size).toBe(organs.length - 3);
    expect(active.has("Spleen")).toBe(false);
    expect(active.has("Liver")).toBe(false);
    expect(active.has("Aorta")).toBe(false);
    expect(active.has("Right Kidney")).toBe(true);
    expect(active.has("Left Kidney")).toBe(true);
  });
});

describe("Overlay Filtering", () => {
  const organOverlays: Record<string, { slice_index: number; image: string }[]> = {
    Spleen: [
      { slice_index: 0, image: "base64_spleen_0" },
      { slice_index: 1, image: "base64_spleen_1" },
    ],
    Liver: [
      { slice_index: 0, image: "base64_liver_0" },
      { slice_index: 1, image: "base64_liver_1" },
    ],
    Aorta: [
      { slice_index: 0, image: "base64_aorta_0" },
      { slice_index: 1, image: "base64_aorta_1" },
    ],
  };

  it("should filter overlays by active organs", () => {
    const activeOrgans = new Set(["Spleen", "Aorta"]);
    const activeOverlays: { name: string; image: string }[] = [];

    for (const organName of activeOrgans) {
      const overlays = organOverlays[organName];
      if (overlays && overlays[0]) {
        activeOverlays.push({ name: organName, image: overlays[0].image });
      }
    }

    expect(activeOverlays.length).toBe(2);
    expect(activeOverlays.map((o) => o.name)).toContain("Spleen");
    expect(activeOverlays.map((o) => o.name)).toContain("Aorta");
    expect(activeOverlays.map((o) => o.name)).not.toContain("Liver");
  });

  it("should return empty when no organs active", () => {
    const activeOrgans = new Set<string>();
    const activeOverlays: { name: string; image: string }[] = [];

    for (const organName of activeOrgans) {
      const overlays = organOverlays[organName];
      if (overlays && overlays[0]) {
        activeOverlays.push({ name: organName, image: overlays[0].image });
      }
    }

    expect(activeOverlays.length).toBe(0);
  });

  it("should handle missing organ overlays gracefully", () => {
    const activeOrgans = new Set(["Unknown Organ"]);
    const activeOverlays: { name: string; image: string }[] = [];

    for (const organName of activeOrgans) {
      const overlays = organOverlays[organName];
      if (overlays && overlays[0]) {
        activeOverlays.push({ name: organName, image: overlays[0].image });
      }
    }

    expect(activeOverlays.length).toBe(0);
  });
});
