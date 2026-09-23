/**
 * Glicko-2 (Glickman, 2012). Рейтинг r, отклонение RD, волатильность σ.
 * Один «рейтинговый период» = один матч: так рейтинг реагирует сразу, а RD постепенно сужается.
 */

export interface Rating {
  rating: number;
  rd: number;
  vol: number;
}

const SCALE = 173.7178;
const TAU = 0.5;
const EPS = 1e-6;

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
const E = (mu: number, muj: number, phij: number) => 1 / (1 + Math.exp(-g(phij) * (mu - muj)));

/** Обновить рейтинг игрока по результатам против соперников (score: 1 — победа, 0.5 — ничья, 0 — поражение). */
export function glicko2(player: Rating, results: { opp: Rating; score: number }[]): Rating {
  const mu = (player.rating - 1500) / SCALE;
  const phi = player.rd / SCALE;
  if (!results.length) {
    const phiStar = Math.sqrt(phi * phi + player.vol * player.vol);
    return { rating: player.rating, rd: Math.min(350, phiStar * SCALE), vol: player.vol };
  }
  let vInv = 0, deltaSum = 0;
  for (const { opp, score } of results) {
    const muj = (opp.rating - 1500) / SCALE, phij = opp.rd / SCALE;
    const e = E(mu, muj, phij);
    vInv += g(phij) ** 2 * e * (1 - e);
    deltaSum += g(phij) * (score - e);
  }
  const v = 1 / vInv;
  const delta = v * deltaSum;
  // новая волатильность — итерационный метод Иллинойса
  const a = Math.log(player.vol ** 2);
  const f = (x: number) => (Math.exp(x) * (delta ** 2 - phi ** 2 - v - Math.exp(x))) / (2 * (phi ** 2 + v + Math.exp(x)) ** 2) - (x - a) / TAU ** 2;
  let A = a, B: number;
  if (delta ** 2 > phi ** 2 + v) B = Math.log(delta ** 2 - phi ** 2 - v);
  else {
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    B = a - k * TAU;
  }
  let fA = f(A), fB = f(B);
  for (let i = 0; i < 100 && Math.abs(B - A) > EPS; i++) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else fA /= 2;
    B = C;
    fB = fC;
  }
  const vol = Math.exp(A / 2);
  const phiStar = Math.sqrt(phi ** 2 + vol ** 2);
  const phiNew = 1 / Math.sqrt(1 / phiStar ** 2 + 1 / v);
  const muNew = mu + phiNew ** 2 * deltaSum;
  return { rating: muNew * SCALE + 1500, rd: Math.max(30, phiNew * SCALE), vol };
}

/** Командный матч: каждый игрок против «среднего» соперника команды противника. */
export function teamAverage(team: Rating[]): Rating {
  const n = team.length || 1;
  return {
    rating: team.reduce((s, r) => s + r.rating, 0) / n,
    rd: Math.sqrt(team.reduce((s, r) => s + r.rd ** 2, 0) / n),
    vol: team.reduce((s, r) => s + r.vol, 0) / n,
  };
}

/** Мягкий сброс в начале сезона: MMR = 0,7 × MMR + 0,3 × 1500. */
export const seasonReset = (r: Rating): Rating => ({ rating: 0.7 * r.rating + 0.3 * 1500, rd: Math.max(r.rd, 150), vol: r.vol });
