import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const COLS = 10;
const ROWS = 20;
const LINE_SCORES = [0, 100, 300, 500, 800, 800, 1200];
const LINE_NAMES  = ["", "SINGLE", "DOUBLE", "TRIPLE", "TETRIS!", "T-SPIN SINGLE", "T-SPIN DOUBLE"];
const T_SPIN_BONUS = 400;
const CLEAR_MS    = 340;

const PALETTE = {
  I: { base:"#5BC4C4", mid:"#3A9EA0", deep:"#1E7070", shine:"rgba(255,255,255,0.75)", tint:"rgba(91,196,196,0.18)" },
  O: { base:"#C8B878", mid:"#A89050", deep:"#786030", shine:"rgba(255,245,200,0.7)",  tint:"rgba(200,184,120,0.18)" },
  T: { base:"#8AAAB8", mid:"#607A88", deep:"#3C5460", shine:"rgba(220,240,255,0.7)",  tint:"rgba(138,170,184,0.18)" },
  S: { base:"#2A9090", mid:"#1A6A6A", deep:"#0A4040", shine:"rgba(160,255,240,0.65)", tint:"rgba(42,144,144,0.18)" },
  Z: { base:"#1A4070", mid:"#102A50", deep:"#081830", shine:"rgba(140,190,255,0.55)", tint:"rgba(26,64,112,0.18)" },
  J: { base:"#0C1E3C", mid:"#081428", deep:"#040C1C", shine:"rgba(100,160,255,0.45)", tint:"rgba(12,30,60,0.2)"  },
  L: { base:"#D8E8F0", mid:"#A8C0CC", deep:"#789098", shine:"rgba(255,255,255,0.85)", tint:"rgba(216,232,240,0.22)" },
};

const TETROMINOES = {
  I: { shape:[[1,1,1,1]] },
  O: { shape:[[1,1],[1,1]] },
  T: { shape:[[0,1,0],[1,1,1]] },
  S: { shape:[[0,1,1],[1,1,0]] },
  Z: { shape:[[1,1,0],[0,1,1]] },
  J: { shape:[[1,0,0],[1,1,1]] },
  L: { shape:[[0,0,1],[1,1,1]] },
};
const PIECE_KEYS = Object.keys(TETROMINOES);

// ── HELPERS ───────────────────────────────────────────────────────────────────
const createBoard = () => Array.from({length:ROWS}, () => Array(COLS).fill(null));
const rotateCW = s => s[0].map((_,ci) => s.map(r=>r[ci]).reverse());

function createPiece(key) {
  return { key, shape:[...TETROMINOES[key].shape.map(r=>[...r])],
           x: Math.floor(COLS/2)-Math.ceil(TETROMINOES[key].shape[0].length/2), y:0 };
}
function isValid(board, shape, x, y) {
  for (let r=0;r<shape.length;r++) for (let c=0;c<shape[r].length;c++) {
    if (!shape[r][c]) continue;
    const nr=r+y, nc=c+x;
    if (nr<0||nr>=ROWS||nc<0||nc>=COLS||board[nr][nc]) return false;
  } return true;
}
function lockPiece(board, piece) {
  const b=board.map(r=>[...r]);
  piece.shape.forEach((row,r)=>row.forEach((cell,c)=>{ if(cell) b[piece.y+r][piece.x+c]=piece.key; }));
  return b;
}
function findFullRows(board) { return board.reduce((a,row,i)=>{if(row.every(c=>c))a.push(i);return a;},[]);}
function removeLines(board,rows) {
  const kept=board.filter((_,i)=>!rows.includes(i));
  return [...Array.from({length:rows.length},()=>Array(COLS).fill(null)),...kept];
}
function getGhost(board,piece) {
  let g={...piece}; while(isValid(board,g.shape,g.x,g.y+1)) g={...g,y:g.y+1}; return g;
}

// ── SVG DEFS ──────────────────────────────────────────────────────────────────
function SvgDefs() {
  return (
    <defs>
      <linearGradient id="frameGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"   stopColor="rgba(255,255,255,0.55)"/>
        <stop offset="40%"  stopColor="rgba(255,255,255,0.15)"/>
        <stop offset="100%" stopColor="rgba(180,180,180,0.25)"/>
      </linearGradient>
      {Object.entries(PALETTE).map(([key, p]) => (
        <g key={key}>
          <radialGradient id={`dome_${key}`} cx="42%" cy="38%" r="55%" fx="38%" fy="34%">
            <stop offset="0%"   stopColor={p.shine}/>
            <stop offset="28%"  stopColor={p.base} stopOpacity="0.92"/>
            <stop offset="65%"  stopColor={p.mid}  stopOpacity="0.95"/>
            <stop offset="100%" stopColor={p.deep} stopOpacity="1"/>
          </radialGradient>
          <radialGradient id={`shine_${key}`} cx="35%" cy="28%" r="45%">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.9)"/>
            <stop offset="50%"  stopColor="rgba(255,255,255,0.3)"/>
            <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
          </radialGradient>
          <radialGradient id={`bg_${key}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={p.base} stopOpacity="0.22"/>
            <stop offset="100%" stopColor={p.base} stopOpacity="0.06"/>
          </radialGradient>
        </g>
      ))}
      <radialGradient id="ghost_dome" cx="42%" cy="38%" r="55%">
        <stop offset="0%"   stopColor="rgba(255,255,255,0.4)"/>
        <stop offset="100%" stopColor="rgba(180,200,220,0.15)"/>
      </radialGradient>
      <filter id="tileShad" x="-15%" y="-15%" width="130%" height="130%">
        <feDropShadow dx="1" dy="2" stdDeviation="2" floodColor="rgba(0,0,0,0.22)"/>
      </filter>
    </defs>
  );
}

// ── GLASS TILE ────────────────────────────────────────────────────────────────
function GlassTile({ cx, cy, tileKey, ghost=false, flash=false, size }) {
  const p = PALETTE[tileKey] || PALETTE.I;
  const pad = 1.5, inner = size - pad*2, cr = Math.max(2, size * 0.12);
  const bx = cx+pad, by = cy+pad;
  if (flash) return <rect x={bx} y={by} width={inner} height={inner} fill="rgba(255,255,255,0.9)" rx={cr}/>;
  if (ghost) return (
    <g>
      <rect x={bx} y={by} width={inner} height={inner} fill={p.base} opacity={0.15} rx={cr}/>
      <rect x={bx} y={by} width={inner} height={inner} fill="none" stroke={p.base} strokeWidth={2} opacity={0.8} rx={cr}/>
    </g>
  );
  const cx2=cx+size/2, cy2=cy+size/2, br=inner*0.40;
  return (
    <g filter="url(#tileShad)">
      <rect x={bx} y={by} width={inner} height={inner} fill={`url(#bg_${tileKey})`} rx={cr}/>
      <rect x={bx} y={by} width={inner} height={inner} fill="none" stroke="url(#frameGrad)" strokeWidth={1.2} rx={cr}/>
      <ellipse cx={cx2} cy={cy2} rx={br} ry={br} fill={`url(#dome_${tileKey})`}/>
      <ellipse cx={cx2} cy={cy2} rx={br} ry={br} fill="none" stroke={p.mid} strokeWidth={0.8} opacity={0.5}/>
      <ellipse cx={cx+size*0.36} cy={cy+size*0.32} rx={br*0.55} ry={br*0.38} fill={`url(#shine_${tileKey})`} opacity={0.88}/>
      <ellipse cx={cx2} cy={cy+size*0.72} rx={br*0.3} ry={br*0.12} fill="rgba(255,255,255,0.2)"/>
      <rect x={bx+2} y={by+2} width={inner-4} height={3} fill="rgba(255,255,255,0.4)" rx={1}/>
      <rect x={bx+2} y={by+2} width={3} height={inner-4} fill="rgba(255,255,255,0.25)" rx={1}/>
    </g>
  );
}

function MiniTile({ cx, cy, tileKey, size=22 }) {
  const pad=1, inner=size-pad*2, cr=3;
  const cx2=cx+size/2, cy2=cy+size/2, br=inner*0.38;
  return (
    <g>
      <rect x={cx+pad} y={cy+pad} width={inner} height={inner} fill={`url(#bg_${tileKey})`} rx={cr}/>
      <rect x={cx+pad} y={cy+pad} width={inner} height={inner} fill="none" stroke="url(#frameGrad)" strokeWidth={1} rx={cr}/>
      <ellipse cx={cx2} cy={cy2} rx={br} ry={br} fill={`url(#dome_${tileKey})`}/>
      <ellipse cx={cx+size*0.36} cy={cy+size*0.32} rx={br*0.52} ry={br*0.36} fill={`url(#shine_${tileKey})`} opacity={0.82}/>
    </g>
  );
}

function PiecePreview({ piece, sz=22 }) {
  const maxW=4, maxH=2, W=maxW*sz, H=(maxH+0.5)*sz;
  return (
    <svg width={W} height={H} style={{display:"block",margin:"0 auto",overflow:"visible"}}>
      <SvgDefs/>
      {piece && piece.shape.map((row,ri)=>row.map((cell,ci)=>{
        if (!cell) return null;
        const offX=Math.floor((maxW-piece.shape[0].length)/2);
        const offY=Math.floor((maxH-piece.shape.length)/2);
        return <MiniTile key={`${ri}-${ci}`} cx={(ci+offX)*sz} cy={(ri+offY)*sz} tileKey={piece.key} size={sz}/>;
      }))}
    </svg>
  );
}

// ── UI CARDS ──────────────────────────────────────────────────────────────────
function Card({ children, accent, glow, style={}, isDark=false }) {
  const col = accent||(isDark?"rgba(60,100,120,0.3)":"rgba(180,210,220,0.3)");
  return (
    <div style={{
      background:isDark?"rgba(20,30,40,0.75)":"rgba(255,255,255,0.55)",
      border:`1px solid ${glow?col:(isDark?"rgba(80,100,120,0.5)":"rgba(180,210,220,0.5)")}`,
      borderRadius:10, padding:"10px 14px",
      backdropFilter:"blur(8px)",
      boxShadow: glow ? `0 4px 20px ${col}88, inset 0 1px 0 rgba(255,255,255,0.8)` : "0 2px 8px rgba(0,60,80,0.08), inset 0 1px 0 rgba(255,255,255,0.7)",
      transition:"all 0.3s", ...style,
    }}>{children}</div>
  );
}
function Label({ children, isDark=false }) {
  return <div style={{fontSize:9,letterSpacing:4,color:isDark?"#88AACC":"rgba(60,100,110,0.5)",marginBottom:5,textTransform:"uppercase"}}>{children}</div>;
}
function BigNum({ value, color="#1A5060", size=22, flash=false, isDark=false }) {
  return (
    <div style={{
      fontSize:size, fontWeight:900, letterSpacing:2,
      color:isDark&&color==="#1A5060"?"#88DDEE":color,
      fontFamily:"'Courier New',monospace",
      textShadow:isDark?"0 1px 0 rgba(0,0,0,0.8)":"0 1px 0 rgba(255,255,255,0.8)",
      animation:flash?"scoreJump 0.4s ease":"none",
    }}>{value}</div>
  );
}

function LevelBar({ lines, level, isDark=false }) {
  const pct=(lines%10)/10*100;
  const cols=["#3AACAC","#2A8A8A","#C8B878","#8AAAB8","#5A8080","#4A7090"];
  const col=cols[(level-1)%cols.length];
  return (
    <Card isDark={isDark}>
      <Label isDark={isDark}>LEVEL</Label>
      <BigNum value={String(level).padStart(2,"0")} color={col} size={28} isDark={isDark}/>
      <div style={{marginTop:8,height:6,background:isDark?"rgba(255,255,255,0.1)":"rgba(0,80,100,0.1)",borderRadius:3,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${pct}%`,background:col,borderRadius:3,transition:"width 0.3s ease",opacity:0.8}}/>
      </div>
      <div style={{display:"flex",gap:3,marginTop:5}}>
        {Array.from({length:10},(_,i)=>(
          <div key={i} style={{flex:1,height:3,borderRadius:2,background:i<lines%10?col:(isDark?"rgba(255,255,255,0.12)":"rgba(0,80,100,0.12)"),transition:"all 0.2s"}}/>
        ))}
      </div>
      <div style={{fontSize:9,color:isDark?"rgba(200,220,230,0.45)":"rgba(60,100,110,0.45)",marginTop:4,letterSpacing:2}}>{10-lines%10} to next</div>
    </Card>
  );
}

function ScoringCard({ isDark=false }) {
  return (
    <Card isDark={isDark}>
      <Label isDark={isDark}>SCORING</Label>
      {[["1-LINE","100"],["2-LINE","300"],["3-LINE","500"],["TETRIS","800"]].map(([k,v])=>(
        <div key={k} style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
          <span style={{fontSize:9,color:k==="TETRIS"?"#C8A030":(isDark?"rgba(200,220,230,0.5)":"rgba(60,100,110,0.5)"),letterSpacing:2}}>{k}</span>
          <span style={{fontSize:9,color:isDark?"rgba(200,220,230,0.4)":"rgba(60,100,110,0.4)",letterSpacing:1}}>{v} pts</span>
        </div>
      ))}
      <div style={{fontSize:8,color:isDark?"rgba(200,220,230,0.3)":"rgba(60,100,110,0.3)",marginTop:4,letterSpacing:1}}>× combo multiplier</div>
    </Card>
  );
}

function ScorePopup({ popups, cellSize }) {
  return (
    <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:20}}>
      {popups.map(p=>(
        <div key={p.id} style={{
          position:"absolute",left:"50%",top:p.row*cellSize,
          transform:"translateX(-50%)",
          color:p.tSpin?"#A040A0":(p.count===4?"#8A6010":"#2A6070"),
          fontSize:p.tSpin?16:(p.count===4?18:13),
          fontFamily:"'Courier New',monospace",
          fontWeight:900,letterSpacing:3,
          animation:"popFloat 0.9s ease-out forwards",
          whiteSpace:"nowrap",
          background:"rgba(255,255,255,0.75)",
          padding:"3px 10px",borderRadius:20,
          backdropFilter:"blur(4px)",
          border:"1px solid rgba(255,255,255,0.9)",
        }}>
          {p.tSpin && `T-SPIN ${LINE_NAMES[p.count]}`}
          {!p.tSpin && (p.count===4?"✦ TETRIS! ✦":LINE_NAMES[p.count])}
          {p.bonus>1&&<span style={{fontSize:9,marginLeft:6,color:"#8A6010"}}>×{p.bonus}</span>}
        </div>
      ))}
    </div>
  );
}

// ── TOUCH / CLICK CONTROL BUTTON ──────────────────────────────────────────────
function CtrlBtn({ label, onAction, size=60, fontSize=22, style={} }) {
  return (
    <button
      onPointerDown={e => { e.preventDefault(); onAction(); }}
      style={{
        width:size, height:size,
        borderRadius: "50%",
        border:"2px solid rgba(255,255,255,0.6)",
        background:"rgba(255,255,255,0.45)",
        backdropFilter:"blur(8px)",
        boxShadow:"0 3px 12px rgba(0,80,100,0.15), inset 0 1px 0 rgba(255,255,255,0.9)",
        fontSize, cursor:"pointer",
        display:"flex", alignItems:"center", justifyContent:"center",
        userSelect:"none", touchAction:"none",
        WebkitTapHighlightColor:"transparent",
        transition:"transform 0.1s, box-shadow 0.1s",
        color:"#2A6070",
        fontWeight:"bold",
        ...style,
      }}
      onPointerUp={e => { e.currentTarget.style.transform="scale(1)"; e.currentTarget.style.boxShadow="0 3px 12px rgba(0,80,100,0.15), inset 0 1px 0 rgba(255,255,255,0.9)"; }}
      onPointerDown2={undefined}
    >
      {label}
    </button>
  );
}

// ── MOBILE INFO STRIP (compact score bar above board) ─────────────────────────
function MobileInfoStrip({ score, level, next, heldPiece, isDark }) {
  const bg = isDark ? "rgba(20,30,40,0.85)" : "rgba(255,255,255,0.6)";
  const txt = isDark ? "#88DDEE" : "#1A6070";
  return (
    <div style={{
      display:"flex", alignItems:"center", justifyContent:"space-between",
      background:bg, backdropFilter:"blur(8px)",
      borderRadius:10, padding:"6px 12px",
      border:`1px solid ${isDark?"rgba(80,100,120,0.5)":"rgba(180,210,220,0.5)"}`,
      marginBottom:6, width:"100%", boxSizing:"border-box",
    }}>
      {/* Hold */}
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
        <span style={{fontSize:8,letterSpacing:3,color:isDark?"#88AACC":"rgba(60,100,110,0.5)"}}>HOLD</span>
        <svg width={44} height={30} style={{overflow:"visible"}}><SvgDefs/>
          {heldPiece && heldPiece.shape.map((row,ri)=>row.map((cell,ci)=>{
            if(!cell)return null;
            const sz=12, offX=Math.floor((4-heldPiece.shape[0].length)/2), offY=Math.floor((2-heldPiece.shape.length)/2);
            return <MiniTile key={`${ri}-${ci}`} cx={(ci+offX)*sz+2} cy={(ri+offY)*sz+2} tileKey={heldPiece.key} size={sz}/>;
          }))}
          {!heldPiece && <rect x={6} y={6} width={32} height={18} fill="rgba(0,80,100,0.08)" rx={3} strokeDasharray="3,3" stroke="rgba(0,80,100,0.2)" strokeWidth={1}/>}
        </svg>
      </div>
      {/* Score + Level */}
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:8,letterSpacing:3,color:isDark?"#88AACC":"rgba(60,100,110,0.5)"}}>SCORE</div>
        <div style={{fontSize:16,fontWeight:900,color:txt,fontFamily:"'Courier New',monospace",letterSpacing:1}}>{score.toString().padStart(7,"0")}</div>
        <div style={{fontSize:8,letterSpacing:3,color:isDark?"#88AACC":"rgba(60,100,110,0.5)",marginTop:1}}>LEVEL <span style={{color:txt}}>{level}</span></div>
      </div>
      {/* Next */}
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
        <span style={{fontSize:8,letterSpacing:3,color:isDark?"#88AACC":"rgba(60,100,110,0.5)"}}>NEXT</span>
        <svg width={44} height={30} style={{overflow:"visible"}}><SvgDefs/>
          {next && next.shape.map((row,ri)=>row.map((cell,ci)=>{
            if(!cell)return null;
            const sz=12, offX=Math.floor((4-next.shape[0].length)/2), offY=Math.floor((2-next.shape.length)/2);
            return <MiniTile key={`${ri}-${ci}`} cx={(ci+offX)*sz+2} cy={(ri+offY)*sz+2} tileKey={next.key} size={sz}/>;
          }))}
        </svg>
      </div>
    </div>
  );
}

// ── TOUCH CONTROL PAD ─────────────────────────────────────────────────────────
// Layout matching reference image:
//  LEFT  COL: [HOLD] + [HARD DROP]
//  RIGHT COL: D-pad grid [rotate] / [←] [↓] [→]
function TouchControls({ onLeft, onRight, onDown, onRotate, onHardDrop, onHold, onPause, isDark, isMobile }) {
  const btnSz = isMobile ? 62 : 48;
  const smBtnSz = isMobile ? 50 : 40;
  const accent = isDark ? "rgba(30,50,60,0.85)" : "rgba(255,255,255,0.55)";
  const border = isDark ? "rgba(80,130,150,0.5)" : "rgba(180,220,228,0.7)";

  const actionStyle = { background:"rgba(42,144,144,0.25)", borderColor:"rgba(42,144,144,0.7)", color:"#1A7070" };
  const dropStyle   = { background:"rgba(26,64,112,0.25)", borderColor:"rgba(26,64,112,0.6)", color:"#1A4070" };
  const holdStyle   = { background:"rgba(200,184,120,0.25)", borderColor:"rgba(200,184,120,0.7)", color:"#8A6010" };

  return (
    <div style={{
      display:"flex", alignItems:"center", justifyContent:"center",
      gap: isMobile ? 20 : 14,
      padding: isMobile ? "12px 16px" : "8px 12px",
      background:accent,
      backdropFilter:"blur(12px)",
      border:`1px solid ${border}`,
      borderRadius: isMobile ? 24 : 16,
      boxShadow:"0 4px 20px rgba(0,80,100,0.12)",
    }}>

      {/* LEFT: HOLD + HARD DROP */}
      <div style={{display:"flex",flexDirection:"column",gap:isMobile?10:8,alignItems:"center"}}>
        <CtrlBtn label="C" onAction={onHold} size={smBtnSz} fontSize={isMobile?14:11} style={holdStyle}/>
        <div style={{fontSize:8,letterSpacing:2,color:isDark?"rgba(200,220,230,0.5)":"rgba(60,100,110,0.45)",textAlign:"center"}}>HOLD</div>
        <CtrlBtn label="▼▼" onAction={onHardDrop} size={smBtnSz} fontSize={isMobile?13:10} style={dropStyle}/>
        <div style={{fontSize:8,letterSpacing:2,color:isDark?"rgba(200,220,230,0.5)":"rgba(60,100,110,0.45)",textAlign:"center"}}>DROP</div>
      </div>

      {/* DIVIDER */}
      <div style={{width:1,height:isMobile?120:90,background:isDark?"rgba(255,255,255,0.1)":"rgba(0,80,100,0.12)"}}/>

      {/* RIGHT: D-PAD */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gridTemplateRows:"1fr 1fr",gap:isMobile?8:6,alignItems:"center",justifyItems:"center"}}>
        {/* Row 1: empty | rotate | empty */}
        <div/>
        <CtrlBtn label="↺" onAction={onRotate} size={btnSz} fontSize={isMobile?26:20} style={actionStyle}/>
        <div/>
        {/* Row 2: left | down | right */}
        <CtrlBtn label="←" onAction={onLeft} size={btnSz} fontSize={isMobile?24:18}/>
        <CtrlBtn label="↓" onAction={onDown} size={btnSz} fontSize={isMobile?24:18}/>
        <CtrlBtn label="→" onAction={onRight} size={btnSz} fontSize={isMobile?24:18}/>
      </div>

      {/* DIVIDER */}
      <div style={{width:1,height:isMobile?120:90,background:isDark?"rgba(255,255,255,0.1)":"rgba(0,80,100,0.12)"}}/>

      {/* PAUSE */}
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
        <CtrlBtn label="⏸" onAction={onPause} size={smBtnSz} fontSize={isMobile?16:13}/>
        <div style={{fontSize:8,letterSpacing:2,color:isDark?"rgba(200,220,230,0.5)":"rgba(60,100,110,0.45)"}}>PAUSE</div>
      </div>
    </div>
  );
}

// ── MAIN GAME ─────────────────────────────────────────────────────────────────
export default function Tetris() {
  const [board, setBoard]             = useState(createBoard());
  const [current, setCurrent]         = useState(null);
  const [next, setNext]               = useState(null);
  const [heldPiece, setHeldPiece]     = useState(null);
  const [hasSwapped, setHasSwapped]   = useState(false);
  const [score, setScore]             = useState(0);
  const [hiScore, setHiScore]         = useState(0);
  const [lines, setLines]             = useState(0);
  const [level, setLevel]             = useState(1);
  const [combo, setCombo]             = useState(0);
  const [gameOver, setGameOver]       = useState(false);
  const [started, setStarted]         = useState(false);
  const [paused, setPaused]           = useState(false);
  const [clearRows, setClearRows]     = useState([]);
  const [clearing, setClearing]       = useState(false);
  const [popups, setPopups]           = useState([]);
  const [scoreFlash, setScoreFlash]   = useState(false);
  const [isDarkMode, setIsDarkMode]   = useState(false);

  // Responsive sizing
  const [cellSize, setCellSize]       = useState(32);
  const [isMobile, setIsMobile]       = useState(false);
  const containerRef                  = useRef(null);

  useLayoutEffect(() => {
    const calc = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const mobile = vw < 700;
      setIsMobile(mobile);

      if (mobile) {
        // Mobile: board fills width, reserve space for info strip + controls
        const INFO_H   = 58;  // mobile info strip
        const CTRL_H   = 180; // touch controls
        const MARGINS  = 32;
        const availH   = vh - INFO_H - CTRL_H - MARGINS;
        const availW   = vw - 16;
        const cs = Math.floor(Math.min(availH / ROWS, availW / COLS));
        setCellSize(Math.max(14, Math.min(cs, 34)));
      } else {
        // Desktop: side panels are 170px each, gap 14px
        const PANELS   = 170 * 2 + 14 * 2;
        const CTRL_H   = 120; // desktop controls below board
        const availW   = Math.min(vw - PANELS - 40, 400);
        const availH   = vh - CTRL_H - 80;
        const cs = Math.floor(Math.min(availW / COLS, availH / ROWS));
        setCellSize(Math.max(20, Math.min(cs, 36)));
      }
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  const live = useRef({});
  const bagRef = useRef([]);
  const lastMoveWasRotation = useRef(false);

  const fillBag = useCallback(() => {
    let b=[...PIECE_KEYS];
    for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}
    bagRef.current=b;
  },[]);
  const nextFromBag = useCallback(()=>{ if(!bagRef.current.length) fillBag(); return createPiece(bagRef.current.pop()); },[fillBag]);

  live.current={board,current,gameOver,paused,clearing,combo,heldPiece,hasSwapped,lastMoveWasRotation:lastMoveWasRotation.current};

  const spawnPiece = useCallback((b) => {
    setNext(prev=>{
      const piece=prev||nextFromBag();
      if(!isValid(b,piece.shape,piece.x,piece.y)){setGameOver(true);return prev;}
      setCurrent(piece); lastMoveWasRotation.current=false;
      return nextFromBag();
    });
  },[nextFromBag]);

  const settle = useCallback((piece, b) => {
    const locked=lockPiece(b,piece); setHasSwapped(false);
    let tSpin=false;
    if(piece.key==='T'&&lastMoveWasRotation.current){
      const corners=[[piece.y,piece.x],[piece.y,piece.x+2],[piece.y+2,piece.x],[piece.y+2,piece.x+2]];
      let occ=0;
      corners.forEach(([y,x])=>{ if(y>=ROWS||x<0||x>=COLS||(b[y]&&b[y][x])) occ++; });
      if(occ>=3) tSpin=true;
    }
    const full=findFullRows(locked);
    if(full.length>0){
      setClearing(true); setClearRows(full);
      setTimeout(()=>{
        const nb=removeLines(locked,full); const count=full.length;
        setBoard(nb); setClearRows([]); setClearing(false);
        setLines(prev=>{const nl=prev+count;setLevel(Math.floor(nl/10)+1);return nl;});
        setCombo(prev=>{
          const nc2=prev+1;
          let si=count; if(tSpin&&count===1) si=5; if(tSpin&&count===2) si=6;
          const pts=(tSpin?T_SPIN_BONUS:0)+LINE_SCORES[si]*nc2;
          setScore(s=>{const ns=s+pts;setHiScore(h=>Math.max(h,ns));return ns;});
          setScoreFlash(true); setTimeout(()=>setScoreFlash(false),500);
          setPopups(ps=>[...ps,{id:Date.now(),count,bonus:nc2,row:Math.min(...full),tSpin}]);
          setTimeout(()=>setPopups(ps=>ps.slice(1)),1000);
          return nc2;
        });
        spawnPiece(nb);
      },CLEAR_MS);
    } else {
      if(tSpin){ const pts=T_SPIN_BONUS; setScore(s=>{const ns=s+pts;setHiScore(h=>Math.max(h,ns));return ns;}); }
      setBoard(locked); setCombo(0); spawnPiece(locked);
    }
  },[spawnPiece]);

  // Gravity
  useEffect(()=>{
    if(!started||gameOver||paused||!current||clearing) return;
    const delay=Math.max(80,800-(level-1)*72);
    const id=setInterval(()=>{
      const{current:p,board:b,gameOver:go,paused:pa,clearing:cl}=live.current;
      if(!p||go||pa||cl) return;
      if(isValid(b,p.shape,p.x,p.y+1)){lastMoveWasRotation.current=false; setCurrent(prev=>({...prev,y:prev.y+1}));}
      else settle(p,b);
    },delay);
    return()=>clearInterval(id);
  },[started,gameOver,paused,current,level,clearing,settle]);

  // Actions
  const moveLeft = useCallback(()=>{
    const{paused:pa,current:p,board:b,clearing:cl}=live.current;
    if(pa||cl||!p) return;
    if(isValid(b,p.shape,p.x-1,p.y)){setCurrent(prev=>({...prev,x:prev.x-1}));lastMoveWasRotation.current=false;}
  },[]);
  const moveRight = useCallback(()=>{
    const{paused:pa,current:p,board:b,clearing:cl}=live.current;
    if(pa||cl||!p) return;
    if(isValid(b,p.shape,p.x+1,p.y)){setCurrent(prev=>({...prev,x:prev.x+1}));lastMoveWasRotation.current=false;}
  },[]);
  const moveDown = useCallback(()=>{
    const{paused:pa,current:p,board:b,clearing:cl}=live.current;
    if(pa||cl||!p) return;
    if(isValid(b,p.shape,p.x,p.y+1)){setCurrent(prev=>({...prev,y:prev.y+1}));lastMoveWasRotation.current=false;}
    else settle(p,b);
  },[settle]);
  const rotate = useCallback(()=>{
    const{paused:pa,current:p,board:b,clearing:cl}=live.current;
    if(pa||cl||!p) return;
    const rot=rotateCW(p.shape);
    for(const dx of[0,-1,1,-2,2]) if(isValid(b,rot,p.x+dx,p.y)){setCurrent(prev=>({...prev,shape:rot,x:prev.x+dx}));lastMoveWasRotation.current=true;break;}
  },[]);
  const hardDrop = useCallback(()=>{
    const{paused:pa,current:p,board:b,clearing:cl}=live.current;
    if(pa||cl||!p) return;
    let gy=p.y; while(isValid(b,p.shape,p.x,gy+1)) gy++;
    settle({...p,y:gy},b);
  },[settle]);
  const holdPiece = useCallback(()=>{
    const{paused:pa,current:p,board:b,clearing:cl,heldPiece:h,hasSwapped:hs}=live.current;
    if(pa||cl||!p||hs) return;
    setHasSwapped(true);
    if(h){
      const nc={...h,x:Math.floor(COLS/2)-Math.ceil(h.shape[0].length/2),y:0};
      if(isValid(b,nc.shape,nc.x,nc.y)){setCurrent(nc);setHeldPiece({...p,x:0,y:0});}
    } else { setHeldPiece({...p,x:0,y:0}); spawnPiece(b); }
  },[spawnPiece]);
  const togglePause = useCallback(()=>{ if(!gameOver) setPaused(v=>!v); },[gameOver]);

  // Keyboard
  useEffect(()=>{
    if(!started||gameOver) return;
    const onKey=e=>{
      if(e.key==="Escape"){togglePause();return;}
      if(e.key==="ArrowLeft") moveLeft();
      else if(e.key==="ArrowRight") moveRight();
      else if(e.key==="ArrowDown") moveDown();
      else if(e.key==="ArrowUp"||e.key==="z"||e.key==="Z") rotate();
      else if(e.key===" "){e.preventDefault();hardDrop();}
      else if(e.key==="c"||e.key==="C") holdPiece();
    };
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[started,gameOver,moveLeft,moveRight,moveDown,rotate,hardDrop,holdPiece,togglePause]);

  const startGame=()=>{
    fillBag(); const b=createBoard(),p=nextFromBag();
    setBoard(b);setCurrent(p);setNext(nextFromBag());
    setScore(0);setLines(0);setLevel(1);setCombo(0);
    setGameOver(false);setStarted(true);setPaused(false);
    setClearRows([]);setClearing(false);setPopups([]);
    setHeldPiece(null);setHasSwapped(false);
  };

  // Build display
  const ghost=(current&&!gameOver&&!clearing)?getGhost(board,current):null;
  const displayBoard=board.map(r=>[...r]);
  if(ghost) ghost.shape.forEach((row,r)=>row.forEach((cell,c)=>{
    if(!cell)return; const nr=ghost.y+r,nc=ghost.x+c;
    if(nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&!displayBoard[nr][nc]) displayBoard[nr][nc]="__ghost__";
  }));
  if(current&&!gameOver) current.shape.forEach((row,r)=>row.forEach((cell,c)=>{
    if(!cell)return; const nr=current.y+r,nc=current.x+c;
    if(nr>=0&&nr<ROWS&&nc>=0&&nc<COLS) displayBoard[nr][nc]=current.key;
  }));

  const BW=COLS*cellSize, BH=ROWS*cellSize;
  const newHi=score>0&&score>=hiScore;
  const comboActive=combo>1;
  const D=isDarkMode;

  // Touch controls props
  const ctrlProps = { onLeft:moveLeft, onRight:moveRight, onDown:moveDown, onRotate:rotate, onHardDrop:hardDrop, onHold:holdPiece, onPause:togglePause, isDark:D, isMobile };

  // Board element
  const boardEl = (
    <div style={{position:"relative",background:D?"rgba(0,0,0,0.4)":"rgba(255,255,255,0.35)",border:`1px solid ${D?"rgba(80,100,120,0.5)":"rgba(180,220,228,0.6)"}`,borderRadius:8,boxShadow:"0 8px 32px rgba(0,80,100,0.12), inset 0 1px 0 rgba(255,255,255,0.8)",overflow:"hidden",backdropFilter:"blur(4px)"}}>
      <svg width={BW} height={BH} style={{display:"block"}}>
        <SvgDefs/>
        {Array.from({length:ROWS+1},(_,i)=>(<line key={`h${i}`} x1={0} y1={i*cellSize} x2={BW} y2={i*cellSize} stroke="rgba(100,160,180,0.12)" strokeWidth={1}/>))}
        {Array.from({length:COLS+1},(_,i)=>(<line key={`v${i}`} x1={i*cellSize} y1={0} x2={i*cellSize} y2={BH} stroke="rgba(100,160,180,0.12)" strokeWidth={1}/>))}
        {displayBoard.map((row,ri)=>row.map((cell,ci)=>{
          if(!cell)return null;
          const isGhost=cell==="__ghost__";
          const key=isGhost?(current?.key||"I"):cell;
          return <GlassTile key={`${ri}-${ci}`} cx={ci*cellSize} cy={ri*cellSize} tileKey={key} ghost={isGhost} flash={clearRows.includes(ri)} size={cellSize}/>;
        }))}
      </svg>
      <ScorePopup popups={popups} cellSize={cellSize}/>
      {(!started||gameOver||paused)&&(
        <div style={{position:"absolute",inset:0,background:D?"rgba(20,30,40,0.88)":"rgba(230,242,245,0.88)",backdropFilter:"blur(12px)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,animation:"fadeUp 0.25s ease"}}>
          {gameOver?(
            <>
              <div style={{fontSize:9,letterSpacing:6,color:D?"rgba(200,220,230,0.4)":"rgba(60,100,110,0.4)"}}>— GAME OVER —</div>
              <div style={{fontSize:38,fontWeight:900,color:D?"#88DDEE":"#1A5060",letterSpacing:4}}>OVER</div>
              <div style={{fontSize:9,color:D?"rgba(200,220,230,0.4)":"rgba(60,100,110,0.4)",letterSpacing:3}}>FINAL SCORE</div>
              <div style={{fontSize:26,fontWeight:900,color:"#8A6010"}}>{score.toString().padStart(8,"0")}</div>
              {newHi&&<div style={{fontSize:9,color:"#A07020",letterSpacing:4}}>✦ NEW HI-SCORE ✦</div>}
              <button className="glass-btn" onClick={startGame} style={{marginTop:6}}>RETRY</button>
            </>
          ):paused?(
            <>
              <div style={{fontSize:24,fontWeight:900,color:D?"#88DDEE":"#1A6070",letterSpacing:8}}>PAUSED</div>
              <button className="glass-btn" onClick={()=>setPaused(false)}>RESUME</button>
            </>
          ):(
            <>
              <div style={{fontSize:9,letterSpacing:8,color:D?"rgba(200,220,230,0.4)":"rgba(60,100,110,0.4)"}}>— ARCADE EDITION —</div>
              <div style={{fontSize:isMobile?36:46,fontWeight:900,letterSpacing:4,background:"linear-gradient(135deg,#2A9090,#5BC4C4 40%,#A09050 70%,#C8B878)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>TETRIS</div>
              <div style={{display:"flex",gap:4,margin:"4px 0"}}>
                {["I","S","O","T","L"].map(k=>(<svg key={k} width={24} height={24} style={{overflow:"visible"}}><SvgDefs/><GlassTile cx={0} cy={0} tileKey={k} size={24}/></svg>))}
              </div>
              <button className="glass-btn" onClick={startGame} style={{marginTop:8}}>START GAME</button>
            </>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div style={{
      minHeight:"100vh",
      background:D?"linear-gradient(145deg,#1A2228,#182838,#151A22,#0A121A)":"linear-gradient(145deg,#E8F2F5 0%,#D0E8EC 35%,#E4EEF0 65%,#F0EBE0 100%)",
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",
      fontFamily:"'Courier New',monospace",
      overflowX:"hidden",
      paddingBottom: isMobile ? 0 : 20,
    }}>
      <style>{`
        @keyframes popFloat{0%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}60%{opacity:1;transform:translateX(-50%) translateY(-32px) scale(1.08)}100%{opacity:0;transform:translateX(-50%) translateY(-56px) scale(0.9)}}
        @keyframes scoreJump{0%,100%{transform:scale(1)}40%{transform:scale(1.2)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .glass-btn{
          cursor:pointer;border-radius:24px;
          font-family:'Courier New',monospace;font-size:11px;
          letter-spacing:4px;padding:10px 28px;text-transform:uppercase;
          transition:all 0.2s;
          background:${D?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.7)"};
          border:1px solid ${D?"rgba(255,255,255,0.2)":"rgba(100,180,190,0.5)"};
          color:${D?"#AADDFF":"#2A7080"};
          box-shadow:0 2px 12px rgba(0,100,120,0.15),inset 0 1px 0 rgba(255,255,255,0.9);
          backdrop-filter:blur(8px);
          touch-action:none;
          -webkit-tap-highlight-color:transparent;
        }
        .glass-btn:hover{background:${D?"rgba(255,255,255,0.2)":"rgba(255,255,255,0.9)"};box-shadow:0 4px 20px rgba(0,100,120,0.25),inset 0 1px 0 rgba(255,255,255,1);transform:translateY(-1px);}
      `}</style>

      {/* Dark mode toggle */}
      <button className="glass-btn" onClick={()=>setIsDarkMode(p=>!p)}
        style={{position:"fixed",top:12,right:12,zIndex:200,padding:"6px 14px",fontSize:10}}>
        {D?"☀ LIGHT":"🌙 DARK"}
      </button>

      {/* ═══════════════ MOBILE LAYOUT ═══════════════ */}
      {isMobile ? (
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",width:"100vw",padding:"8px 8px 0",boxSizing:"border-box",paddingTop:44}}>
          {/* Info strip */}
          <MobileInfoStrip score={score} level={level} next={next} heldPiece={heldPiece} isDark={D}/>
          {/* Board */}
          {boardEl}
          {/* Controls — always visible so user can interact */}
          <div style={{width:"100%",padding:"10px 8px 12px",boxSizing:"border-box",display:"flex",justifyContent:"center"}}>
            <TouchControls {...ctrlProps}/>
          </div>
        </div>
      ) : (
        /* ═══════════════ DESKTOP LAYOUT ═══════════════ */
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",paddingTop:20}}>
          <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>

            {/* LEFT PANEL */}
            <div style={{display:"flex",flexDirection:"column",gap:10,width:170}}>
              <Card accent="#C8A030" glow={newHi} isDark={D}>
                <Label isDark={D}>HI-SCORE</Label>
                <BigNum value={hiScore.toString().padStart(8,"0")} color={newHi?"#8A6010":"rgba(60,100,110,0.4)"} size={14} isDark={D}/>
                {newHi&&<div style={{fontSize:8,color:"#A07020",letterSpacing:3,marginTop:3}}>✦ NEW RECORD</div>}
              </Card>
              <Card glow={scoreFlash} accent="rgba(0,150,180,0.5)" isDark={D}>
                <Label isDark={D}>SCORE</Label>
                <BigNum value={score.toString().padStart(8,"0")} color="#1A6070" size={17} flash={scoreFlash} isDark={D}/>
              </Card>
              <Card isDark={D}>
                <Label isDark={D}>LINES</Label>
                <BigNum value={lines.toString().padStart(4,"0")} color="#2A8A70" isDark={D}/>
              </Card>
              <Card accent={comboActive?"rgba(160,120,0,0.4)":undefined} glow={comboActive} isDark={D}>
                <Label isDark={D}>COMBO</Label>
                <div style={{display:"flex",alignItems:"baseline",gap:6}}>
                  <BigNum value={combo} color={comboActive?"#8A6010":"rgba(60,100,110,0.2)"} size={32} isDark={D}/>
                  {comboActive&&<span style={{fontSize:11,color:"#8A6010",letterSpacing:2}}>×{combo}</span>}
                </div>
                {comboActive&&<div style={{fontSize:8,color:"#A07030",letterSpacing:2,marginTop:2}}>MULTIPLIER ACTIVE</div>}
              </Card>
              {/* Hold */}
              <Card isDark={D}>
                <Label isDark={D}>HOLD  (C)</Label>
                <PiecePreview piece={heldPiece} sz={22}/>
              </Card>
            </div>

            {/* BOARD */}
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
              <div style={{textAlign:"center",fontSize:11,letterSpacing:10,color:D?"rgba(200,220,230,0.35)":"rgba(40,100,110,0.35)",fontWeight:700}}>TETRIS</div>
              {boardEl}
              {/* Desktop click controls below board */}
              {started && !gameOver && (
                <TouchControls {...ctrlProps}/>
              )}
            </div>

            {/* RIGHT PANEL */}
            <div style={{display:"flex",flexDirection:"column",gap:10,width:170}}>
              <Card accent={next?PALETTE[next.key]?.base:"transparent"} glow={!!next} isDark={D}>
                <Label isDark={D}>NEXT PIECE</Label>
                <PiecePreview piece={next} sz={22}/>
                {next&&<div style={{textAlign:"center",fontSize:9,letterSpacing:4,marginTop:4,color:PALETTE[next.key]?.mid||(D?"#AADDFF":"#2A7080")}}>{next.key}-PIECE</div>}
              </Card>
              <LevelBar lines={lines} level={level} isDark={D}/>
              <Card isDark={D}>
                <Label isDark={D}>SPEED</Label>
                <div style={{display:"flex",gap:3,marginTop:4}}>
                  {Array.from({length:10},(_,i)=>{
                    const on=i<Math.min(level,10);
                    const sc=["#3AACAC","#2A8A8A","#C8B878","#8AAAB8","#5A8080","#4A7090","#3AACAC","#2A8A8A","#C8B878","#1A4070"];
                    return <div key={i} style={{flex:1,height:20,borderRadius:3,background:on?sc[i]:(D?"rgba(255,255,255,0.08)":"rgba(0,80,100,0.08)"),opacity:on?0.85:1,boxShadow:on?`0 1px 4px ${sc[i]}66`:"none",transition:"all 0.3s",border:on?"none":`1px solid ${D?"rgba(255,255,255,0.1)":"rgba(0,80,100,0.1)"}`}}/>;
                  })}
                </div>
              </Card>
              <ScoringCard isDark={D}/>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
