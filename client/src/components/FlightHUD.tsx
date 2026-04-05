import type { KillEvent, PlayerState } from "@promptcraft/shared";

type FlightHUDProps = {
  health: number;
  speed: number;
  altitude: number;
  heading: number;
  kills: number;
  deaths: number;
  targets: PlayerState[];
  localPosition: { x: number; y: number; z: number } | null;
  killFeed: KillEvent[];
  localPlayerId: string | null;
};

const COMPASS_DIRS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

function getCompassDir(heading: number) {
  const idx = Math.round(((heading % 360) + 360) % 360 / 45) % 8;
  return COMPASS_DIRS[idx];
}

export function FlightHUD({
  health,
  speed,
  altitude,
  heading,
  kills,
  deaths,
  targets,
  localPosition,
  killFeed,
  localPlayerId,
}: FlightHUDProps) {
  const headingDeg = Math.round(((heading * 180 / Math.PI) % 360 + 360) % 360);

  return (
    <div className="flight-hud">
      {/* Crosshair */}
      <div className="hud-crosshair">
        <div className="ch-vline" />
        <div className="ch-hline" />
        <div className="ch-circle" />
        <div className="ch-dot" />
      </div>

      {/* Compass heading */}
      <div className="hud-compass">
        <span className="compass-deg">{String(headingDeg).padStart(3, "0")}°</span>
        <span className="compass-dir">{getCompassDir(headingDeg)}</span>
      </div>

      {/* Left gauges - speed & altitude */}
      <div className="hud-gauges-left">
        <div className="gauge-vertical">
          <span className="gauge-label">SPD</span>
          <span className="gauge-value">{Math.round(speed)}</span>
        </div>
        <div className="gauge-vertical">
          <span className="gauge-label">ALT</span>
          <span className="gauge-value">{Math.round(altitude)}</span>
        </div>
      </div>

      {/* Right gauges - health & score */}
      <div className="hud-gauges-right">
        <div className="gauge-vertical">
          <span className="gauge-label">HP</span>
          <span className="gauge-value" style={{ color: health < 30 ? "#ff4444" : "#5dff7e" }}>
            {Math.round(health)}
          </span>
        </div>
        <div className="gauge-vertical">
          <span className="gauge-label">K/D</span>
          <span className="gauge-value">{kills}/{deaths}</span>
        </div>
      </div>

      {/* Health bar */}
      <div className="hud-health-bar">
        <div
          className="hud-health-fill"
          style={{
            width: `${Math.max(0, health)}%`,
            background: health < 30
              ? "linear-gradient(90deg, #ff2222, #ff4444)"
              : health < 60
              ? "linear-gradient(90deg, #ff8800, #ffaa00)"
              : "linear-gradient(90deg, #22cc44, #5dff7e)",
          }}
        />
      </div>

      {/* Radar */}
      <div className="hud-radar">
        <div className="radar-ring" />
        <div className="radar-ring radar-ring--inner" />
        <div className="radar-cross-h" />
        <div className="radar-cross-v" />
        <div className="radar-center" />
        {localPosition && targets.map((t) => {
          const dx = t.position.x - localPosition.x;
          const dz = t.position.z - localPosition.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          const maxRange = 800;
          if (dist > maxRange) return null;

          const angle = Math.atan2(dx, -dz) - heading;
          const r = (dist / maxRange) * 45;
          const px = Math.sin(angle) * r;
          const py = -Math.cos(angle) * r;

          return (
            <div
              key={t.id}
              className="radar-blip"
              style={{
                left: `${50 + px}%`,
                top: `${50 + py}%`,
                background: t.color,
                boxShadow: `0 0 4px ${t.color}`,
              }}
            />
          );
        })}
      </div>

      {/* Kill feed */}
      {killFeed.length > 0 && (
        <div className="hud-kill-feed">
          {killFeed.slice(-4).map((k, i) => (
            <div key={`${k.timestamp}-${i}`} className="kill-feed-entry">
              <span style={{ color: k.killerColor }}>{k.killerName}</span>
              <span className="kill-feed-icon">✈ ➤</span>
              <span style={{ color: k.victimColor }}>{k.victimName}</span>
            </div>
          ))}
        </div>
      )}

      {/* Destroyed overlay */}
      {health <= 0 && (
        <div className="destroyed-banner">
          <h1>DESTROYED</h1>
          <p>Respawning...</p>
        </div>
      )}

      {/* Warning flashes */}
      {health > 0 && health < 30 && (
        <div className="hud-warning-overlay" />
      )}
    </div>
  );
}
