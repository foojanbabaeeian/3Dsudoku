/**
 * Jumbo 3D Sudoku
 * Three 9×9 Sudoku grids on the Top, Right, and Front faces of a cube,
 * displayed in isometric-style via Three.js with an OrthographicCamera.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ─── Constants ────────────────────────────────────────────────────────────────
const N   = 9;   // grid size
const BOX = 3;   // sub-box size
const H   = 4.5; // half of cube side (N/2)
const FACES = 3;

const FACE_NAMES = ['Top', 'Right', 'Front'];

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const wrapEl        = document.getElementById('canvas-wrap');
const timerEl       = document.getElementById('timer');
const statusEl      = document.getElementById('status-bar');
const hintCountEl   = document.getElementById('hint-count');
const notesBtnEl    = document.getElementById('notes-btn');
const loadingOverlay= document.getElementById('loading-overlay');
const winOverlay    = document.getElementById('win-overlay');

// ─── Sudoku Solver / Generator ────────────────────────────────────────────────

function emptyGrid() {
  return Array.from({ length: N }, () => new Int8Array(N));
}

/** Returns true if placing `val` at (r,c) on `board` is valid. */
function isValid(board, r, c, val) {
  for (let i = 0; i < N; i++) {
    if (board[r][i] === val || board[i][c] === val) return false;
  }
  const br = Math.floor(r / BOX) * BOX;
  const bc = Math.floor(c / BOX) * BOX;
  for (let i = 0; i < BOX; i++)
    for (let j = 0; j < BOX; j++)
      if (board[br + i][bc + j] === val) return false;
  return true;
}

/** Find cell with fewest legal values (MRV heuristic). Returns [-1,-1] if done. */
function mrv(board) {
  let bestR = -1, bestC = -1, bestN = 10;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (board[r][c]) continue;
      let cnt = 0;
      for (let v = 1; v <= N; v++) if (isValid(board, r, c, v)) cnt++;
      if (cnt === 0) return [-2, -2]; // dead end
      if (cnt < bestN) { bestN = cnt; bestR = r; bestC = c; }
    }
  }
  return [bestR, bestC];
}

/** Backtracking solver. randomize = shuffle value order (for generation). */
function solve(board, randomize = false) {
  const [r, c] = mrv(board);
  if (r === -2) return false; // dead end
  if (r === -1) return true;  // solved

  const vals = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  if (randomize) vals.sort(() => Math.random() - 0.5);

  for (const v of vals) {
    if (isValid(board, r, c, v)) {
      board[r][c] = v;
      if (solve(board, randomize)) return true;
      board[r][c] = 0;
    }
  }
  return false;
}

/** Count solutions up to `limit` (used for uniqueness check). */
function countSolutions(board, limit = 2) {
  const [r, c] = mrv(board);
  if (r === -2) return 0;
  if (r === -1) return 1;
  let cnt = 0;
  for (let v = 1; v <= N; v++) {
    if (!isValid(board, r, c, v)) continue;
    board[r][c] = v;
    cnt += countSolutions(board, limit - cnt);
    board[r][c] = 0;
    if (cnt >= limit) return cnt;
  }
  return cnt;
}

/** Generate a puzzle with a unique solution. Returns { puzzle, solution }. */
function generatePuzzle(difficulty) {
  const solution = emptyGrid();
  solve(solution, true);

  // Clone solution to puzzle
  const puzzle = solution.map(row => new Int8Array(row));

  const targets = { easy: 42, medium: 32, hard: 26 };
  const target  = targets[difficulty] ?? 32;

  // Shuffle cell positions
  const positions = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      positions.push([r, c]);
  positions.sort(() => Math.random() - 0.5);

  let clues = N * N;
  for (const [r, c] of positions) {
    if (clues <= target) break;
    const backup = puzzle[r][c];
    puzzle[r][c] = 0;
    // Check uniqueness
    const copy = puzzle.map(row => new Int8Array(row));
    if (countSolutions(copy, 2) !== 1) {
      puzzle[r][c] = backup;
    } else {
      clues--;
    }
  }

  return { puzzle, solution };
}

// ─── Three.js Setup ───────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07090f);

// Soft fog for depth
scene.fog = new THREE.FogExp2(0x07090f, 0.018);

// Orthographic camera → true isometric look
const FRUSTUM = 9.5;
let aspect = (wrapEl.clientWidth || 800) / (wrapEl.clientHeight || 600);

const camera = new THREE.OrthographicCamera(
  -FRUSTUM * aspect, FRUSTUM * aspect,
  FRUSTUM, -FRUSTUM,
  0.1, 200
);
camera.position.set(20, 16, 20);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
wrapEl.appendChild(renderer.domElement);

// Orbit controls (pan disabled — just rotate & zoom)
const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.zoomSpeed = 0.6;
controls.rotateSpeed = 0.5;
controls.target.set(0, 0, 0);
controls.update();

// Lights (subtle, for the cube frame)
scene.add(new THREE.AmbientLight(0x4060a0, 1.5));
const sun = new THREE.DirectionalLight(0x7090ff, 0.6);
sun.position.set(12, 20, 12);
scene.add(sun);

// ─── Face / cell geometry helpers ─────────────────────────────────────────────
//
// The cube has side N=9 and is centered at origin.
// Three visible faces (from camera at +x,+y,+z quadrant):
//   Face 0 – TOP   (y = +H): cells on XZ plane, normal +Y
//   Face 1 – RIGHT (x = +H): cells on ZY plane, normal +X
//   Face 2 – FRONT (z = +H): cells on XY plane, normal +Z

const CELL_GAP = 0.96; // slightly smaller than 1 for thin gap between cells

function cellPos(face, r, c) {
  // r = row index (0 = "near" edge of face), c = column index (0 = "left" edge)
  switch (face) {
    case 0: // TOP: rows along Z (front-back), cols along X (left-right)
      return new THREE.Vector3(-H + c + 0.5, H, -H + r + 0.5);
    case 1: // RIGHT: rows along Y (top-bot), cols along Z (front-back reversed)
      return new THREE.Vector3(H, H - r - 0.5, H - c - 0.5);
    case 2: // FRONT: rows along Y (top-bot), cols along X (left-right)
      return new THREE.Vector3(-H + c + 0.5, H - r - 0.5, H);
  }
}

// Euler rotations for PlaneGeometry to face outward on each face
const FACE_ROT = [
  new THREE.Euler(-Math.PI / 2, 0, 0),  // TOP   → face +Y
  new THREE.Euler(0, Math.PI / 2, 0),   // RIGHT → face +X
  new THREE.Euler(0, 0, 0),             // FRONT → face +Z (default)
];

// Tiny z-offset so faces don't z-fight with cube frame
const FACE_NUDGE = [
  new THREE.Vector3(0, 0.002, 0),
  new THREE.Vector3(0.002, 0, 0),
  new THREE.Vector3(0, 0, 0.002),
];

// ─── Cell storage ─────────────────────────────────────────────────────────────
// Flat array indexed by face*81 + r*9 + c
const cellStore = new Array(FACES * N * N).fill(null);
const cellGroup = new THREE.Group();
scene.add(cellGroup);

function ci(face, r, c) { return face * N * N + r * N + c; }

// ─── Canvas texture drawing ───────────────────────────────────────────────────
const TEX_SIZE = 128;

// Colour palette
const P = {
  bgGiven:       '#101828',
  bgUser:        '#090e1c',
  bgSelected:    '#163066',
  bgHighlight:   '#0e1a30',
  bgSameVal:     '#14291e',
  bgError:       '#2c0e10',
  bgErrSel:      '#4a1015',
  bgFaded:       '#070910',

  borderThin:    '#182035',
  borderBox:     '#244070',
  borderOuter:   '#3a6090',
  borderSel:     '#4a90e0',

  numGiven:      '#6a9fe0',
  numUser:       '#d8eeff',
  numUserSel:    '#ffffff',
  numError:      '#ff4855',
  noteColor:     '#3a6880',
};

function drawCell(ctx, cell, state) {
  const { r, c, face } = cell;
  const { value, given, selected, highlighted, sameValue, error, notesSet, faded } = state;
  const S = TEX_SIZE;

  // ── Background ──
  let bg = given ? P.bgGiven : P.bgUser;
  if (faded)           bg = P.bgFaded;
  else if (error && selected) bg = P.bgErrSel;
  else if (error)      bg = P.bgError;
  else if (selected)   bg = P.bgSelected;
  else if (sameValue)  bg = P.bgSameVal;
  else if (highlighted) bg = P.bgHighlight;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);

  // ── Selected glow border ──
  if (selected) {
    ctx.strokeStyle = P.borderSel;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, S - 4, S - 4);
  }

  // ── Box borders (thick lines on box-boundary edges) ──
  ctx.strokeStyle = faded ? '#0e1428' : P.borderBox;
  ctx.lineWidth = 3;
  if (r % BOX === 0) strokeLine(ctx, 0, 1.5, S, 1.5);
  if (c % BOX === 0) strokeLine(ctx, 1.5, 0, 1.5, S);
  if (r === N - 1)   strokeLine(ctx, 0, S - 1.5, S, S - 1.5);
  if (c === N - 1)   strokeLine(ctx, S - 1.5, 0, S - 1.5, S);

  // ── Thin cell borders ──
  ctx.strokeStyle = faded ? '#0a0f1e' : P.borderThin;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, S - 1, S - 1);

  // ── Outer face border (a bit thicker on the very edge cells) ──
  if (!faded) {
    ctx.strokeStyle = P.borderOuter;
    ctx.lineWidth = 2;
    if (r === 0)     strokeLine(ctx, 0, 1, S, 1);
    if (r === N - 1) strokeLine(ctx, 0, S - 1, S, S - 1);
    if (c === 0)     strokeLine(ctx, 1, 0, 1, S);
    if (c === N - 1) strokeLine(ctx, S - 1, 0, S - 1, S);
  }

  // ── Number or pencil marks ──
  if (value) {
    let col = given ? P.numGiven : (selected ? P.numUserSel : P.numUser);
    if (error) col = P.numError;
    ctx.fillStyle = col;
    ctx.font = `bold ${faded ? 50 : 72}px Arial,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = faded ? 0.4 : 1;
    ctx.fillText(value.toString(), S / 2, S / 2 + 2);
    ctx.globalAlpha = 1;
  } else if (notesSet && notesSet.size > 0 && !faded) {
    ctx.fillStyle = P.noteColor;
    ctx.font = '24px Arial,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let v = 1; v <= N; v++) {
      if (!notesSet.has(v)) continue;
      const nr = Math.floor((v - 1) / 3);
      const nc = (v - 1) % 3;
      ctx.fillText(v.toString(), 21 + nc * 43, 21 + nr * 43);
    }
  }
}

function strokeLine(ctx, x1, y1, x2, y2) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

// ─── Build scene cells ────────────────────────────────────────────────────────
const sharedGeo = new THREE.PlaneGeometry(CELL_GAP, CELL_GAP);

function buildCells() {
  while (cellGroup.children.length) cellGroup.remove(cellGroup.children[0]);

  for (let face = 0; face < FACES; face++) {
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = TEX_SIZE;
        const ctx = canvas.getContext('2d');
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;

        const mat  = new THREE.MeshBasicMaterial({ map: texture, side: THREE.FrontSide });
        const mesh = new THREE.Mesh(sharedGeo, mat);

        mesh.position.copy(cellPos(face, r, c)).add(FACE_NUDGE[face]);
        mesh.rotation.copy(FACE_ROT[face]);
        mesh.userData = { face, r, c };

        cellGroup.add(mesh);
        cellStore[ci(face, r, c)] = { face, r, c, mesh, texture, canvas, ctx };
      }
    }
  }

  buildFrame();
}

/** Wireframe edges for the visible corner of the cube. */
function buildFrame() {
  const mat = new THREE.LineBasicMaterial({ color: 0x3a6aaa, linewidth: 1 });

  // Edge pairs: [from, to] in world coords
  const segments = [
    // Top face outline
    [-H, H, -H], [H, H, -H],
    [H, H, -H],  [H, H,  H],
    [H, H,  H],  [-H, H,  H],
    [-H, H,  H],  [-H, H, -H],
    // Vertical down-edges visible from our camera quadrant
    [H, H, -H],  [H, -H, -H],
    [H, H,  H],  [H, -H,  H],
    [-H, H,  H],  [-H, -H,  H],
    // Bottom edges
    [H, -H, -H],  [H, -H,  H],
    [H, -H,  H],  [-H, -H,  H],
  ];

  const pts = [];
  for (let i = 0; i < segments.length; i++) {
    pts.push(new THREE.Vector3(...segments[i]));
  }

  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  scene.add(new THREE.LineSegments(geo, mat));
}

// ─── Game State ───────────────────────────────────────────────────────────────
let givens   = null;  // [3][9][9] Int8Array — puzzle clues (0 = empty)
let solution = null;  // [3][9][9] Int8Array — full solution
let inputs   = null;  // [3][9][9] Int8Array — player entries
let errs     = null;  // [3][9][9] boolean   — error flags
let notesArr = null;  // [3][9][9] Set       — pencil marks

let selected    = null;   // { face, r, c }
let focusFace   = -1;     // -1 = all
let notesMode   = false;
let hintsLeft   = 3;

// Undo stack: array of { face, r, c, oldVal, newVal }
let undoStack   = [];

// Timer
let timerStart  = null;
let timerPaused = false;
let elapsed     = 0;
let timerHandle = null;

// ─── Game Control ─────────────────────────────────────────────────────────────

function showLoading(show) {
  loadingOverlay.classList.toggle('show', show);
}

async function startNewGame(difficulty) {
  showLoading(true);
  // yield to let the overlay paint
  await new Promise(r => setTimeout(r, 30));

  givens   = [];
  solution = [];
  inputs   = [];
  errs     = [];
  notesArr = [];
  undoStack = [];

  for (let f = 0; f < FACES; f++) {
    const { puzzle, solution: sol } = generatePuzzle(difficulty);
    givens.push(puzzle);
    solution.push(sol);
    inputs.push(emptyGrid());
    errs.push(Array.from({ length: N }, () => new Uint8Array(N)));
    notesArr.push(Array.from({ length: N }, () =>
      Array.from({ length: N }, () => new Set())));
  }

  selected  = null;
  hintsLeft = difficulty === 'easy' ? 5 : difficulty === 'medium' ? 3 : 1;
  hintCountEl.textContent = `${hintsLeft} left`;

  // Reset timer
  clearInterval(timerHandle);
  elapsed    = 0;
  timerStart = Date.now();
  timerPaused = false;
  timerHandle = setInterval(tickTimer, 500);

  refreshAll();
  updateProgress();
  statusEl.textContent = 'Click a cell to begin';
  showLoading(false);
}

function tickTimer() {
  if (timerPaused) return;
  const secs = Math.floor((Date.now() - timerStart) / 1000);
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  timerEl.textContent = `${m}:${s}`;
}

// ─── Cell State Derivation ────────────────────────────────────────────────────

function getCellState(face, r, c) {
  const givenVal = givens  ? givens[face][r][c]  : 0;
  const inputVal = inputs  ? inputs[face][r][c]  : 0;
  const value    = givenVal || inputVal;
  const given    = givenVal !== 0;
  const error    = errs    ? !!errs[face][r][c]  : false;
  const notesSet = notesArr? notesArr[face][r][c] : null;

  const faded = (focusFace !== -1 && focusFace !== face);

  let isSelected  = false;
  let highlighted = false;
  let sameValue   = false;

  if (selected) {
    const { face: sf, r: sr, c: sc } = selected;
    isSelected = (face === sf && r === sr && c === sc);

    if (!isSelected && !faded) {
      const selVal = (givens[sf][sr][sc] || inputs[sf][sr][sc]);

      if (face === sf) {
        const sameRow = r === sr;
        const sameCol = c === sc;
        const sameBox = Math.floor(r / BOX) === Math.floor(sr / BOX) &&
                        Math.floor(c / BOX) === Math.floor(sc / BOX);
        highlighted = sameRow || sameCol || sameBox;
      }

      if (selVal && value === selVal) sameValue = true;
    }
  }

  return { value, given, selected: isSelected, highlighted, sameValue, error, notesSet, faded };
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function refreshAll() {
  for (let face = 0; face < FACES; face++)
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++)
        refreshCell(face, r, c);
}

function refreshCell(face, r, c) {
  const cell = cellStore[ci(face, r, c)];
  if (!cell) return;
  const state = getCellState(face, r, c);
  drawCell(cell.ctx, cell, state);
  cell.texture.needsUpdate = true;
}

/** Smart refresh: only update cells whose visual state changed due to selection. */
function refreshAround(prevSel, nextSel) {
  const dirty = new Set();

  function markRegion(sel) {
    if (!sel) return;
    const { face, r, c } = sel;
    const selVal = givens[face][r][c] || inputs[face][r][c];

    // same row, col, box on same face
    for (let i = 0; i < N; i++) {
      dirty.add(ci(face, r, i));
      dirty.add(ci(face, i, c));
    }
    const br = Math.floor(r / BOX) * BOX;
    const bc = Math.floor(c / BOX) * BOX;
    for (let i = 0; i < BOX; i++)
      for (let j = 0; j < BOX; j++)
        dirty.add(ci(face, br + i, bc + j));

    // same-value cells across all faces
    if (selVal) {
      for (let f = 0; f < FACES; f++)
        for (let rr = 0; rr < N; rr++)
          for (let cc = 0; cc < N; cc++)
            if ((givens[f][rr][cc] || inputs[f][rr][cc]) === selVal)
              dirty.add(ci(f, rr, cc));
    }
  }

  markRegion(prevSel);
  markRegion(nextSel);

  for (const idx of dirty) {
    const cell = cellStore[idx];
    if (!cell) continue;
    const state = getCellState(cell.face, cell.r, cell.c);
    drawCell(cell.ctx, cell, state);
    cell.texture.needsUpdate = true;
  }
}

// ─── Error Checking ───────────────────────────────────────────────────────────

function checkErrors(face) {
  const e = errs[face];
  for (let r = 0; r < N; r++) e[r].fill(0);

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const v = givens[face][r][c] || inputs[face][r][c];
      if (!v) continue;

      // Row
      for (let cc = 0; cc < N; cc++) {
        if (cc === c) continue;
        if ((givens[face][r][cc] || inputs[face][r][cc]) === v)
          { e[r][c] = 1; e[r][cc] = 1; }
      }
      // Col
      for (let rr = 0; rr < N; rr++) {
        if (rr === r) continue;
        if ((givens[face][rr][c] || inputs[face][rr][c]) === v)
          { e[r][c] = 1; e[rr][c] = 1; }
      }
      // Box
      const br = Math.floor(r / BOX) * BOX;
      const bc = Math.floor(c / BOX) * BOX;
      for (let i = 0; i < BOX; i++)
        for (let j = 0; j < BOX; j++) {
          const rr = br + i, cc = bc + j;
          if (rr === r && cc === c) continue;
          if ((givens[face][rr][cc] || inputs[face][rr][cc]) === v)
            { e[r][c] = 1; e[rr][cc] = 1; }
        }
    }
  }
}

// ─── Win Check ────────────────────────────────────────────────────────────────

function checkWin() {
  for (let f = 0; f < FACES; f++) {
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const v = givens[f][r][c] || inputs[f][r][c];
        if (!v || errs[f][r][c]) return;
      }
    }
  }
  // Solved!
  clearInterval(timerHandle);
  timerPaused = true;
  const t = timerEl.textContent;
  document.getElementById('win-time').textContent = `Time: ${t}`;
  winOverlay.classList.add('show');
}

// ─── Input Actions ────────────────────────────────────────────────────────────

function enterValue(v) {
  if (!selected || !givens) return;
  const { face, r, c } = selected;
  if (givens[face][r][c]) return; // can't change given

  if (notesMode) {
    const ns = notesArr[face][r][c];
    if (ns.has(v)) ns.delete(v); else ns.add(v);
    refreshCell(face, r, c);
    return;
  }

  const oldVal = inputs[face][r][c];
  if (oldVal === v) return;

  undoStack.push({ face, r, c, oldVal, newVal: v });
  inputs[face][r][c] = v;
  notesArr[face][r][c].clear();
  checkErrors(face);
  refreshAll();
  updateProgress();
  checkWin();
}

function eraseCell() {
  if (!selected || !givens) return;
  const { face, r, c } = selected;
  if (givens[face][r][c]) return;

  const old = inputs[face][r][c];
  undoStack.push({ face, r, c, oldVal: old, newVal: 0, notes: new Set(notesArr[face][r][c]) });
  inputs[face][r][c] = 0;
  notesArr[face][r][c].clear();
  errs[face][r][c] = 0;
  checkErrors(face);
  refreshAll();
  updateProgress();
}

function undoLast() {
  if (!undoStack.length) return;
  const { face, r, c, oldVal, newVal, notes } = undoStack.pop();
  inputs[face][r][c] = oldVal;
  if (notes) notesArr[face][r][c] = notes;
  else notesArr[face][r][c].clear();
  checkErrors(face);
  refreshAll();
  updateProgress();
}

function giveHint() {
  if (!selected || !givens || hintsLeft <= 0) return;
  const { face, r, c } = selected;
  if (givens[face][r][c]) return;
  const ans = solution[face][r][c];
  undoStack.push({ face, r, c, oldVal: inputs[face][r][c], newVal: ans });
  inputs[face][r][c] = ans;
  notesArr[face][r][c].clear();
  hintsLeft--;
  hintCountEl.textContent = hintsLeft > 0 ? `${hintsLeft} left` : 'No hints left';
  checkErrors(face);
  refreshAll();
  updateProgress();
  checkWin();
}

// ─── Progress Display ─────────────────────────────────────────────────────────

function updateProgress() {
  if (!givens) return;
  for (let f = 0; f < FACES; f++) {
    let filled = 0;
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++)
        if (givens[f][r][c] || inputs[f][r][c]) filled++;
    const pct = Math.round((filled / (N * N)) * 100);
    document.getElementById(`prog-${f}`).textContent = `${filled}/${N * N}`;
    document.getElementById(`pbar-${f}`).style.width  = `${pct}%`;
  }
}

// ─── Selection & Navigation ───────────────────────────────────────────────────

function selectCell(face, r, c) {
  const prev = selected;
  selected = { face, r, c };
  if (givens) {
    refreshAround(prev, selected);
    const name = FACE_NAMES[face];
    statusEl.textContent = `${name} face · Row ${r + 1}, Col ${c + 1}`;
  }
  // Highlight active number button
  updateNumButtons();
}

function deselectAll() {
  const prev = selected;
  selected = null;
  refreshAround(prev, null);
  updateNumButtons();
}

function navigate(dr, dc) {
  if (!selected) return;
  const { face, r, c } = selected;
  const nr = Math.max(0, Math.min(N - 1, r + dr));
  const nc = Math.max(0, Math.min(N - 1, c + dc));
  if (nr !== r || nc !== c) selectCell(face, nr, nc);
}

function updateNumButtons() {
  const val = selected && givens
    ? (givens[selected.face][selected.r][selected.c] || inputs[selected.face][selected.r][selected.c])
    : 0;
  document.querySelectorAll('.num-btn').forEach(b => {
    b.classList.toggle('lit', parseInt(b.dataset.n) === val);
  });
}

// ─── Camera Animation ─────────────────────────────────────────────────────────
const CAM_PRESETS = {
  '-1': { pos: new THREE.Vector3(20, 16, 20), up: new THREE.Vector3(0, 1, 0) },
  '0':  { pos: new THREE.Vector3(1, 28,  1),  up: new THREE.Vector3(0, 0, 1) }, // top-down
  '1':  { pos: new THREE.Vector3(28, 1,  1),  up: new THREE.Vector3(0, 1, 0) }, // from right
  '2':  { pos: new THREE.Vector3(1,  1, 28),  up: new THREE.Vector3(0, 1, 0) }, // from front
};

let camAnim = null; // { from, to, upFrom, upTo, t, dur }

function animCamTo(face) {
  const preset = CAM_PRESETS[String(face)];
  if (!preset) return;
  camAnim = {
    from:   camera.position.clone(),
    to:     preset.pos.clone(),
    upFrom: camera.up.clone(),
    upTo:   preset.up.clone(),
    t: 0, dur: 0.55,
  };
}

function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

function updateCamAnim(dt) {
  if (!camAnim) return;
  camAnim.t = Math.min(camAnim.t + dt, camAnim.dur);
  const p = easeInOut(camAnim.t / camAnim.dur);
  camera.position.lerpVectors(camAnim.from, camAnim.to, p);
  camera.up.lerpVectors(camAnim.upFrom, camAnim.upTo, p).normalize();
  camera.lookAt(0, 0, 0);
  controls.update();
  if (camAnim.t >= camAnim.dur) { camAnim = null; controls.update(); }
}

// ─── Raycasting ───────────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const mouse2    = new THREE.Vector2();

renderer.domElement.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  const rect = renderer.domElement.getBoundingClientRect();
  mouse2.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
  mouse2.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse2, camera);
  const meshes = cellStore.filter(Boolean).map(c => c.mesh);
  const hits   = raycaster.intersectObjects(meshes);

  if (hits.length === 0) {
    deselectAll();
    return;
  }
  const { face, r, c } = hits[0].object.userData;
  selectCell(face, r, c);
});

// ─── Keyboard ─────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (!givens) return;
  if (e.key >= '1' && e.key <= '9') { enterValue(parseInt(e.key)); return; }
  switch (e.key) {
    case '0': case 'Delete': case 'Backspace': eraseCell(); break;
    case 'ArrowRight': navigate(0,  1); break;
    case 'ArrowLeft':  navigate(0, -1); break;
    case 'ArrowDown':  navigate(1,  0); break;
    case 'ArrowUp':    navigate(-1, 0); break;
    case 'z': case 'Z': if (e.ctrlKey || e.metaKey) undoLast(); break;
    default: return;
  }
  e.preventDefault();
});

// ─── UI Button Wiring ─────────────────────────────────────────────────────────
document.querySelectorAll('.num-btn').forEach(btn =>
  btn.addEventListener('click', () => enterValue(parseInt(btn.dataset.n))));

document.getElementById('erase-btn').addEventListener('click', eraseCell);
document.getElementById('undo-btn').addEventListener('click', undoLast);
document.getElementById('hint-btn').addEventListener('click', giveHint);

document.getElementById('new-btn').addEventListener('click', () => {
  winOverlay.classList.remove('show');
  startNewGame(document.getElementById('diff-sel').value);
});
document.getElementById('win-new-btn').addEventListener('click', () => {
  winOverlay.classList.remove('show');
  startNewGame(document.getElementById('diff-sel').value);
});

document.getElementById('notes-btn').addEventListener('click', () => {
  notesMode = !notesMode;
  notesBtnEl.textContent = `✏️  Notes: ${notesMode ? 'ON' : 'OFF'}`;
  notesBtnEl.classList.toggle('on', notesMode);
});

document.querySelectorAll('.face-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.face-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    focusFace = parseInt(btn.dataset.face);
    animCamTo(focusFace);
    refreshAll();
    if (selected && focusFace !== -1 && selected.face !== focusFace) {
      deselectAll();
    }
  });
});

// ─── Resize ───────────────────────────────────────────────────────────────────
function onResize() {
  const w = wrapEl.clientWidth;
  const h = wrapEl.clientHeight;
  if (!w || !h) return;

  renderer.setSize(w, h);
  aspect = w / h;
  camera.left   = -FRUSTUM * aspect;
  camera.right  =  FRUSTUM * aspect;
  camera.top    =  FRUSTUM;
  camera.bottom = -FRUSTUM;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', onResize);

// ─── Render Loop ──────────────────────────────────────────────────────────────
let lastT = 0;

function animate(t = 0) {
  requestAnimationFrame(animate);
  const dt = Math.min((t - lastT) / 1000, 0.1);
  lastT = t;
  updateCamAnim(dt);
  controls.update();
  renderer.render(scene, camera);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
buildCells();

requestAnimationFrame(() => {
  onResize();
  animate();
  startNewGame('medium');
});
