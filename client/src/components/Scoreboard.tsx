import type { PlayerState } from "@promptcraft/shared";

type ScoreboardProps = {
  players: PlayerState[];
  localPlayerId: string | null;
};

export function Scoreboard({ players, localPlayerId }: ScoreboardProps) {
  // Sort players by kills descending, then deaths ascending
  const sortedPlayers = [...players].sort((a, b) => {
    if (b.kills !== a.kills) return b.kills - a.kills;
    return a.deaths - b.deaths;
  });

  return (
    <div className="scoreboard-overlay">
      <div className="scoreboard-container">
        <div className="scoreboard-header">
          <h2>AIRSPACE SCOREBOARD</h2>
        </div>
        <div className="scoreboard-table">
          <div className="scoreboard-row scoreboard-row--header">
            <div className="sb-cell sb-cell--name">PILOT</div>
            <div className="sb-cell sb-cell--stat">KILLS</div>
            <div className="sb-cell sb-cell--stat">DEATHS</div>
            <div className="sb-cell sb-cell--stat">RATIO</div>
            <div className="sb-cell sb-cell--stat">PING</div>
          </div>
          {sortedPlayers.map((p) => {
            const ratio = p.deaths === 0 ? p.kills.toFixed(1) : (p.kills / p.deaths).toFixed(1);
            const isLocal = p.id === localPlayerId;
            return (
              <div key={p.id} className={`scoreboard-row ${isLocal ? "scoreboard-row--local" : ""}`}>
                <div className="sb-cell sb-cell--name" style={{ color: p.color }}>
                  {p.name} {isLocal && "(YOU)"}
                </div>
                <div className="sb-cell sb-cell--stat">{p.kills}</div>
                <div className="sb-cell sb-cell--stat">{p.deaths}</div>
                <div className="sb-cell sb-cell--stat">{ratio}</div>
                <div className="sb-cell sb-cell--stat">--</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
