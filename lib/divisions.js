// League setup. `name` must match the team name in Superstat exactly (case-insensitive).
// Superstat has older teams with the same names (e.g. a Summer "NXT Jazz"), so a team is
// only picked if its league/division text contains `seasonMatch`.
// To pin a team explicitly, add `id: "<superstat team uuid>"` — see /api/leaderboard?debug=1.

export const LEAGUE = {
  name: 'Prodigy League',
  season: 'Fall 2026',
  seasonMatch: 'fall 2026',
  divisions: [
    {
      id: 'nxt',
      name: 'NXT',
      teams: [
        { name: 'NXT Timberwolves', short: 'Timberwolves' },
        { name: 'NXT Trail Blazers', short: 'Trail Blazers' },
        { name: 'NXT Pacers', short: 'Pacers' },
        { name: 'NXT Jazz', short: 'Jazz' },
        { name: 'NXT 76ers', short: '76ers' },
        { name: 'NXT Hornets', short: 'Hornets' },
      ],
    },
    {
      id: 'frosh',
      name: 'Frosh',
      teams: [
        { name: 'Frosh Timberwolves', short: 'Timberwolves' },
        { name: 'Frosh Trail Blazers', short: 'Trail Blazers' },
        { name: 'Frosh Pacers', short: 'Pacers' },
        { name: 'Frosh Jazz', short: 'Jazz' },
        { name: 'Frosh 76ers', short: '76ers' },
        { name: 'Frosh Hornets', short: 'Hornets' },
      ],
    },
    {
      id: 'prep',
      name: 'Prep',
      teams: [
        { name: 'Prep Pacers', short: 'Pacers' },
        { name: 'Prep Jazz', short: 'Jazz' },
        { name: 'Prep Trail Blazers', short: 'Trail Blazers' },
        { name: 'Prep Timberwolves', short: 'Timberwolves' },
      ],
    },
  ],
};
