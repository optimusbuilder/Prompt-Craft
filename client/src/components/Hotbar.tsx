import type { SceneObject } from "@promptcraft/shared";

type HotbarProps = {
  recentBuilds: SceneObject[];
  selectedSlot: number;
  onSelectSlot: (slot: number) => void;
};

export function Hotbar({ recentBuilds, selectedSlot, onSelectSlot }: HotbarProps) {
  const slots = Array.from({ length: 9 }, (_, i) => recentBuilds[i] || null);

  return (
    <div className="hotbar">
      {slots.map((build, index) => (
        <button
          key={index}
          className={`hotbar-slot ${index === selectedSlot ? "hotbar-slot--selected" : ""}`}
          onClick={() => onSelectSlot(index)}
        >
          {build ? (
            <div className="hotbar-item">
              <div
                className="hotbar-item-icon"
                style={{ backgroundColor: build.accentColor }}
              />
              <span className="hotbar-item-label">{build.archetype[0].toUpperCase()}</span>
            </div>
          ) : (
            <span className="hotbar-slot-num">{index + 1}</span>
          )}
        </button>
      ))}
    </div>
  );
}
