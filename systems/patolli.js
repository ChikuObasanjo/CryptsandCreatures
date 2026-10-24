"use strict";

// Classic patolli layout: two crossing strips, each arm two lanes wide and six squares long,
// meeting in four center crossroads (4 × 13 = 52 squares). Coordinates are [row, column]
// on a 14 × 14 grid; the board is drawn as a "+" and rotated 45° into an X.
const PATOLLI_GRID_SIZE = 14;
const PATOLLI_TRACK = (() => {
  const track = [];
  const arm = (center, out, across, back) => {
    track.push(center, ...out, across, ...back);
  };
  const range = (from, to) => {
    const step = from <= to ? 1 : -1;
    return Array.from({ length: Math.abs(to - from) + 1 }, (_, index) => from + index * step);
  };
  arm([6, 6], range(5, 0).map((row) => [row, 6]), [0, 7], range(1, 5).map((row) => [row, 7]));
  arm([6, 7], range(8, 13).map((column) => [6, column]), [7, 13], range(12, 8).map((column) => [7, column]));
  arm([7, 7], range(8, 13).map((row) => [row, 7]), [13, 6], range(12, 8).map((row) => [row, 6]));
  arm([7, 6], range(5, 0).map((column) => [7, column]), [6, 0], range(1, 5).map((column) => [6, column]));
  return track;
})();
const PATOLLI_CAPTURE_SQUARES = [0, 13, 26, 39];
// Every arm carries a pair of penalty triangles, one in each lane, four squares out
// from the crossroads, and both rounded end squares of every arm grant another turn.
const PATOLLI_PENALTY_SQUARES = [0, 1, 2, 3].flatMap((arm) => [arm * 13 + 4, arm * 13 + 9]);
const PATOLLI_EXTRA_TURN_SQUARES = [0, 1, 2, 3].flatMap((arm) => [arm * 13 + 6, arm * 13 + 7]);
const PATOLLI_PLAYER_START = 6;
const PATOLLI_OPPONENT_START = 32;
const PATOLLI_TRACK_VERSION = 4;
if (PATOLLI_TRACK.length !== 52 || new Set(PATOLLI_TRACK.map(([row, column]) => `${row},${column}`)).size !== 52 ||
  PATOLLI_TRACK.some(([row, column], index) => {
    const [nextRow, nextColumn] = PATOLLI_TRACK[(index + 1) % PATOLLI_TRACK.length];
    return row < 0 || row >= PATOLLI_GRID_SIZE || column < 0 || column >= PATOLLI_GRID_SIZE ||
      Math.abs(row - nextRow) + Math.abs(column - nextColumn) !== 1;
  })) throw new Error("The Patolli circuit must be a connected 52-square track.");

// Squares are numbered from your own start, so your pieces always count upward 1 → 52 and then HOME.
function patolliSquareNumber(trackIndex) {
  return ((trackIndex - PATOLLI_PLAYER_START + PATOLLI_TRACK.length) % PATOLLI_TRACK.length) + 1;
}

// Grid direction from a square to the next one along the circuit (0 = up, clockwise in degrees).
function patolliStepAngle(trackIndex) {
  const [row, column] = PATOLLI_TRACK[trackIndex];
  const [nextRow, nextColumn] = PATOLLI_TRACK[(trackIndex + 1) % PATOLLI_TRACK.length];
  if (nextRow < row) return 0;
  if (nextColumn > column) return 90;
  if (nextRow > row) return 180;
  return 270;
}

function maxPatolliStakePerPiece() {
  // Patolli is played in town, where secured gold sits in the Ceiba House strongbox.
  return Math.max(0, Math.min(
    Math.floor(state.run.gold / 6),
    Math.floor(Math.max(0, MAX_GOLD - state.run.gold) / 6)
  ));
}

function rollPatolliBeans() {
  const beans = Array.from({ length: 5 }, () => randomInt(2) === 1);
  return { beans, count: beans.filter(Boolean).length };
}

function patolliMoveDistance(count) {
  return count === 5 ? 10 : count;
}

function patolliTrackIndex(side, progress) {
  const start = side === "player" ? PATOLLI_PLAYER_START : PATOLLI_OPPONENT_START;
  return (start + progress) % PATOLLI_TRACK.length;
}

function patolliPieceAt(side, piece) {
  return piece.status === "active" ? patolliTrackIndex(side, piece.progress) : -1;
}

function getPatolliLegalMoves(game, side, count) {
  if (!Number.isInteger(count) || count < 1 || count > 5) return [];
  const otherSide = side === "player" ? "opponent" : "player";
  const distance = patolliMoveDistance(count);
  const moves = [];
  for (const piece of game.pieces[side]) {
    if (!["ready", "active"].includes(piece.status)) continue;
    if (piece.status === "ready" && count !== 1) continue;
    const progress = piece.status === "ready" ? 0 : piece.progress + distance;
    if (progress > PATOLLI_TRACK.length) continue;
    const finish = progress === PATOLLI_TRACK.length;
    const trackIndex = finish ? -1 : patolliTrackIndex(side, progress);
    const occupants = finish ? [] : ["player", "opponent"].flatMap((occupantSide) =>
      game.pieces[occupantSide].filter((candidate) =>
        candidate.status === "active" && patolliPieceAt(occupantSide, candidate) === trackIndex)
        .map((candidate) => ({ side: occupantSide, piece: candidate })));
    const opponents = occupants.filter((occupant) => occupant.side === otherSide);
    if (occupants.length > 1 || occupants.some((occupant) => occupant.side === side) ||
      (opponents.length && !PATOLLI_CAPTURE_SQUARES.includes(trackIndex))) continue;
    moves.push({
      pieceId: piece.id,
      progress,
      trackIndex,
      finish,
      captureId: opponents[0]?.piece.id ?? null
    });
  }
  return moves;
}

function resolvePatolliStake(game, pieceId, winner, winningPiece) {
  const stake = game.stakes[pieceId];
  if (stake.status !== "active") return false;
  stake.status = "resolved";
  stake.winner = winner;
  game.score[winner] += 1;
  for (const side of ["player", "opponent"]) {
    const pairedPiece = game.pieces[side][pieceId];
    if (pairedPiece !== winningPiece && ["ready", "active"].includes(pairedPiece.status)) {
      pairedPiece.status = "settled";
    }
  }
  return true;
}

function settlePatolli(winner, message, forfeit = false) {
  const game = state.run.patolliGame;
  if (!game || game.status !== "active" || game.settled) return false;
  let payout = 0;
  for (const stake of game.stakes) {
    if (stake.status === "active") {
      if (!forfeit) payout += stake.playerStake;
    } else if (stake.winner === "player") {
      payout += stake.playerStake + stake.opponentStake;
    }
  }
  if (winner === "player") payout += game.pot;
  else if (winner === "draw") payout += game.playerPotContribution;
  const added = addGoldWithinCapacity(payout);
  if (added !== payout) {
    state.run.gold -= added;
    showToast("The Patolli settlement exceeds your carrying capacity; no stakes were settled.");
    return false;
  }
  game.payout = payout;
  game.settled = true;
  game.status = winner === "player" ? "won" : winner === "draw" ? "draw" : forfeit ? "forfeit" : "lost";
  game.turn = "player";
  game.phase = "finished";
  game.legalMoves = [];
  game.selectedPiece = null;
  game.message = message;
  addLog(`Patolli match ${game.status === "won" ? "won" : game.status === "draw" ? "drawn" : "lost"}. You receive ${formatCurrency(payout)} from the settled stakes.`);
  return true;
}

function checkPatolliEnd(game) {
  if (game.score.player >= 4) {
    settlePatolli("player", "You win four of six matched wagers. The board settles your stakes.");
    return true;
  }
  if (game.score.opponent >= 4) {
    settlePatolli("opponent", `Ixchel wins four of six matched wagers. Unresolved stakes are returned to you.`);
    return true;
  }
  const livePieces = (side) => game.pieces[side].some((piece) => ["ready", "active"].includes(piece.status));
  if (!livePieces("player") || !livePieces("opponent") || game.stakes.every((stake) => stake.status !== "active")) {
    const winner = game.score.player === game.score.opponent ? "draw" :
      game.score.player > game.score.opponent ? "player" : "opponent";
    settlePatolli(winner, winner === "draw"
      ? "All six wagers resolve evenly. The match is a draw, so your penalty contributions return."
      : winner === "player"
        ? "You lead when no more pieces can play and win the match."
        : "Ixchel leads when no more pieces can play. Unresolved stakes are returned to you.");
    return true;
  }
  return false;
}

function applyPatolliMove(game, side, move) {
  const piece = game.pieces[side][move.pieceId];
  const otherSide = side === "player" ? "opponent" : "player";
  const previousTrackIndex = piece.status === "active"
    ? patolliTrackIndex(side, piece.progress) : null;
  piece.progress = move.progress;
  piece.status = move.finish ? "finished" : "active";
  state.patolliAnimation = {
    side,
    pieceId: piece.id,
    from: previousTrackIndex,
    to: move.trackIndex,
    capture: move.captureId !== null,
    captureId: move.captureId
  };
  let message = side === "player"
    ? `Your piece ${piece.id + 1} moves ${move.finish ? "home" : `to square ${patolliSquareNumber(move.trackIndex)}`}.`
    : `Ixchel's piece ${piece.id + 1} moves ${move.finish ? "home" : `to square ${patolliSquareNumber(move.trackIndex)}`}.`;
  if (move.captureId !== null) {
    const captured = game.pieces[otherSide][move.captureId];
    captured.status = "captured";
    if (!game.captures) game.captures = { player: 0, opponent: 0 };
    game.captures[side] += 1;
    const resolved = resolvePatolliStake(game, captured.id, side, piece);
    captured.status = "settled";
    captured.progress = -1;
    if (resolved) message += ` It captures piece ${captured.id + 1} at a crossroads, returning it to reserve and claiming its matched wager.`;
  }
  if (!move.finish && PATOLLI_EXTRA_TURN_SQUARES.includes(move.trackIndex)) {
    message += " The rounded end square grants another turn.";
  }
  if (move.finish) {
    resolvePatolliStake(game, piece.id, side, piece);
  } else if (PATOLLI_PENALTY_SQUARES.includes(move.trackIndex)) {
    const stake = game.stakes[piece.id];
    const payerKey = side === "player" ? "playerStake" : "opponentStake";
    const payment = Math.min(game.stakePerPiece, stake[payerKey]);
    stake[payerKey] -= payment;
    game.pot += payment;
    if (side === "player") game.playerPotContribution += payment;
    if (payment) {
      message += ` The penalty triangle sends ${formatCurrency(payment)} from this wager to the pot.`;
    } else {
      // Nothing left to pay: the piece is knocked off the board and its wager goes to the other player.
      piece.status = "captured";
      resolvePatolliStake(game, piece.id, otherSide, null);
      message += side === "player"
        ? " Its wager is already spent, so the piece leaves the board and Ixchel claims the wager."
        : " Its wager is already spent, so the piece leaves the board and you claim the wager.";
    }
  }
  game.message = message;
  game.selectedPiece = null;
  game.legalMoves = [];
  game.phase = "roll";
  return message;
}

// ---------- Ixchel's play ----------
// "Gently" is the old greedy player. "Seriously" looks two moves ahead: for each of her
// moves it weighs every bean toss you could make in reply (and her own extra turns),
// using the real bean odds, and scores the results with a positional evaluation that
// understands racing, exposure on the crossroads, threats, penalties, and the wager count.
const PATOLLI_TOSS_ODDS = [1, 5, 10, 10, 5, 1].map((ways) => ways / 32);

function patolliOtherSide(side) {
  return side === "player" ? "opponent" : "player";
}

function patolliSimulate(game, side, move) {
  const animation = state.patolliAnimation;
  const copy = JSON.parse(JSON.stringify(game));
  applyPatolliMove(copy, side, move);
  state.patolliAnimation = animation;
  return copy;
}

function patolliExtraTurn(move) {
  return !move.finish && PATOLLI_EXTRA_TURN_SQUARES.includes(move.trackIndex);
}

// The chance that `attacker` can land exactly on `trackIndex` with its next toss.
function patolliHitChance(game, attacker, trackIndex) {
  const tosses = new Set();
  for (const piece of game.pieces[attacker]) {
    if (piece.status !== "active") continue;
    const distance = (trackIndex - patolliPieceAt(attacker, piece) + PATOLLI_TRACK.length) % PATOLLI_TRACK.length;
    if (!distance || piece.progress + distance > PATOLLI_TRACK.length) continue;
    for (let count = 1; count <= 5; count += 1) {
      if (patolliMoveDistance(count) === distance) tosses.add(count);
    }
  }
  let chance = 0;
  for (const count of tosses) chance += PATOLLI_TOSS_ODDS[count];
  return chance;
}

function patolliEvaluate(game, side) {
  const other = patolliOtherSide(side);
  if (game.score[side] >= 4) return 1e6;
  if (game.score[other] >= 4) return -1e6;
  const halfStake = Math.max(1, game.stakePerPiece);
  const sideValue = (me, them) => {
    let value = game.score[me] * 1000;
    for (const piece of game.pieces[me]) {
      const stake = game.stakes[piece.id];
      if (stake.status !== "active") continue;
      const myStake = me === "player" ? stake.playerStake : stake.opponentStake;
      // A spent wager is one penalty away from being lost outright.
      value += myStake >= halfStake ? 0 : -260;
      if (piece.status === "ready") {
        value += 20;
        continue;
      }
      if (piece.status !== "active") continue;
      const at = patolliPieceAt(me, piece);
      value += 60 + piece.progress * 9;
      if (piece.progress >= PATOLLI_TRACK.length - 10) value += 60 + (piece.progress - (PATOLLI_TRACK.length - 10)) * 12;
      if (PATOLLI_CAPTURE_SQUARES.includes(at)) {
        value -= patolliHitChance(game, them, at) * (1000 + piece.progress * 9);
      }
      // Standing just before a penalty triangle is mildly risky.
      for (let step = 1; step <= 4; step += 1) {
        if (PATOLLI_PENALTY_SQUARES.includes((at + step) % PATOLLI_TRACK.length)) value -= 8;
      }
    }
    return value;
  };
  let value = sideValue(side, other) - sideValue(other, side);
  // Threats: opposing pieces sitting on crossroads within our reach.
  for (const piece of game.pieces[other]) {
    if (piece.status !== "active") continue;
    const at = patolliPieceAt(other, piece);
    if (PATOLLI_CAPTURE_SQUARES.includes(at)) value += patolliHitChance(game, side, at) * 450;
  }
    return value;
}

function patolliGreedyScore(game, side, move) {
  const other = patolliOtherSide(side);
  let score = move.finish ? 10000 : move.progress * 4;
  if (move.captureId !== null) score += 5000;
  if (move.trackIndex >= 0 && PATOLLI_PENALTY_SQUARES.includes(move.trackIndex)) score -= 80;
  if (move.trackIndex >= 0 && PATOLLI_CAPTURE_SQUARES.includes(move.trackIndex)) {
    for (const enemy of game.pieces[other].filter((piece) => piece.status === "active")) {
      const distance = (move.trackIndex - patolliPieceAt(other, enemy) + PATOLLI_TRACK.length) % PATOLLI_TRACK.length;
      if (distance >= 1 && distance <= 5) score -= 60;
    }
  }
  return score;
}

// Best one-move result for `side` after a given toss, judged by its own evaluation.
function patolliBestAfterToss(game, side, count) {
  const moves = count ? getPatolliLegalMoves(game, side, count) : [];
  if (!moves.length) return game;
  let best = null;
  let bestValue = -Infinity;
  for (const move of moves) {
    const result = patolliSimulate(game, side, move);
    const value = patolliEvaluate(result, side);
    if (value > bestValue) {
      bestValue = value;
      best = result;
    }
  }
  return best;
}

function patolliExpectedValue(afterMove, side, extraTurn) {
  if (afterMove.score[side] >= 4 || afterMove.score[patolliOtherSide(side)] >= 4) return patolliEvaluate(afterMove, side);
  const mover = extraTurn ? side : patolliOtherSide(side);
  let expected = 0;
  for (let count = 0; count <= 5; count += 1) {
    const reply = patolliBestAfterToss(afterMove, mover, count);
    expected += PATOLLI_TOSS_ODDS[count] * patolliEvaluate(reply, side);
  }
  return expected;
}

function choosePatolliMove(game, side, moves, level = "sharp") {
  if (!moves.length) return null;
  if (level === "gentle") {
    const ranked = [...moves].sort((first, second) => patolliGreedyScore(game, side, second) - patolliGreedyScore(game, side, first));
    // A gentle Ixchel sometimes plays her second-best move.
    return ranked.length > 1 && randomInt(4) === 1 ? ranked[1] : ranked[0];
  }
  let best = moves[0];
  let bestValue = -Infinity;
  for (const move of moves) {
    const result = patolliSimulate(game, side, move);
    const value = patolliExpectedValue(result, side, patolliExtraTurn(move)) + (move.finish ? 1 : 0);
    if (value > bestValue) {
      bestValue = value;
      best = move;
    }
  }
  return best;
}

// Kept for callers that pass only the moves: the side to move is whoever's turn it is.
function choosePatolliAiMove(game, moves) {
  const side = game.turn === "opponent" ? "opponent" : "player";
  return choosePatolliMove(game, side, moves, side === "opponent" ? (game.difficulty || "sharp") : "sharp");
}

function runPatolliAiTurn(game) {
  if (game.status !== "active") return;
  while (game.status === "active") {
    game.turn = "opponent";
    const toss = rollPatolliBeans();
    game.lastToss = { side: "opponent", ...toss };
    animatePatolliToss();
    const moves = getPatolliLegalMoves(game, "opponent", toss.count);
    if (!moves.length) {
      game.message = toss.count
        ? `Ixchel tosses ${toss.count === 5 ? "five beans for ten spaces" : `${toss.count} marked beans`} but has no legal move; your turn.`
        : "Ixchel tosses no marked beans and passes; your turn.";
      game.turn = "player";
      game.phase = "roll";
      return;
    }
    const move = choosePatolliMove(game, "opponent", moves, game.difficulty || "sharp");
    applyPatolliMove(game, "opponent", move);
    if (checkPatolliEnd(game)) return;
    if (!PATOLLI_EXTRA_TURN_SQUARES.includes(move.trackIndex)) {
      game.turn = "player";
      game.phase = "roll";
      game.message += " Your turn.";
      return;
    }
  }
}

function selectPatolliPiece(pieceId) {
  const game = state.run.patolliGame;
  if (!game || game.status !== "active" || game.turn !== "player" || game.phase !== "move" ||
    !game.legalMoves.some((move) => move.pieceId === pieceId)) return;
  game.selectedPiece = pieceId;
  game.message = `Piece ${pieceId + 1} selected. Choose one of its highlighted destination squares.`;
  renderPatolli();
}

function moveSelectedPatolliPiece(trackIndex) {
  const game = state.run.patolliGame;
  if (!game || game.status !== "active" || game.turn !== "player" || game.phase !== "move" ||
    !Number.isInteger(game.selectedPiece)) return;
  const move = game.legalMoves.find((candidate) => candidate.pieceId === game.selectedPiece &&
    candidate.trackIndex === trackIndex);
  if (!move) return;
  applyPatolliMove(game, "player", move);
  if (!checkPatolliEnd(game) && !PATOLLI_EXTRA_TURN_SQUARES.includes(move.trackIndex)) runPatolliAiTurn(game);
  renderPatolli();
  if (state.patolliAnimationTimer) clearTimeout(state.patolliAnimationTimer);
  state.patolliAnimationTimer = setTimeout(() => {
    state.patolliAnimation = null;
    state.patolliAnimationTimer = 0;
    if (state.run?.patolliGame?.status === "active") renderPatolli();
  }, 420);
  render();
  saveRun();
}

function animatePatolliToss() {
  state.patolliTossAnimation = true;
  if (state.patolliTossAnimationTimer) clearTimeout(state.patolliTossAnimationTimer);
  state.patolliTossAnimationTimer = setTimeout(() => {
    state.patolliTossAnimation = false;
    state.patolliTossAnimationTimer = 0;
  }, 350);
}

function schedulePatolliAutoplay(delay = 300) {
  if (state.patolliAutoplayTimer) clearTimeout(state.patolliAutoplayTimer);
  state.patolliAutoplayTimer = 0;
  if (!state.patolliAutoplay || !elements["patolli-dialog"].open ||
    state.run.patolliGame?.status !== "active") return;
  state.patolliAutoplayTimer = setTimeout(() => {
    state.patolliAutoplayTimer = 0;
    const game = state.run.patolliGame;
    if (!state.patolliAutoplay || !elements["patolli-dialog"].open || game?.status !== "active") return;
    if (game.turn !== "player") {
      runPatolliAiTurn(game);
      renderPatolli();
      saveRun();
      schedulePatolliAutoplay();
      return;
    }
    if (game.phase === "roll") {
      tossPatolliBeans();
      schedulePatolliAutoplay(game.phase === "move" ? 450 : 300);
      return;
    }
    const move = choosePatolliMove(game, "player", game.legalMoves, "sharp");
    if (!move) {
      game.message = "No legal move is available. The turn passes to Ixchel.";
      game.turn = "opponent";
      runPatolliAiTurn(game);
      renderPatolli();
      render();
      saveRun();
      schedulePatolliAutoplay();
      return;
    }
    selectPatolliPiece(move.pieceId);
    moveSelectedPatolliPiece(move.trackIndex);
    schedulePatolliAutoplay();
  }, delay);
}

function setPatolliAutoplay(enabled) {
  state.patolliAutoplay = Boolean(enabled) && state.run.patolliGame?.status === "active";
  if (state.patolliAutoplayTimer) clearTimeout(state.patolliAutoplayTimer);
  state.patolliAutoplayTimer = 0;
  renderPatolli();
  if (state.patolliAutoplay) schedulePatolliAutoplay(150);
}

function renderPatolli() {
  const game = state.run.patolliGame;
  const active = game?.status === "active";
  if (!active) {
    state.patolliAutoplay = false;
    if (state.patolliAutoplayTimer) clearTimeout(state.patolliAutoplayTimer);
    state.patolliAutoplayTimer = 0;
  }
  const tutorialOnly = state.patolliTutorialOnly && !active;
  const maximumWager = maxPatolliStakePerPiece();
  renderPurses();
  const rulePages = [...elements["patolli-rules"].querySelectorAll("[data-patolli-rule-page]")];
  state.patolliRulesPage = Math.max(0, Math.min(state.patolliRulesPage, rulePages.length - 1));
  rulePages.forEach((page, index) => { page.hidden = index !== state.patolliRulesPage; });
  elements["patolli-rules-page-number"].textContent = `${state.patolliRulesPage + 1} / ${rulePages.length}`;
  elements["patolli-rules-previous"].disabled = state.patolliRulesPage === 0;
  elements["patolli-rules-next"].disabled = state.patolliRulesPage === rulePages.length - 1;
  elements["patolli-rules"].hidden = !state.patolliRulesOpen;
  elements["patolli-rules-toggle"].setAttribute("aria-expanded", String(state.patolliRulesOpen));
  elements["patolli-rules-toggle"].textContent = state.patolliRulesOpen ? "Back to the board" : "Read the rules";
  elements["patolli-dialog"].dataset.patolliActive = String(active);
  elements["patolli-setup"].hidden = active || tutorialOnly || state.patolliRulesOpen;
  elements["patolli-game"].hidden = !active || state.patolliRulesOpen;
  elements["patolli-roll"].hidden = !active;
  elements["patolli-roll"].disabled = !active || state.patolliAutoplay || game.turn !== "player" || game.phase !== "roll";
  elements["patolli-roll"].textContent = active && game.turn === "player" && game.phase === "move"
    ? "Select a piece and destination" : "Toss five beans";
  elements["patolli-autoplay"].checked = state.patolliAutoplay && active;
  elements["patolli-autoplay"].disabled = !active;
  elements["patolli-forfeit"].hidden = !active;
  elements["patolli-close"].hidden = active;
  elements["patolli-tutorial-start"].hidden = !tutorialOnly || !state.patolliRulesOpen;
  elements["patolli-wager"].max = String(maximumWager);
  elements["patolli-start"].disabled = maximumWager < 1;
  elements["patolli-wager-note"].textContent = maximumWager
    ? `You may stake ${formatCurrency(maximumWager)} per piece (${formatCurrency(maximumWager * 6)} total). Stakes come from your Ceiba House strongbox.`
    : "You need enough gold for six matched stakes and room for the maximum possible payout.";
  if (maximumWager > 0 && Number(elements["patolli-wager"].value) > maximumWager) {
    elements["patolli-wager"].value = String(maximumWager);
  }
  const previewStake = Math.max(1, Math.min(maximumWager || 1, Number(elements["patolli-wager"].value) || 1));
  elements["patolli-stakes"].textContent = `Six numbered pieces · ${formatCurrency(previewStake)} each · ${formatCurrency(previewStake * 6)} from you, matched by Ixchel.`;
  elements["patolli-last-result"].hidden = !game || active || tutorialOnly;
  if (game && !active && !tutorialOnly) elements["patolli-last-result"].textContent = game.message;
  if (!game || !active) return;

  elements["patolli-status"].textContent = game.message;
  const scorePlayer = document.createElement("span");
  scorePlayer.className = "patolli-score-side patolli-score-player";
  scorePlayer.textContent = `● You ${game.score.player}`;
  const scoreOpponent = document.createElement("span");
  scoreOpponent.className = "patolli-score-side patolli-score-opponent";
  scoreOpponent.textContent = `● Ixchel ${game.score.opponent}`;
  elements["patolli-score"].replaceChildren(scorePlayer, scoreOpponent);
  elements["patolli-score"].setAttribute("aria-label", `Wagers won. You ${game.score.player}, Ixchel ${game.score.opponent}.`);
  const capturesByPlayer = game.captures?.player || 0;
  const capturesByOpponent = game.captures?.opponent || 0;
  const liveWagers = game.stakes.filter((stake) => stake.status === "active").length;
  const tiedGold = game.stakes.reduce((total, stake) => total + stake.playerStake + stake.opponentStake, 0);
  const statRows = [
    ["🏆", "Wagers", `${game.score.player} · ${game.score.opponent}`],
    ["⚔", "Captures", `You ${capturesByPlayer} · Ixchel ${capturesByOpponent}`],
    ["◈", "Live wagers", `${liveWagers} · ${formatCurrency(tiedGold)}`],
    ["●", "Pot", formatCurrency(game.pot)]
  ];
  elements["patolli-match-stats"].replaceChildren(...statRows.map(([icon, label, value]) => {
    const row = document.createElement("div");
    row.className = "patolli-stat-row";
    const symbol = document.createElement("span");
    symbol.className = "patolli-stat-icon";
    symbol.setAttribute("aria-hidden", "true");
    symbol.textContent = icon;
    const name = document.createElement("span");
    name.className = "patolli-stat-label";
    name.textContent = label;
    const amount = document.createElement("strong");
    amount.className = "patolli-stat-value";
    amount.textContent = value;
    row.append(symbol, name, amount);
    return row;
  }));
  elements["patolli-match-stats"].classList.toggle("patolli-capture-flash", Boolean(state.patolliAnimation?.capture));
  const legalTargets = new Set(game.legalMoves
    .filter((move) => move.pieceId === game.selectedPiece)
    .map((move) => move.trackIndex));
  const selectablePiecesByTrackIndex = new Map();
  if (!state.patolliAutoplay && game.turn === "player" && game.phase === "move") {
    for (const piece of game.pieces.player) {
      if (piece.status === "active" && game.legalMoves.some((move) => move.pieceId === piece.id)) {
        selectablePiecesByTrackIndex.set(patolliPieceAt("player", piece), piece.id);
      }
    }
  }
  const fragment = document.createDocumentFragment();
  for (const [pathIndex, [row, column]] of PATOLLI_TRACK.entries()) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "patolli-square";
    const armEnd = pathIndex % 13 === 6 || pathIndex % 13 === 7;
    if (armEnd) cell.classList.add("patolli-arm-end", pathIndex % 13 === 6 ? "patolli-arm-end-a" : "patolli-arm-end-b");
    cell.dataset.arm = String(Math.floor(pathIndex / 13));
    if (PATOLLI_CAPTURE_SQUARES.includes(pathIndex)) cell.classList.add("patolli-crossroads");
    if (PATOLLI_PENALTY_SQUARES.includes(pathIndex)) cell.classList.add("patolli-penalty");
    if (PATOLLI_EXTRA_TURN_SQUARES.includes(pathIndex)) cell.classList.add("patolli-extra-turn");
    if (pathIndex === PATOLLI_PLAYER_START) cell.classList.add("patolli-player-start");
    if (pathIndex === PATOLLI_OPPONENT_START) cell.classList.add("patolli-opponent-start");
    if (state.patolliAnimation?.from === pathIndex) cell.classList.add("patolli-move-origin");
    if (state.patolliAnimation?.to === pathIndex) cell.classList.add("patolli-move-destination");
    if (legalTargets.has(pathIndex)) cell.classList.add("patolli-legal-target");
    const selectablePiece = selectablePiecesByTrackIndex.get(pathIndex);
    if (selectablePiece !== undefined) {
      cell.classList.add("patolli-piece-selectable");
      cell.dataset.patolliPiece = String(selectablePiece);
    }
    cell.disabled = state.patolliAutoplay ||
      (!legalTargets.has(pathIndex) && selectablePiece === undefined);
    cell.dataset.trackIndex = String(pathIndex);
    cell.setAttribute("aria-label", selectablePiece !== undefined
      ? `Your piece ${selectablePiece + 1} on square ${patolliSquareNumber(pathIndex)}; select to move`
      : `Square ${patolliSquareNumber(pathIndex)}${PATOLLI_CAPTURE_SQUARES.includes(pathIndex) ? ", capture crossroads" : ""}${PATOLLI_PENALTY_SQUARES.includes(pathIndex) ? ", penalty triangle" : ""}${PATOLLI_EXTRA_TURN_SQUARES.includes(pathIndex) ? ", extra turn" : ""}`);
    const number = document.createElement("small");
    number.textContent = String(patolliSquareNumber(pathIndex));
    const arrow = document.createElement("i");
    arrow.className = "patolli-direction";
    arrow.setAttribute("aria-hidden", "true");
    arrow.style.setProperty("--step", `${patolliStepAngle(pathIndex)}deg`);
    cell.append(number, arrow);
    if (pathIndex === PATOLLI_PLAYER_START || pathIndex === PATOLLI_OPPONENT_START) {
      const flag = document.createElement("b");
      flag.className = "patolli-start-flag";
      flag.textContent = "START";
      cell.append(flag);
    }
    for (const side of ["player", "opponent"]) {
      for (const piece of game.pieces[side]) {
        if (patolliPieceAt(side, piece) !== pathIndex) continue;
        const marker = document.createElement("span");
        marker.className = `patolli-piece-marker ${side === "player" ? "patolli-player-token" : "patolli-opponent-token"}`;
        if (state.patolliAnimation?.to === pathIndex && state.patolliAnimation.side === side &&
          state.patolliAnimation.pieceId === piece.id) marker.classList.add("patolli-piece-arrival");
        marker.textContent = String(piece.id + 1);
        marker.title = `${side === "player" ? "Your" : "Ixchel's"} piece ${piece.id + 1}`;
        cell.append(marker);
      }
    }
    cell.style.gridRow = String(row + 1);
    cell.style.gridColumn = String(column + 1);
    fragment.append(cell);
  }
  const finishReady = legalTargets.has(-1);
  const home = document.createElement(finishReady ? "button" : "span");
  home.className = `patolli-home${finishReady ? " patolli-legal-target" : ""}`;
  if (finishReady) {
    home.type = "button";
    home.dataset.trackIndex = "-1";
    home.setAttribute("aria-label", "Exact finish: move this piece home");
  }
  home.textContent = "HOME";
  home.style.gridRow = "4 / span 3";
  home.style.gridColumn = "4 / span 3";
  fragment.append(home);
  elements["patolli-board"].replaceChildren(fragment);
  elements["patolli-beans"].replaceChildren(...Array.from({ length: 5 }, (_, index) => {
    const bean = document.createElement("span");
    const marked = game.lastToss?.beans[index];
    bean.className = `patolli-bean${marked ? " is-marked" : ""}`;
    if (state.patolliTossAnimation) bean.classList.add("patolli-bean-tossed");
    bean.textContent = marked ? "●" : "○";
    bean.setAttribute("aria-label", marked ? "Marked bean" : "Unmarked bean");
    return bean;
  }));
  const pieces = document.createDocumentFragment();
  for (const side of ["player", "opponent"]) {
    const group = document.createElement("div");
    group.className = `patolli-piece-side patolli-piece-side-${side}`;
    const heading = document.createElement("strong");
    heading.textContent = side === "player" ? "Your pieces" : "Ixchel's pieces";
    group.append(heading);
    const row = document.createElement("div");
    row.className = "patolli-piece-row";
    for (const piece of game.pieces[side]) {
      const canMove = !state.patolliAutoplay && side === "player" && game.turn === "player" && game.phase === "move" &&
        game.legalMoves.some((move) => move.pieceId === piece.id);
      const chip = document.createElement(side === "player" ? "button" : "span");
      if (side === "player") {
        chip.type = "button";
        chip.dataset.patolliPiece = String(piece.id);
        chip.disabled = !canMove;
        chip.setAttribute("aria-pressed", String(game.selectedPiece === piece.id));
      }
      chip.className = `patolli-piece-chip ${side === "player" ? "patolli-piece-chip-player" : "patolli-piece-chip-opponent"}`;
      const status = piece.status === "ready" ? "in reserve" : piece.status === "active"
        ? `square ${patolliSquareNumber(patolliPieceAt(side, piece))}` : piece.status === "finished" ? "home"
          : piece.status === "captured" ? "captured"
            : piece.status === "settled" && game.stakes[piece.id].winner !== null
              ? "reserve · wager settled" : "wager settled";
      const wagerStatus = game.stakes[piece.id].status === "active"
        ? `matched wager ${formatCurrency(game.stakePerPiece)}`
        : "matched wager settled";
      chip.textContent = `${piece.id + 1} · ${status}`;
      chip.dataset.pieceNumber = String(piece.id + 1);
      chip.setAttribute("aria-label", `${side === "player" ? "Your" : "Ixchel's"} piece ${piece.id + 1}, ${status}; ${wagerStatus}`);
      chip.title = `${side === "player" ? "Your" : "Ixchel's"} piece ${piece.id + 1}, ${status}; ${wagerStatus}`;
      row.append(chip);
    }
    group.append(row);
    pieces.append(group);
  }
  elements["patolli-piece-choices"].replaceChildren(pieces);
}

function openPatolli(tutorialOnly = false) {
  if (state.run.location !== "city") return;
  if (["sharp", "gentle"].includes(state.run.patolliGame?.difficulty)) {
    elements["patolli-difficulty"].value = state.run.patolliGame.difficulty;
  }
  state.patolliTutorialOnly = tutorialOnly;
  state.patolliRulesOpen = tutorialOnly;
  state.patolliRulesPage = 0;
  renderPatolli();
  elements["patolli-dialog"].showModal();
  if (state.patolliAutoplay && state.run.patolliGame?.status === "active") schedulePatolliAutoplay();
  if (state.run.patolliGame?.status === "active") elements["patolli-roll"].focus({ preventScroll: true });
  else if (tutorialOnly) elements["patolli-tutorial-start"].focus({ preventScroll: true });
  else elements["patolli-wager"].focus({ preventScroll: true });
  elements["patolli-dialog"].scrollTop = 0;
}

function startPatolli(stakePerPiece) {
  const maximumWager = maxPatolliStakePerPiece();
  if (!Number.isInteger(stakePerPiece) || stakePerPiece < 1 || stakePerPiece > maximumWager) {
    showToast(`Choose a whole-gold stake per piece from 1 to ${maximumWager} gp.`);
    renderPatolli();
    return;
  }
  const totalStake = stakePerPiece * 6;
  state.patolliRulesOpen = false;
  state.run.gold = roundGold(state.run.gold - totalStake);
  const pieces = () => Array.from({ length: 6 }, (_, id) => ({ id, progress: -1, status: "ready" }));
  state.run.patolliGame = {
    trackVersion: PATOLLI_TRACK_VERSION,
    difficulty: elements["patolli-difficulty"].value === "gentle" ? "gentle" : "sharp",
    stakePerPiece,
    pieces: { player: pieces(), opponent: pieces() },
    stakes: Array.from({ length: 6 }, () => ({
      status: "active",
      winner: null,
      playerStake: stakePerPiece,
      opponentStake: stakePerPiece
    })),
    score: { player: 0, opponent: 0 },
    captures: { player: 0, opponent: 0 },
    turn: "player",
    phase: "roll",
    status: "active",
    lastToss: null,
    legalMoves: [],
    selectedPiece: null,
    pot: 0,
    playerPotContribution: 0,
    payout: 0,
    settled: false,
    message: `You stake ${formatCurrency(totalStake)} across six matched piece wagers. Toss five beans to begin.`
  };
  state.patolliTutorialOnly = false;
  render();
  renderPatolli();
  saveRun();
}

function tossPatolliBeans() {
  const game = state.run.patolliGame;
  if (!game || game.status !== "active" || game.turn !== "player" || game.phase !== "roll") return;
  const toss = rollPatolliBeans();
  animatePatolliToss();
  game.lastToss = { side: "player", ...toss };
  game.legalMoves = getPatolliLegalMoves(game, "player", toss.count);
  game.selectedPiece = null;
  if (!game.legalMoves.length) {
    game.message = toss.count
      ? `You toss ${toss.count} marked beans but have no legal move. Ixchel takes a turn.`
      : "You toss no marked beans and pass. Ixchel takes a turn.";
    runPatolliAiTurn(game);
  } else {
    game.turn = "player";
    game.phase = "move";
    game.message = toss.count === 5
      ? "You toss five marked beans, which move ten spaces. Select a legal piece and destination."
      : `You toss ${toss.count} marked bean${toss.count === 1 ? "" : "s"}. Select a legal piece and destination.`;
  }
  renderPatolli();
  saveRun();
}

function forfeitPatolli() {
  const game = state.run.patolliGame;
  if (!game || game.status !== "active") return;
  if (!settlePatolli("opponent", "You leave the board and forfeit all unresolved wagers.", true)) return;
  setPatolliAutoplay(false);
  state.patolliTutorialOnly = false;
  render();
  renderPatolli();
  saveRun();
}

function connectPatolliEvents() {
  elements["patolli-setup"].addEventListener("submit", (event) => {
    event.preventDefault();
    startPatolli(Number(elements["patolli-wager"].value));
  });
  elements["patolli-wager"].addEventListener("input", renderPatolli);
  elements["patolli-setup"].addEventListener("click", (event) => {
    const step = event.target.closest("[data-patolli-wager-step]")?.dataset.patolliWagerStep;
    if (!step) return;
    const maximum = Math.max(1, maxPatolliStakePerPiece());
    const current = Math.max(1, Math.floor(Number(elements["patolli-wager"].value) || 1));
    const next = step === "max" ? maximum : current + Number(step);
    elements["patolli-wager"].value = String(Math.max(1, Math.min(maximum, next)));
    renderPatolli();
  });
  elements["patolli-roll"].addEventListener("click", tossPatolliBeans);
  elements["patolli-autoplay"].addEventListener("change", (event) => {
    setPatolliAutoplay(event.currentTarget.checked);
  });
  elements["patolli-forfeit"].addEventListener("click", forfeitPatolli);
  elements["patolli-tutorial-start"].addEventListener("click", () => {
    state.patolliTutorialOnly = false;
    state.patolliRulesOpen = false;
    renderPatolli();
    elements["patolli-wager"].focus();
  });
  elements["patolli-rules-toggle"].addEventListener("click", () => {
    state.patolliRulesOpen = !state.patolliRulesOpen;
    renderPatolli();
  });
  elements["patolli-rules-previous"].addEventListener("click", () => {
    state.patolliRulesPage -= 1;
    renderPatolli();
  });
  elements["patolli-rules-next"].addEventListener("click", () => {
    state.patolliRulesPage += 1;
    renderPatolli();
  });
  elements["patolli-board"].addEventListener("click", (event) => {
    const square = event.target.closest("[data-track-index]");
    if (!square) return;
    if (square.classList.contains("patolli-piece-selectable")) {
      selectPatolliPiece(Number(square.dataset.patolliPiece));
      return;
    }
    moveSelectedPatolliPiece(Number(square.dataset.trackIndex));
  });
  elements["patolli-piece-choices"].addEventListener("click", (event) => {
    const piece = event.target.closest("[data-patolli-piece]");
    if (piece) selectPatolliPiece(Number(piece.dataset.patolliPiece));
  });
  elements["patolli-close"].addEventListener("click", () => elements["patolli-dialog"].close());
  elements["patolli-dialog"].addEventListener("close", () => {
    setPatolliAutoplay(false);
    state.patolliTutorialOnly = false;
    state.patolliRulesOpen = false;
  });
  elements["patolli-dialog"].addEventListener("cancel", (event) => {
    if (state.run?.patolliGame?.status === "active") event.preventDefault();
  });
  elements["patolli-dialog"].addEventListener("click", (event) => {
    if (event.target === elements["patolli-dialog"] && state.run?.patolliGame?.status === "active") {
      event.preventDefault();
    } else if (event.target === elements["patolli-dialog"]) {
      elements["patolli-dialog"].close();
    }
  });
}
