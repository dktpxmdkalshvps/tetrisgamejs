import { useState, useEffect, useCallback, useRef } from "react";

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const COLS = 10;
const ROWS = 20;
const CELL = 28;

const TETROMINOES = {
  I: { shape: [[1,1,1,1]],         color: "#00f5ff" },
  O: { shape: [[1,1],[1,1]],       color: "#ffe600" },
  T: { shape: [[0,1,0],[1,1,1]],   color: "#d966ff" },
  S: { shape: [[0,1,1],[1,1,0]],   color: "#00ff88" },
  Z: { shape: [[1,1,0],[0,1,1]],   color: "#ff3a5c" },
  J: { shape: [[1,0,0],[1,1,1]],   color: "#3d9bff" },
  L: { shape: [[0,0,1],[1,1,1]],   color: "#ffaa00" },
};

const PIECE_KEYS = Object.keys(TETROMINOES);
const LINE_SCORES = [0, 100, 300, 500, 800];
const LINE_NAMES  = ["", "SINGLE", "DOUBLE", "TRIPLE", "TETRIS!"];
const CLEAR_MS    = 320;

// ── HELPERS ───────────────────────────────────────────────────────────────────
const createBoard = () => Array.from({ length: ROWS }, () => Array(COLS).fill(null));
const rotateCW = shape => shape[0].map((_, ci) => shape.map(r => r[ci]).reverse());

function randomPiece() {
  const key = PIECE_KEYS[Math.floor(Math.random() * PIECE_KEYS.length)];
  const { shape, color } = TETROMINOES[key];
  return { shape, color, x: Math.floor(COLS / 2) - Math.ceil(shape[0].length / 2), y: 0 };
}

function isValid(board, shape, x, y) {
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nr = r + y, nc = c + x;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return false;
      if (board[nr][nc]) return false;
    }
  return true;
}

function lockPiece(board, piece) {
  const next = board.map(r => [...r]);
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c])
        next[piece.y + r][piece.x + c] = piece.color;
  return next;
}

function findFullRows(board) {
  return board.reduce((acc, row, i) => { if (row.every(c => c)) acc.push(i); return acc; }, []);
}

function removeLines(board, rows) {
  const kept = board.filter((_, i) => !rows.includes(i));
  const empty = Array.from({ length: rows.length }, () => Array(COLS).fill(null));
  return [...empty, ...kept];
}

function getGhost(board, piece) {
  let g = { ...piece };
  while (isValid(board, g.shape, g.x, g.y + 1)) g = { ...g, y: g.y + 1 };
  return g;
}

// ── NEXT PIECE PREVIEW ────────────────────────────────────────────────────────
function NextPreview({ piece }) {
  const P = 22;
  if (!piece) return <div style={{ height: 70 }} />;
  const offX = Math.floor((4 - piece.shape[0].length) / 2);
  const offY = Math.floor((2 - piece.shape.length) / 2);
  return (
    <svg width={4*P} height={3*P} style={{ display:"block", margin:"0 auto" }}>
      {piece.shape.map((row, ri) => row.map((cell, ci) => !cell ? null : (
        <g key={`${ri}-${ci}`}>
          <rect x={(ci+offX)*P+2} y={(ri+offY)*P+2} width={P-4} height={P-4} fill={piece.color} rx={2}/>
          <rect x={(ci+offX)*P+3} y={(ri+offY)*P+3} width={P-6} height={5} fill="rgba(255,255,255,0.35)" rx={1}/>
        </g>
      )))}
    </svg>
  );
}

// ── STAT CARD ─────────────────────────────────────────────────────────────────
function StatCard({ label, children, accent, glow }) {
  return (
    <div style={{
      background:"#0d0d18",
      border:`1px solid ${glow ? (accent||"#00f5ff")+"55" : "#1a1a28"}`,
      borderRadius:6, padding:"10px 14px",
      boxShadow: glow ? `0 0 16px ${accent||"#00f5ff"}33` : "none",
      transition:"all 0.3s",
    }}>
      <div style={{ fontSize:9, letterSpacing:4, color:"#2e2e48", marginBottom:5, textTransform:"uppercase" }}>{label}</div>
      {children}
    </div>
  );
}

function NumDisplay({ value, color, size=20 }) {
  return (
    <div style={{
      fontSize:size, fontWeight:900, letterSpacing:2, color,
      textShadow:`0 0 12px ${color}99`, lineHeight:1,
    }}>{value}</div>
  );
}

// ── LEVEL GAUGE ───────────────────────────────────────────────────────────────
function LevelGauge({ lines, level }) {
  const pct = (lines % 10) / 10 * 100;
  const palette = ["#00f5ff","#00ff88","#ffe600","#ffaa00","#ff3a5c","#d966ff"];
  const col = palette[(level-1) % palette.length];
  return (
    <StatCard label="LEVEL">
      <NumDisplay value={String(level).padStart(2,"0")} color={col} size={26}/>
      <div style={{ marginTop:10, height:5, background:"#111120", borderRadius:3, overflow:"hidden" }}>
        <div style={{
          height:"100%", width:`${pct}%`,
          background:`linear-gradient(90deg,${col}66,${col})`,
          boxShadow:`0 0 8px ${col}`,
          borderRadius:3, transition:"width 0.3s ease",
        }}/>
      </div>
      <div style={{ display:"flex", gap:3, marginTop:6 }}>
        {Array.from({length:10},(_,i)=>(
          <div key={i} style={{
            flex:1, height:3, borderRadius:1,
            background: i < lines%10 ? col : "#1a1a2e",
            boxShadow: i < lines%10 ? `0 0 4px ${col}` : "none",
            transition:"all 0.2s",
          }}/>
        ))}
      </div>
      <div style={{ fontSize:9, color:"#2a2a44", letterSpacing:2, marginTop:6 }}>
        {10-(lines%10)} lines to next
      </div>
    </StatCard>
  );
}

// ── SPEED METER ───────────────────────────────────────────────────────────────
function SpeedMeter({ level }) {
  const palette = ["#00f5ff","#00ff88","#ffe600","#ffaa00","#ff3a5c","#d966ff","#00f5ff","#00ff88","#ffe600","#ff3a5c"];
  return (
    <StatCard label="SPEED">
      <div style={{ display:"flex", gap:3, marginTop:4 }}>
        {Array.from({length:10},(_,i)=>{
          const on = i < Math.min(level,10);
          return (
            <div key={i} style={{
              flex:1, height:22, borderRadius:3,
              background: on ? palette[i] : "#111120",
              boxShadow: on ? `0 0 6px ${palette[i]}` : "none",
              transition:"all 0.3s",
            }}/>
          );
        })}
      </div>
    </StatCard>
  );
}

// ── SCORING TABLE ─────────────────────────────────────────────────────────────
function ScoringTable() {
  const rows = [["1-LINE","100"],["2-LINE","300"],["3-LINE","500"],["TETRIS","800"]];
  return (
    <StatCard label="SCORING">
      {rows.map(([k,v]) => (
        <div key={k} style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
          <span style={{ fontSize:9, color: k==="TETRIS"?"#ffe60088":"#1e2e3e", letterSpacing:2 }}>{k}</span>
          <span style={{ fontSize:9, color:"#1e2e3e", letterSpacing:1 }}>{v} pts</span>
        </div>
      ))}
      <div style={{ fontSize:8, color:"#1a1a30", marginTop:4, letterSpacing:1 }}>× combo multiplier</div>
    </StatCard>
  );
}

// ── CONTROLS CARD ─────────────────────────────────────────────────────────────
function ControlsCard() {
  const keys=[["← →","이동"],["↑  Z","회전"],["↓","소프트 드롭"],["SPACE","하드 드롭"],["ESC","일시정지"]];
  return (
    <StatCard label="CONTROLS">
      {keys.map(([k,v])=>(
        <div key={k} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:7 }}>
          <kbd style={{
            background:"#111120", border:"1px solid #1e1e34", borderRadius:3,
            padding:"2px 7px", fontSize:9, color:"#00f5ff", letterSpacing:1,
            fontFamily:"'Courier New',monospace",
          }}>{k}</kbd>
          <span style={{ fontSize:9, color:"#1e2e3e", letterSpacing:1 }}>{v}</span>
        </div>
      ))}
    </StatCard>
  );
}

// ── SCORE POPUP ───────────────────────────────────────────────────────────────
function ScorePopup({ popups }) {
  return (
    <div style={{ position:"absolute", inset:0, pointerEvents:"none", zIndex:20 }}>
      {popups.map(p => (
        <div key={p.id} style={{
          position:"absolute", left:"50%", top: p.row * CELL,
          transform:"translateX(-50%)",
          color: p.count===4 ? "#ffe600" : "#ffffff",
          fontSize: p.count===4 ? 20 : 14,
          fontFamily:"'Courier New',monospace",
          fontWeight:"bold", letterSpacing:3,
          textShadow: p.count===4 ? "0 0 20px #ffe600,0 0 40px #ffe600" : "0 0 10px #fff",
          animation:"popFloat 0.9s ease-out forwards",
          whiteSpace:"nowrap",
        }}>
          {p.count===4 ? "✦ TETRIS! ✦" : LINE_NAMES[p.count]}
          {p.bonus>1 && <span style={{ fontSize:10, marginLeft:6, color:"#ff9f0a" }}>×{p.bonus}</span>}
        </div>
      ))}
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function Tetris() {
  const [board, setBoard]         = useState(createBoard());
  const [current, setCurrent]     = useState(null);
  const [next, setNext]           = useState(null);
  const [score, setScore]         = useState(0);
  const [hiScore, setHiScore]     = useState(0);
  const [lines, setLines]         = useState(0);
  const [level, setLevel]         = useState(1);
  const [combo, setCombo]         = useState(0);
  const [gameOver, setGameOver]   = useState(false);
  const [started, setStarted]     = useState(false);
  const [paused, setPaused]       = useState(false);
  const [clearRows, setClearRows] = useState([]);
  const [clearing, setClearing]   = useState(false);
  const [popups, setPopups]       = useState([]);
  const [scoreFlash, setScoreFlash] = useState(false);

  const live = useRef({});
  useEffect(() => {
    live.current = { board, current, gameOver, paused, clearing, combo };
  }, [board, current, gameOver, paused, clearing, combo]);

  // ── spawn ──────────────────────────────────────────────────────────────────
  const spawnPiece = useCallback((b) => {
    setNext(prev => {
      const piece = prev || randomPiece();
      if (!isValid(b, piece.shape, piece.x, piece.y)) { setGameOver(true); return prev; }
      setCurrent(piece);
      return randomPiece();
    });
  }, []);

  // ── settle ─────────────────────────────────────────────────────────────────
  const settle = useCallback((piece, b) => {
    const locked = lockPiece(b, piece);
    const full = findFullRows(locked);

    if (full.length > 0) {
      setClearing(true);
      setClearRows(full);
      setTimeout(() => {
        const newBoard = removeLines(locked, full);
        const count = full.length;
        setBoard(newBoard);
        setClearRows([]);
        setClearing(false);
        setLines(prev => { const nl=prev+count; setLevel(Math.floor(nl/10)+1); return nl; });
        setCombo(prev => {
          const newCombo = prev + 1;
          const pts = LINE_SCORES[count] * newCombo;
          setScore(s => { const ns=s+pts; setHiScore(h=>Math.max(h,ns)); return ns; });
          setScoreFlash(true); setTimeout(()=>setScoreFlash(false),500);
          const topRow = Math.min(...full);
          setPopups(ps => [...ps, { id:Date.now(), count, bonus:newCombo, row:topRow }]);
          setTimeout(()=>setPopups(ps=>ps.slice(1)),1000);
          return newCombo;
        });
        spawnPiece(newBoard);
      }, CLEAR_MS);
    } else {
      setBoard(locked);
      setCombo(0);
      spawnPiece(locked);
    }
  }, [spawnPiece]);

  // ── gravity ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!started || gameOver || paused || !current || clearing) return;
    const delay = Math.max(80, 800-(level-1)*72);
    const id = setInterval(() => {
      const { current:p, board:b, gameOver:go, paused:pa, clearing:cl } = live.current;
      if (!p||go||pa||cl) return;
      if (isValid(b, p.shape, p.x, p.y+1)) setCurrent(prev=>({...prev,y:prev.y+1}));
      else settle(p, b);
    }, delay);
    return () => clearInterval(id);
  }, [started, gameOver, paused, current, level, clearing, settle]);

  // ── keyboard ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!started || gameOver) return;
    const onKey = e => {
      const { paused:pa, current:p, board:b, clearing:cl } = live.current;
      if (e.key==="Escape") { setPaused(v=>!v); return; }
      if (pa||cl||!p) return;
      if (e.key==="ArrowLeft")  { if(isValid(b,p.shape,p.x-1,p.y)) setCurrent(prev=>({...prev,x:prev.x-1})); }
      else if (e.key==="ArrowRight") { if(isValid(b,p.shape,p.x+1,p.y)) setCurrent(prev=>({...prev,x:prev.x+1})); }
      else if (e.key==="ArrowDown")  {
        if(isValid(b,p.shape,p.x,p.y+1)) setCurrent(prev=>({...prev,y:prev.y+1}));
        else settle(p,b);
      } else if (e.key==="ArrowUp"||e.key==="z"||e.key==="Z") {
        const rot=rotateCW(p.shape);
        for (const dx of [0,-1,1,-2,2]) {
          if(isValid(b,rot,p.x+dx,p.y)){ setCurrent(prev=>({...prev,shape:rot,x:prev.x+dx})); break; }
        }
      } else if (e.key===" ") {
        e.preventDefault();
        let gy=p.y; while(isValid(b,p.shape,p.x,gy+1)) gy++;
        settle({...p,y:gy},b);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [started, gameOver, settle]);

  // ── start ──────────────────────────────────────────────────────────────────
  const startGame = () => {
    const b=createBoard(), p=randomPiece();
    setBoard(b); setCurrent(p); setNext(randomPiece());
    setScore(0); setLines(0); setLevel(1); setCombo(0);
    setGameOver(false); setStarted(true); setPaused(false);
    setClearRows([]); setClearing(false); setPopups([]);
  };

  // ── display board ──────────────────────────────────────────────────────────
  const ghost = (current && !gameOver && !clearing) ? getGhost(board, current) : null;
  const displayBoard = board.map(r=>[...r]);
  if (ghost) ghost.shape.forEach((row,r) => row.forEach((cell,c) => {
    if (!cell) return;
    const nr=ghost.y+r, nc=ghost.x+c;
    if(nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&!displayBoard[nr][nc]) displayBoard[nr][nc]="__ghost__";
  }));
  if (current&&!gameOver) current.shape.forEach((row,r) => row.forEach((cell,c) => {
    if (!cell) return;
    const nr=current.y+r, nc=current.x+c;
    if(nr>=0&&nr<ROWS&&nc>=0&&nc<COLS) displayBoard[nr][nc]=current.color;
  }));

  const BW=COLS*CELL, BH=ROWS*CELL;
  const newHi = score>0 && score>=hiScore;

  return (
    <div style={{
      minHeight:"100vh", background:"#07070f",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'Courier New',monospace",
      backgroundImage:`
        radial-gradient(ellipse 55% 50% at 15% 50%,#0e0520 0%,transparent 70%),
        radial-gradient(ellipse 55% 50% at 85% 50%,#001a24 0%,transparent 70%)
      `,
    }}>
      <style>{`
        @keyframes popFloat {
          0%   { opacity:1; transform:translateX(-50%) translateY(0) scale(1); }
          60%  { opacity:1; transform:translateX(-50%) translateY(-36px) scale(1.12); }
          100% { opacity:0; transform:translateX(-50%) translateY(-64px) scale(0.88); }
        }
        @keyframes dimPulse { 0%,100%{opacity:1} 50%{opacity:0.75} }
        @keyframes rowBlink {
          0%,100%{fill:white;opacity:0.85} 40%{fill:white;opacity:0} 70%{fill:white;opacity:0.7}
        }
        @keyframes scoreJump { 0%,100%{transform:scale(1)} 40%{transform:scale(1.22)} }
        @keyframes fadeIn { from{opacity:0;transform:scale(0.97)} to{opacity:1;transform:scale(1)} }
        .glow-btn {
          cursor:pointer; background:transparent;
          font-family:'Courier New',monospace; font-size:11px;
          letter-spacing:4px; padding:9px 22px; text-transform:uppercase;
          transition:all 0.2s; border-radius:4px;
        }
      `}</style>

      {/* CRT scanlines */}
      <div style={{ position:"fixed",inset:0,pointerEvents:"none",zIndex:200,
        background:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.06) 2px,rgba(0,0,0,0.06) 4px)"
      }}/>

      <div style={{ display:"flex", gap:12, alignItems:"stretch" }}>

        {/* ════ LEFT PANEL ════ */}
        <div style={{ display:"flex",flexDirection:"column",gap:10,width:152 }}>

          {/* Hi-score */}
          <StatCard label="HI-SCORE" accent="#ffe600" glow={newHi}>
            <NumDisplay value={hiScore.toString().padStart(8,"0")} color={newHi?"#ffe600":"#2a2a44"} size={16}/>
            {newHi && <div style={{fontSize:8,color:"#ffe60088",letterSpacing:3,marginTop:3,animation:"dimPulse 1s infinite"}}>✦ NEW RECORD</div>}
          </StatCard>

          {/* Score */}
          <div style={{
            background:"#0d0d18",
            border:`1px solid ${scoreFlash?"#00f5ff66":"#1a1a28"}`,
            borderRadius:6,padding:"10px 14px",
            boxShadow:scoreFlash?"0 0 24px #00f5ff44":"none",
            animation:scoreFlash?"scoreJump 0.4s ease":"none",
            transition:"box-shadow 0.3s",
          }}>
            <div style={{fontSize:9,letterSpacing:4,color:"#2e2e48",marginBottom:5}}>SCORE</div>
            <div style={{
              fontSize:19,fontWeight:900,letterSpacing:2,color:"#00f5ff",
              textShadow:"0 0 14px #00f5ff99",
            }}>{score.toString().padStart(8,"0")}</div>
          </div>

          {/* Lines */}
          <StatCard label="LINES">
            <NumDisplay value={lines.toString().padStart(4,"0")} color="#00ff88"/>
          </StatCard>

          {/* Combo */}
          <StatCard label="COMBO" accent="#ffaa00" glow={combo>1}>
            <div style={{display:"flex",alignItems:"baseline",gap:6}}>
              <div style={{
                fontSize:32,fontWeight:900,color:combo>1?"#ffaa00":"#181828",
                textShadow:combo>1?"0 0 16px #ffaa00":"none",
                transition:"all 0.3s",lineHeight:1,
              }}>{combo}</div>
              {combo>1 && <div style={{fontSize:11,color:"#ffaa00",letterSpacing:2}}>×{combo}</div>}
            </div>
            {combo>1&&<div style={{fontSize:8,color:"#ffaa0066",letterSpacing:3,marginTop:2}}>MULTIPLIER ON</div>}
          </StatCard>

          <div style={{flex:1}}/>
          <ControlsCard/>
        </div>

        {/* ════ BOARD ════ */}
        <div style={{display:"flex",flexDirection:"column"}}>
          <div style={{
            textAlign:"center",fontSize:9,letterSpacing:8,color:"#181828",
            marginBottom:6,animation:"dimPulse 4s ease-in-out infinite",
          }}>TETRIS</div>

          <div style={{
            position:"relative",
            background:"#05050e",
            border:"1px solid #141422",
            borderRadius:4,
            boxShadow:"0 0 0 1px #00f5ff11, 0 0 40px #00f5ff08, inset 0 0 50px #00000055",
            overflow:"hidden",
          }}>
            <svg width={BW} height={BH}>
              {/* grid */}
              {Array.from({length:ROWS+1},(_,i)=>(
                <line key={`h${i}`} x1={0} y1={i*CELL} x2={BW} y2={i*CELL} stroke="#0b0b18" strokeWidth={1}/>
              ))}
              {Array.from({length:COLS+1},(_,i)=>(
                <line key={`v${i}`} x1={i*CELL} y1={0} x2={i*CELL} y2={BH} stroke="#0b0b18" strokeWidth={1}/>
              ))}

              {/* cells */}
              {displayBoard.map((row,ri)=>row.map((cell,ci)=>{
                if (!cell) return null;
                const isGhost = cell==="__ghost__";
                const color = isGhost?(current?.color||"#fff"):cell;
                const isClearing = clearRows.includes(ri);
                if (isGhost) return (
                  <rect key={`${ri}-${ci}`}
                    x={ci*CELL+2} y={ri*CELL+2} width={CELL-4} height={CELL-4}
                    fill="none" stroke={color} strokeWidth={1} rx={1} opacity={0.28}
                  />
                );
                const px=ci*CELL+1, py=ri*CELL+1, s=CELL-2;
                return (
                  <g key={`${ri}-${ci}`}>
                    {isClearing
                      ? <rect x={px} y={py} width={s} height={s} fill="white" rx={1} style={{animation:`rowBlink ${CLEAR_MS}ms ease-in-out`}}/>
                      : <>
                          <rect x={px} y={py} width={s} height={s} fill={color} rx={1}/>
                          <rect x={px+1} y={py+1} width={s-2} height={Math.floor(s*.28)} fill="rgba(255,255,255,0.32)" rx={1}/>
                          <rect x={px+1} y={py+1} width={Math.floor(s*.17)} height={s-2} fill="rgba(255,255,255,0.13)" rx={1}/>
                          <rect x={px+1} y={py+s-Math.floor(s*.17)} width={s-2} height={Math.floor(s*.17)} fill="rgba(0,0,0,0.22)" rx={1}/>
                        </>
                    }
                  </g>
                );
              }))}
            </svg>

            <ScorePopup popups={popups}/>

            {/* overlays */}
            {(!started||gameOver||paused)&&(
              <div style={{
                position:"absolute",inset:0,
                background:"rgba(5,5,14,0.91)",
                display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,
                backdropFilter:"blur(3px)",
                animation:"fadeIn 0.2s ease",
              }}>
                {gameOver?(
                  <>
                    <div style={{fontSize:9,letterSpacing:6,color:"#2a1a20"}}>— GAME OVER —</div>
                    <div style={{
                      fontSize:38,fontWeight:900,color:"#ff3a5c",letterSpacing:4,
                      textShadow:"0 0 20px #ff3a5c,0 0 60px #ff3a5c44",
                      animation:"dimPulse 1.2s ease-in-out infinite",
                    }}>OVER</div>
                    <div style={{fontSize:9,color:"#2a2a44",letterSpacing:3}}>FINAL SCORE</div>
                    <div style={{fontSize:26,fontWeight:900,color:"#ffe600",textShadow:"0 0 14px #ffe600"}}>
                      {score.toString().padStart(8,"0")}
                    </div>
                    {newHi&&<div style={{fontSize:9,color:"#ffe60099",letterSpacing:4,animation:"dimPulse 1s infinite"}}>✦ NEW HI-SCORE ✦</div>}
                    <button className="glow-btn" onClick={startGame}
                      style={{border:"1px solid #ff3a5c",color:"#ff3a5c",marginTop:6}}
                      onMouseEnter={e=>{e.target.style.background="#ff3a5c22";e.target.style.boxShadow="0 0 18px #ff3a5c55";}}
                      onMouseLeave={e=>{e.target.style.background="transparent";e.target.style.boxShadow="none";}}>
                      RETRY
                    </button>
                  </>
                ):paused?(
                  <>
                    <div style={{
                      fontSize:26,fontWeight:900,color:"#00f5ff",letterSpacing:8,
                      textShadow:"0 0 20px #00f5ff",animation:"dimPulse 2s ease-in-out infinite",
                    }}>PAUSED</div>
                    <button className="glow-btn" onClick={()=>setPaused(false)}
                      style={{border:"1px solid #00f5ff",color:"#00f5ff"}}
                      onMouseEnter={e=>{e.target.style.background="#00f5ff22";e.target.style.boxShadow="0 0 18px #00f5ff55";}}
                      onMouseLeave={e=>{e.target.style.background="transparent";e.target.style.boxShadow="none";}}>
                      RESUME
                    </button>
                  </>
                ):(
                  <>
                    <div style={{fontSize:9,letterSpacing:8,color:"#1a1a2e"}}>— ARCADE EDITION —</div>
                    <div style={{
                      fontSize:46,fontWeight:900,letterSpacing:5,
                      background:"linear-gradient(135deg,#00f5ff,#d966ff 50%,#ffe600)",
                      WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",
                    }}>TETRIS</div>
                    <div style={{fontSize:9,letterSpacing:4,color:"#2a2a44",marginTop:-10}}>PRESS START TO PLAY</div>
                    <button className="glow-btn" onClick={startGame}
                      style={{border:"1px solid #00f5ff",color:"#00f5ff",marginTop:8}}
                      onMouseEnter={e=>{e.target.style.background="#00f5ff22";e.target.style.boxShadow="0 0 18px #00f5ff55";}}
                      onMouseLeave={e=>{e.target.style.background="transparent";e.target.style.boxShadow="none";}}>
                      START GAME
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ════ RIGHT PANEL ════ */}
        <div style={{display:"flex",flexDirection:"column",gap:10,width:152}}>

          {/* NEXT PIECE */}
          <div style={{
            background:"#0d0d18",
            border:`1px solid ${next?next.color+"44":"#1a1a28"}`,
            borderRadius:6,padding:"10px 14px",
            boxShadow:next?`0 0 18px ${next.color}22`:"none",
            transition:"all 0.4s",
          }}>
            <div style={{fontSize:9,letterSpacing:4,color:"#2e2e48",marginBottom:8}}>NEXT PIECE</div>
            <NextPreview piece={next}/>
            {next&&(
              <div style={{
                textAlign:"center",fontSize:9,letterSpacing:4,marginTop:6,
                color:next.color,textShadow:`0 0 8px ${next.color}`,
              }}>
                {Object.entries(TETROMINOES).find(([,v])=>v.color===next.color)?.[0]||""}
              </div>
            )}
          </div>

          {/* Level gauge */}
          <LevelGauge lines={lines} level={level}/>

          {/* Speed meter */}
          <SpeedMeter level={level}/>

          {/* Scoring reference */}
          <ScoringTable/>

          <div style={{flex:1}}/>

          {/* Pause toggle */}
          {started&&!gameOver&&(
            <button className="glow-btn" onClick={()=>setPaused(v=>!v)}
              style={{
                border:"1px solid #1a1a28",color:"#252540",
                fontSize:10,letterSpacing:3,padding:"8px",width:"100%",
              }}
              onMouseEnter={e=>{e.target.style.borderColor="#00f5ff33";e.target.style.color="#00f5ff66";}}
              onMouseLeave={e=>{e.target.style.borderColor="#1a1a28";e.target.style.color="#252540";}}>
              {paused?"▶ RESUME":"⏸ PAUSE"}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}