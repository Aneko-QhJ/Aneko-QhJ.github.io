const gridElement = document.getElementById('grid');
const mineCountElement = document.getElementById('mine-count');
const resetBtn = document.getElementById('reset-btn');
const timerElement = document.getElementById('timer');
const customPanel = document.getElementById('custom-panel');
const expMenu = document.getElementById('exp-menu'); 
const btnExp = document.getElementById('btn-exp'); 
const virtualCursor = document.getElementById('virtual-cursor');
let currentRows = 10;
let currentCols = 10;
let currentMines = 10;
let grid = [];
let flagsLeft = 0;
let isGameOver = false;
let revealedCount = 0;
let isFirstClick = true;
let startTime = 0;
let timerInterval = null;
let longPressTimer = null;
let isLongPressHandled = false;
let touchStartX = 0;
let touchStartY = 0;
let isScrolling = false;
let isKeyboardMode = false;
let cursorRow = 0;
let cursorCol = 0;
let currentDifficultyStr = 'easy';
let currentThemeStr = document.documentElement.dataset.themePreference === 'system'
    ? 'auto' : document.documentElement.dataset.themePreference;
let allowMixedInput = false;
const PRESETS = {
    easy: { r: 9, c: 9, m: 10 },
    medium: { r: 16, c: 16, m: 40 },
    hard: { r: 16, c: 30, m: 99 }
};
let gamepadIndex = null;
let lastButtonState = []; 
let isAnalogMode = false;
let vCursorX = window.innerWidth / 2;
let vCursorY = window.innerHeight / 2;
let dpadLastDir = null; 
let dpadNextTime = 0;   
function toggleExpMenu() {
    const isShowing = expMenu.classList.contains('show');
    if (isShowing) {
        expMenu.classList.remove('show');
        btnExp.classList.remove('active');
        btnExp.innerText = '实验性功能 ▼';
    } else {
        expMenu.classList.add('show');
        btnExp.classList.add('active');
        btnExp.innerText = '实验性功能 ▲';
    }
}
function toggleAnimations(checkbox) {
    document.body.classList.toggle('no-anim', checkbox.checked);
}
function toggleMixedInput(checkbox) {
    allowMixedInput = checkbox.checked;
    if (allowMixedInput) {
        document.body.classList.remove('keyboard-mode');
    } else {
        if (isKeyboardMode && !isAnalogMode) {
            document.body.classList.add('keyboard-mode');
        }
    }
}
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
    const html = document.documentElement;
    html.dataset.themePreference = currentThemeStr === 'auto' ? 'system' : currentThemeStr;
    html.dataset.theme = currentThemeStr === 'auto'
        ? (systemTheme.matches ? 'dark' : 'light') : currentThemeStr;
    document.querySelectorAll('.theme-toggles button').forEach(btn => {
        const selected = btn.id === `theme-${currentThemeStr}`;
        btn.classList.toggle('active', selected);
        btn.setAttribute('aria-pressed', String(selected));
    });
}
function setTheme(theme) {
    currentThemeStr = theme;
    try { localStorage.setItem('aneko-theme', theme === 'auto' ? 'system' : theme); } catch (_) {}
    applyTheme();
}
systemTheme.addEventListener('change', () => {
    if (currentThemeStr === 'auto') applyTheme();
});
window.addEventListener('storage', event => {
    if (event.key !== 'aneko-theme' && event.key !== null) return;
    currentThemeStr = ['light', 'dark'].includes(event.newValue) ? event.newValue : 'auto';
    applyTheme();
});
applyTheme();
function cycleTheme() {
    const themes = ['auto', 'light', 'dark'];
    let idx = themes.indexOf(currentThemeStr);
    idx = (idx + 1) % themes.length;
    setTheme(themes[idx]);
}
function setDifficulty(level) {
    if (PRESETS[level]) {
        const p = PRESETS[level];
        currentRows = p.r;
        currentCols = p.c;
        currentMines = p.m;
    }
    currentDifficultyStr = level;

    customPanel.classList.remove('show');
    updateActiveButton(`btn-${level}`);
    initGame();
}
function cycleDifficulty() {
    const levels = ['easy', 'medium', 'hard', 'full'];
    let idx = levels.indexOf(currentDifficultyStr);
    if (idx === -1) idx = 0; 
    else idx = (idx + 1) % levels.length;
    const nextLevel = levels[idx];
    if (nextLevel === 'full') setFullScreen();
    else setDifficulty(nextLevel);
}
function setFullScreen() {
    currentDifficultyStr = 'full';
    customPanel.classList.remove('show');
    updateActiveButton('btn-full');
    const availableHeight = window.innerHeight - 230; 
    const availableWidth = window.innerWidth - 40; 
    let cols = Math.floor(availableWidth / 30);
    let rows = Math.floor(availableHeight / 30);
    cols = Math.max(9, cols);
    rows = Math.max(9, rows);
    let mines = Math.floor(rows * cols * 0.2);
    currentRows = rows;
    currentCols = cols;
    currentMines = mines;
    initGame();
}
function toggleBrowserFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log(`Error attempting to enable full-screen mode: ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
    }
}
function enableCustomMode() {
    currentDifficultyStr = 'custom';
    updateActiveButton('btn-custom');
    customPanel.classList.add('show');
}
function updateActiveButton(id) {
    const group = document.getElementById(id).parentElement;
    if (group.classList.contains('theme-toggles')) return;
    group.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}
function applyCustom() {
    const r = parseInt(document.getElementById('custom-rows').value);
    const c = parseInt(document.getElementById('custom-cols').value);
    let m = parseInt(document.getElementById('custom-mines').value);
    if(isNaN(r) || r < 3) return alert("行数太少 (最少3)");
    if(isNaN(c) || c < 8) return alert("列数太少 (最少8)");
    const maxMines = (r * c) - 9;
    if(m === 0) m = Math.floor(r * c * 0.2);
    if(isNaN(m) || m < 0) m = 1;
    if(m > maxMines) {
        m = maxMines;
        alert(`为了保证首发不炸，雷数最多调整为 ${maxMines}`);
    }
    document.getElementById('custom-mines').value = m;
    currentRows = r;
    currentCols = c;
    currentMines = m;
    initGame();
}
function initGame() {
    stopTimer(false);
    gridElement.innerHTML = '';
    grid = [];
    flagsLeft = currentMines;
    isGameOver = false;
    revealedCount = 0;
    isFirstClick = true;
    mineCountElement.innerText = formatNumber(flagsLeft);
    timerElement.innerText = '000';
    resetBtn.innerText = '😊';
    gridElement.style.gridTemplateColumns = `repeat(${currentCols}, 30px)`;
    gridElement.style.gridTemplateRows = `repeat(${currentRows}, 30px)`;
    for (let r = 0; r < currentRows; r++) {
        const row = [];
        for (let c = 0; c < currentCols; c++) {
            const cellElement = document.createElement('div');
            cellElement.classList.add('cell');
            cellElement.dataset.row = r;
            cellElement.dataset.col = c;
            cellElement.addEventListener('mouseup', (e) => {
                if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
                if (e.button === 0) handleInput(r, c, 'reveal');
            });
            cellElement.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
                handleInput(r, c, 'flag');
            });
            cellElement.addEventListener('touchstart', (e) => {
                if (!allowMixedInput && isKeyboardMode) setKeyboardMode(false);
                const touch = e.touches[0];
                touchStartX = touch.clientX;
                touchStartY = touch.clientY;
                isScrolling = false;
                isLongPressHandled = false;
                longPressTimer = setTimeout(() => {
                    if (!isScrolling) {
                        handleInput(r, c, 'reveal'); 
                        isLongPressHandled = true;
                        if (navigator.vibrate) navigator.vibrate(50); 
                    }
                }, 400);
            }, { passive: true });
            cellElement.addEventListener('touchmove', (e) => {
                const touch = e.touches[0];
                const diffX = Math.abs(touch.clientX - touchStartX);
                const diffY = Math.abs(touch.clientY - touchStartY);
                if (diffX > 10 || diffY > 10) {
                    isScrolling = true;
                    clearTimeout(longPressTimer); 
                }
            }, { passive: true });
            cellElement.addEventListener('touchend', (e) => {
                clearTimeout(longPressTimer);
                if (isScrolling) return;
                if (!isLongPressHandled) {
                    if (e.cancelable) e.preventDefault(); 
                    const action = isFirstClick ? 'reveal' : 'flag';
                    handleInput(r, c, action);
                }
            });
            gridElement.appendChild(cellElement);
            row.push({
                element: cellElement,
                isMine: false,
                isRevealed: false,
                isFlagged: false,
                neighborMines: 0
            });
        }
        grid.push(row);
    }
    if (cursorRow >= currentRows) cursorRow = currentRows - 1;
    if (cursorCol >= currentCols) cursorCol = currentCols - 1;
    if (cursorRow < 0) cursorRow = 0;
    if (cursorCol < 0) cursorCol = 0;
    if (isKeyboardMode) updateCursor();
}
function setKeyboardMode(active) {
    isKeyboardMode = active;
    if (active) {
        if (isAnalogMode) {
             document.body.classList.remove('keyboard-mode');
             virtualCursor.style.display = 'block';
        } else {
            if (!allowMixedInput) document.body.classList.add('keyboard-mode');
            else document.body.classList.remove('keyboard-mode');

            virtualCursor.style.display = 'none';
            updateCursor();
        }
    } else {
        document.body.classList.remove('keyboard-mode');
        virtualCursor.style.display = 'none';
        const oldCursor = document.querySelector('.cell.cursor');
        if (oldCursor) oldCursor.classList.remove('cursor');
    }
}
function updateCursor() {
    if (!isKeyboardMode || isAnalogMode) return;
    const oldCursor = document.querySelector('.cell.cursor');
    if (oldCursor) oldCursor.classList.remove('cursor');
    if (grid[cursorRow] && grid[cursorRow][cursorCol]) {
        const cell = grid[cursorRow][cursorCol].element;
        cell.classList.add('cursor');
        const rect = cell.getBoundingClientRect();
        const isInView = (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
        if (!isInView) {
            cell.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
        }
    }
}
function moveCursor(dr, dc) {
    let r = cursorRow + dr;
    let c = cursorCol + dc;
    if (r < 0 || r >= currentRows || c < 0 || c >= currentCols) return;
    const isEmptySpace = (rr, cc) => {
        const cell = grid[rr][cc];
        return cell.isRevealed && cell.neighborMines === 0 && !cell.isMine;
    };
    if (isEmptySpace(r, c)) {
        while (true) {
            let nextR = r + dr;
            let nextC = c + dc;
            if (nextR < 0 || nextR >= currentRows || nextC < 0 || nextC >= currentCols) break;
            r = nextR;
            c = nextC;
            if (!isEmptySpace(r, c)) break;
        }
    }
    cursorRow = r;
    cursorCol = c;
    updateCursor();
}
window.addEventListener('mousemove', (e) => {
    if (Math.abs(e.movementX) > 0 || Math.abs(e.movementY) > 0) {
        if (!allowMixedInput) { 
            if (isKeyboardMode) setKeyboardMode(false);
            if (isAnalogMode) {
                isAnalogMode = false;
                virtualCursor.style.display = 'none';
            }
        }
    }
});
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    const key = e.key.toLowerCase();
    const code = e.code;
    if (key === 'f') { e.preventDefault(); toggleBrowserFullscreen(); return; }
    if (key === 't') { cycleDifficulty(); return; }
    if (key === 'y') { cycleTheme(); return; }
    if (key === ' ') { e.preventDefault(); initGame(); return; }
    const isMoveKey = ['w', 'a', 's', 'd'].includes(key);
    const isActionKey = ['j', 'k'].includes(key);
    if (isMoveKey || isActionKey) {
        isAnalogMode = false; 
        if (!isKeyboardMode) setKeyboardMode(true);
        if (isMoveKey) {
            e.preventDefault();
            let dr = 0, dc = 0;
            if (key === 'w') dr = -1;
            if (key === 's') dr = 1;
            if (key === 'a') dc = -1;
            if (key === 'd') dc = 1;
            moveCursor(dr, dc);
        } else if (isActionKey) {
            if (key === 'j') handleInput(cursorRow, cursorCol, 'reveal');
            if (key === 'k') handleInput(cursorRow, cursorCol, 'flag');
        }
    }
});
function startTimer() {
    startTime = Date.now();
    timerInterval = setInterval(() => {
        const now = Date.now();
        const seconds = Math.floor((now - startTime) / 1000);
        timerElement.innerText = Math.min(seconds, 999).toString().padStart(3, '0');
    }, 100);
}
function stopTimer(isWin) {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    if (isWin && startTime > 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        timerElement.innerText = elapsed.toFixed(1);
    }
}
function handleInput(r, c, action) {
    if (isGameOver) return;
    const cell = grid[r][c];
    if (action === 'flag') {
        if (cell.isRevealed) {
            attemptChording(r, c);
            return;
        }
        toggleFlag(cell);
    } 
    else if (action === 'reveal') {
        if (cell.isFlagged) return;
        if (cell.isRevealed) {
            attemptChording(r, c);
            return;
        }
        if (isFirstClick) {
            isFirstClick = false;
            startTimer();
            placeMines(r, c);
            calculateNumbers();
        }
        if (cell.isMine) {
            gameOver(false);
        } else {
            revealCell(r, c);
            checkWin();
        }
    }
}
function attemptChording(r, c) {
    const cell = grid[r][c];
    if (cell.neighborMines === 0) return; 
    let flagCount = 0;
    const neighbors = getNeighbors(r, c);
    neighbors.forEach(n => { if (grid[n.r][n.c].isFlagged) flagCount++; });
    if (flagCount !== cell.neighborMines) {
        neighbors.forEach(n => {
            const neighborCell = grid[n.r][n.c];
            if (!neighborCell.isRevealed && !neighborCell.isFlagged) {
                neighborCell.element.classList.add('flash');
                setTimeout(() => neighborCell.element.classList.remove('flash'), 200);
            }
        });
        return;
    }
    let hitMine = false;
    neighbors.forEach(n => {
        const target = grid[n.r][n.c];
        if (!target.isRevealed && !target.isFlagged) {
            if (target.isMine) {
                hitMine = true;
                target.element.classList.add('mine'); 
            } else {
                revealCell(n.r, n.c);
            }
        }
    });
    if (hitMine) gameOver(false);
    else checkWin();
}
function getNeighbors(r, c) {
    const arr = [];
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            const nr = r + i;
            const nc = c + j;
            if (nr >= 0 && nr < currentRows && nc >= 0 && nc < currentCols) {
                arr.push({r: nr, c: nc});
            }
        }
    }
    return arr;
}
function toggleFlag(cell) {
    if (cell.isFlagged) {
        cell.isFlagged = false;
        cell.element.innerText = '';
        flagsLeft++;
    } else {
        if (flagsLeft > 0) {
            cell.isFlagged = true;
            cell.element.innerText = '🚩';
            flagsLeft--;
        }
    }
    mineCountElement.innerText = formatNumber(flagsLeft);
}
function placeMines(safeRow, safeCol) {
    let minesPlaced = 0;
    while (minesPlaced < currentMines) {
        const r = Math.floor(Math.random() * currentRows);
        const c = Math.floor(Math.random() * currentCols);
        const distR = Math.abs(r - safeRow);
        const distC = Math.abs(c - safeCol);
        if (distR <= 1 && distC <= 1) continue;
        if (!grid[r][c].isMine) {
            grid[r][c].isMine = true;
            minesPlaced++;
        }
    }
}
function calculateNumbers() {
    for (let r = 0; r < currentRows; r++) {
        for (let c = 0; c < currentCols; c++) {
            if (grid[r][c].isMine) continue;
            let count = 0;
            getNeighbors(r, c).forEach(n => {
                if (grid[n.r][n.c].isMine) count++;
            });
            grid[r][c].neighborMines = count;
        }
    }
}
function revealCell(r, c) {
    if (r < 0 || r >= currentRows || c < 0 || c >= currentCols) return;
    const cell = grid[r][c];
    if (cell.isRevealed || cell.isFlagged) return;
    cell.isRevealed = true;
    cell.element.classList.add('revealed');
    revealedCount++;
    if (cell.neighborMines > 0) {
        cell.element.innerText = cell.neighborMines;
        cell.element.classList.add(`num-${cell.neighborMines}`);
    } else {
        getNeighbors(r, c).forEach(n => {
            revealCell(n.r, n.c);
        });
    }
}
function gameOver(isWin) {
    isGameOver = true;
    stopTimer(isWin);
    resetBtn.innerText = isWin ? '😎' : '😵';
    if (!isWin) {
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        grid.forEach(row => {
            row.forEach(cell => {
                if (cell.isMine) {
                    cell.element.innerText = '💣';
                    cell.element.classList.add('revealed', 'mine');
                } else if (cell.isFlagged && !cell.isMine) {
                    cell.element.innerText = '❌'; 
                    cell.element.classList.add('wrong-flag');
                }
            });
        });
    }
}
function checkWin() {
    if (revealedCount + currentMines === currentRows * currentCols) {
        for (let r = 0; r < currentRows; r++) {
            for (let c = 0; c < currentCols; c++) {
                const cell = grid[r][c];
                if (!cell.isRevealed && !cell.isFlagged) {
                    cell.isFlagged = true;
                    cell.element.innerText = '🚩';
                }
            }
        }
        mineCountElement.innerText = formatNumber(currentMines);
        gameOver(true);
    }
}
function formatNumber(num) {
    if (num < 0) return '000';
    return num.toString().padStart(3, '0');
}
resetBtn.addEventListener('click', initGame);
setDifficulty('easy');
window.addEventListener("gamepadconnected", (e) => {
    console.log("Gamepad connected:", e.gamepad.id);
    gamepadIndex = e.gamepad.index;
    requestAnimationFrame(updateGamepadStatus);
});

window.addEventListener("gamepadvisibled", (e) => {
    if (gamepadIndex === e.gamepad.index) gamepadIndex = null;
});

function updateGamepadStatus() {
    if (gamepadIndex === null) return;
    const gp = navigator.getGamepads()[gamepadIndex];
    if (!gp) return;
    const isPressed = (idx) => gp.buttons[idx] && gp.buttons[idx].pressed;
    const justPressed = (idx) => isPressed(idx) && !lastButtonState[idx];
    if (justPressed(9)) initGame();
    if (justPressed(8)) cycleDifficulty();
    if (justPressed(0)) {
        if (isAnalogMode) {
            const el = document.elementFromPoint(vCursorX, vCursorY);
            if (el) {
                if (el.tagName === 'BUTTON' || el.classList.contains('face-btn') || el.closest('button')) {
                    (el.closest('button') || el).click();
                } else {
                    const cell = el.closest('.cell');
                    if (cell) {
                        const r = parseInt(cell.dataset.row);
                        const c = parseInt(cell.dataset.col);
                        handleInput(r, c, 'reveal');
                    }
                }
            }
        } else {
            handleInput(cursorRow, cursorCol, 'reveal');
        }
    }
    if (justPressed(1)) {
        if (isAnalogMode) {
            const el = document.elementFromPoint(vCursorX, vCursorY);
            const cell = el ? el.closest('.cell') : null;
            if (cell) handleInput(parseInt(cell.dataset.row), parseInt(cell.dataset.col), 'flag');
        } else {
            handleInput(cursorRow, cursorCol, 'flag');
        }
    }
    let dr = 0, dc = 0;
    if (isPressed(12)) dr = -1;
    if (isPressed(13)) dr = 1;
    if (isPressed(14)) dc = -1;
    if (isPressed(15)) dc = 1;
    const currentDir = (dr + 10) + (dc + 10) * 100; 
    if (dr !== 0 || dc !== 0) {
        const now = Date.now();
        if (currentDir !== dpadLastDir) {
            moveCursor(dr, dc);
            dpadNextTime = now + 400;
            dpadLastDir = currentDir;
            if (isAnalogMode) { isAnalogMode = false; virtualCursor.style.display = 'none'; }
            if (!isKeyboardMode) setKeyboardMode(true);
        } 
        else if (now >= dpadNextTime) {
            moveCursor(dr, dc);
            dpadNextTime = now + 100;
        }
    } else {
        dpadLastDir = null; 
    }
    const deadzone = 0.15;
    const axisX = gp.axes[0];
    const axisY = gp.axes[1];
    if (Math.abs(axisX) > deadzone || Math.abs(axisY) > deadzone) {
        if (!isAnalogMode) {
            isAnalogMode = true;
            setKeyboardMode(true); 
            virtualCursor.style.left = vCursorX + 'px';
            virtualCursor.style.top = vCursorY + 'px';
        }
        const speed = 9; 
        vCursorX += axisX * speed;
        vCursorY += axisY * speed;
        vCursorX = Math.max(0, Math.min(window.innerWidth, vCursorX));
        vCursorY = Math.max(0, Math.min(window.innerHeight, vCursorY));
        virtualCursor.style.left = vCursorX + 'px';
        virtualCursor.style.top = vCursorY + 'px';
        const margin = 50;
        const scrollSpd = 7;
        if (vCursorX > window.innerWidth - margin) window.scrollBy(scrollSpd, 0);
        if (vCursorX < margin) window.scrollBy(-scrollSpd, 0);
        if (vCursorY > window.innerHeight - margin) window.scrollBy(0, scrollSpd);
        if (vCursorY < margin) window.scrollBy(0, -scrollSpd);
    }
    for (let i = 0; i < gp.buttons.length; i++) {
        lastButtonState[i] = gp.buttons[i].pressed;
    }
    requestAnimationFrame(updateGamepadStatus);
}
