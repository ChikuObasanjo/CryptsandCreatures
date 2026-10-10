"use strict";

const PATOLLI_TRACK = [
  [5, 0], [6, 0], [7, 0], [8, 0], [8, 1], [7, 1], [7, 2], [7, 3],
  [7, 4], [8, 4], [9, 4], [9, 5], [10, 5], [11, 5], [12, 5],
  [12, 6], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7], [8, 8], [8, 9],
  [7, 9], [7, 10], [7, 11], [7, 12], [6, 12], [5, 12], [4, 12], [4, 11],
  [5, 11], [5, 10], [5, 9], [5, 8], [4, 8], [4, 7], [3, 7], [2, 7],
  [1, 7], [0, 7], [0, 6], [0, 5], [1, 5], [2, 5], [3, 5], [4, 5],
  [4, 4], [4, 3], [5, 3], [5, 2], [5, 1]
];
const PATOLLI_CAPTURE_SQUARES = [11, 20, 35, 46];
const PATOLLI_PENALTY_SQUARES = [5, 31];
const PATOLLI_EXTRA_TURN_SQUARES = [0, 26];
const PATOLLI_PLAYER_START = 0;
const PATOLLI_OPPONENT_START = 26;
if (PATOLLI_TRACK.length !== 52 || new Set(PATOLLI_TRACK.map(([row, column]) => `${row},${column}`)).size !== 52 ||
  PATOLLI_TRACK.some(([row, column], index) => {
    const [nextRow, nextColumn] = PATOLLI_TRACK[(index + 1) % PATOLLI_TRACK.length];
    return row < 0 || row >= 13 || column < 0 || column >= 13 ||
      Math.abs(row - nextRow) + Math.abs(column - nextColumn) !== 1;
  })) throw new Error("The Patolli circuit must be a connected 52-square track.");

function maxPatolliStakePerPiece() {
  const capacity = getCarryCapacity(state.run.character);
  const carriedWithoutGold = getCarriedWeight() - state.run.gold / 50;
  const maximumGold = Math.floor(Math.max(0, capacity - carriedWithoutGold) * 50);
  return Math.max(0, Math.min(
    Math.floor(state.run.gold / 6),
    Math.floor(Math.max(0, maximumGold - state.run.gold) / 6),
    Math.floor(Math.max(0, 10000 - state.run.gold) / 6)
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
    ? `Your piece ${piece.id + 1} moves ${move.finish ? "home" : `to square ${move.trackIndex + 1}`}.`
    : `Ixchel's piece ${piece.id + 1} moves ${move.finish ? "home" : `to square ${move.trackIndex + 1}`}.`;
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
    message += " The marked end square grants another turn.";
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
    message += payment
      ? ` The penalty square sends ${formatCurrency(payment)} from this wager to the pot.`
      : " Unable to pay the penalty, this piece forfeits its wager.";
    if (payment < game.stakePerPiece) {
      piece.status = "captured";
      resolvePatolliStake(game, piece.id, otherSide, null);
    }
  }
  game.message = message;
  game.selectedPiece = null;
  game.legalMoves = [];
  game.phase = "roll";
  return message;
}

function choosePatolliAiMove(game, moves) {
  return [...moves].sort((first, second) => {
    const scoreMove = (move) => {
      let score = move.finish ? 10000 : move.progress * 4;
      if (move.captureId !== null) score += 5000;
      if (move.trackIndex >= 0 && PATOLLI_PENALTY_SQUARES.includes(move.trackIndex)) score -= 80;
      if (move.trackIndex >= 0) {
        for (const enemy of game.pieces.player.filter((piece) => piece.status === "active")) {
          const distance = (move.trackIndex - patolliPieceAt("player", enemy) + PATOLLI_TRACK.length) % PATOLLI_TRACK.length;
          if (PATOLLI_CAPTURE_SQUARES.includes(move.trackIndex) && distance >= 1 && distance <= 5) score -= 60;
        }
      }
      return score;
    };
    return scoreMove(second) - scoreMove(first);
  })[0];
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
    const move = choosePatolliAiMove(game, moves);
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
    const move = choosePatolliAiMove(game, game.legalMoves);
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
    ? `You may stake ${formatCurrency(maximumWager)} per piece (${formatCurrency(maximumWager * 6)} total). The purse and maximum payout both fit your carrying capacity.`
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
  const pathIndexByCoord = new Map(PATOLLI_TRACK.map(([row, column], index) => [`${row},${column}`, index]));
  const legalTargets = new Set(game.legalMoves
    .filter((move) => move.pieceId === game.selectedPiece)
    .map((move) => move.trackIndex));
  const fragment = document.createDocumentFragment();
  for (let row = 0; row < 13; row += 1) {
    for (let column = 0; column < 13; column += 1) {
      const pathIndex = pathIndexByCoord.get(`${row},${column}`);
      const central = row >= 5 && row <= 7 && column >= 5 && column <= 7;
      let cell;
      if (pathIndex !== undefined) {
        cell = document.createElement("button");
        cell.type = "button";
        cell.className = "patolli-square";
        if (PATOLLI_CAPTURE_SQUARES.includes(pathIndex)) cell.classList.add("patolli-crossroads");
        if (PATOLLI_PENALTY_SQUARES.includes(pathIndex)) cell.classList.add("patolli-penalty");
        if (PATOLLI_EXTRA_TURN_SQUARES.includes(pathIndex)) cell.classList.add("patolli-extra-turn");
        if (pathIndex === PATOLLI_PLAYER_START) cell.classList.add("patolli-player-start");
        if (pathIndex === PATOLLI_OPPONENT_START) cell.classList.add("patolli-opponent-start");
        if (state.patolliAnimation?.from === pathIndex) cell.classList.add("patolli-move-origin");
        if (state.patolliAnimation?.to === pathIndex) cell.classList.add("patolli-move-destination");
        if (legalTargets.has(pathIndex)) cell.classList.add("patolli-legal-target");
        cell.disabled = state.patolliAutoplay || !legalTargets.has(pathIndex);
        cell.dataset.trackIndex = String(pathIndex);
        cell.setAttribute("aria-label", `Square ${pathIndex + 1}${PATOLLI_CAPTURE_SQUARES.includes(pathIndex) ? ", capture crossroads" : ""}${PATOLLI_PENALTY_SQUARES.includes(pathIndex) ? ", penalty triangle" : ""}${PATOLLI_EXTRA_TURN_SQUARES.includes(pathIndex) ? ", extra turn" : ""}`);
        const number = document.createElement("small");
        number.textContent = String(pathIndex + 1);
        cell.append(number);
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
      } else if (central) {
        const finishButton = row === 6 && column === 6 && legalTargets.has(-1);
        cell = document.createElement(finishButton ? "button" : "span");
        if (finishButton) {
          cell.type = "button";
          cell.dataset.trackIndex = "-1";
          cell.setAttribute("aria-label", "Exact finish");
        }
        cell.className = `patolli-center-cell${row === 6 && column === 6 ? " patolli-home" : ""}`;
        cell.textContent = row === 6 && column === 6 ? "HOME" : "·";
        if (finishButton) cell.classList.add("patolli-legal-target");
      } else {
        cell = document.createElement("span");
        cell.className = "patolli-empty-cell";
      }
      cell.style.gridRow = String(row + 1);
      cell.style.gridColumn = String(column + 1);
      fragment.append(cell);
    }
  }
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
        ? `square ${patolliPieceAt(side, piece) + 1}` : piece.status === "finished" ? "home"
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
  state.run.gold -= totalStake;
  const pieces = () => Array.from({ length: 6 }, (_, id) => ({ id, progress: -1, status: "ready" }));
  state.run.patolliGame = {
    trackVersion: 3,
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
    if (square) moveSelectedPatolliPiece(Number(square.dataset.trackIndex));
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
