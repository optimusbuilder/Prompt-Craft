export function FlightHUD({ health, speed, altitude, targets }: { health: number; speed: number; altitude: number; targets: any[] }) {
  return (
    <div className="flight-hud">
      <div className="hud-crosshair">
        <div className="ch-vline"></div>
        <div className="ch-hline"></div>
        <div className="ch-circle"></div>
      </div>
      
      <div className="hud-gauges">
        <div className="gauge">
          <span>SPD:</span>
          <span>{Math.round(speed)}</span>
        </div>
        <div className="gauge">
          <span>ALT:</span>
          <span>{Math.round(altitude)}</span>
        </div>
        <div className="gauge">
          <span>HP:</span>
          <span style={{ color: health < 30 ? "#ff4444" : "#5dff7e" }}>{Math.round(health)}</span>
        </div>
      </div>

      {health <= 0 && (
        <div className="destroyed-banner">
          <h1>DESTROYED</h1>
          <p>Respawning...</p>
        </div>
      )}
    </div>
  );
}
