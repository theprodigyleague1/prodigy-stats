// Made-up stats for previewing the design (index.html?demo). Not real players.
// Shaped exactly like the /api/leaderboard response.
(() => {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const int = (lo, hi) => Math.floor(lo + rand() * (hi - lo + 1));

  const FIRST = ['Jalen', 'Marcus', 'Devin', 'Tyler', 'Andre', 'Chris', 'Noah', 'Eli', 'Mason', 'Isaiah',
    'Caleb', 'Jordan', 'Aiden', 'Miles', 'Xavier', 'Owen', 'Bryce', 'Darius', 'Gabe', 'Luca'];
  const LAST = ['Carter', 'Brooks', 'Reed', 'Hayes', 'Price', 'Ellis', 'Grant', 'Woods', 'Fox', 'Lane',
    'Shaw', 'Cole', 'Wade', 'Banks', 'Ross', 'Hale', 'Moss', 'Pope', 'Nash', 'Kent'];

  const DIVS = [
    ['nxt', 'NXT', ['Timberwolves', 'Trail Blazers', 'Pacers', 'Jazz', '76ers', 'Hornets']],
    ['frosh', 'Frosh', ['Timberwolves', 'Trail Blazers', 'Pacers', 'Jazz', '76ers', 'Hornets']],
    ['prep', 'Prep', ['Pacers', 'Jazz', 'Trail Blazers', 'Timberwolves']],
  ];

  const divisions = DIVS.map(([id, name, shorts]) => {
    const teams = [], players = [];
    shorts.forEach((short, ti) => {
      const games = ti === shorts.length - 1 && id === 'nxt' ? 0 : int(3, 5);
      teams.push({ name: `${name} ${short}`, short, status: 'ok', games });
      if (!games) return;
      for (let i = 0; i < int(7, 9); i++) {
        const skill = rand();
        const gp = Math.max(1, games - (rand() < .2 ? int(1, 2) : 0));
        const fga = Math.round(gp * (2 + skill * 12));
        const tpa = Math.round(fga * (.2 + rand() * .3));
        const tpm = Math.round(tpa * (.15 + rand() * .25));
        const fgm = Math.max(tpm, Math.round(fga * (.28 + rand() * .22)));
        const fta = Math.round(gp * rand() * 4 * (.5 + skill));
        const ftm = Math.round(fta * (.4 + rand() * .45));
        const oreb = Math.round(gp * rand() * 3);
        const dreb = Math.round(gp * (rand() * 5 + skill * 2));
        const p = {
          name: `${FIRST[int(0, 19)]} ${LAST[int(0, 19)]}`,
          number: String(int(0, 35)),
          team: short,
          gp,
          min: Math.round(gp * (8 + skill * 18) * 10) / 10,
          pts: 2 * fgm + tpm + ftm,
          fgm, fga, tpm, tpa, ftm, fta, oreb, dreb, reb: oreb + dreb,
          ast: Math.round(gp * rand() * 4),
          stl: Math.round(gp * rand() * 3),
          blk: Math.round(gp * rand() * rand() * 3),
          tov: Math.round(gp * rand() * 3),
          pf: Math.round(gp * rand() * 3),
        };
        p.eff = p.pts + p.reb + p.ast + p.stl + p.blk - (fga - fgm) - (fta - ftm) - p.tov;
        players.push(p);
      }
    });
    return { id, name, teams, players };
  });

  window.DEMO_DATA = {
    league: 'Prodigy League',
    season: 'Fall 2026',
    updated: new Date().toISOString(),
    warnings: [],
    divisions,
  };
})();
