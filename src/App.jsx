import { useState, useEffect, useCallback, useRef } from "react";

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const COLS = 10;
const ROWS = 20;
const LINE_SCORES = [0, 100, 300, 500, 800, 800, 1200];
const LINE_NAMES  = ["", "SINGLE", "DOUBLE", "TRIPLE", "TETRIS!", "T-SPIN SINGLE", "T-SPIN DOUBLE"];
const T_SPIN_BONUS = 400;
const CLEAR_MS    = 340;

// 이미지의 유리 버블 타일 색상 팔레트
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

// ── GLASS BUBBLE TILE ─────────────────────────────────────────────────────────
// SVG defs — 각 색상별 그라디언트를 정의
function SvgDefs() {
  return (
    <defs>
      {/* 타일 외곽 프레임 그라디언트 (플라스틱 테두리) */}
      <linearGradient id="frameGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"   stopColor="rgba(255,255,255,0.55)"/>
        <stop offset="40%"  stopColor="rgba(255,255,255,0.15)"/>
        <stop offset="100%" stopColor="rgba(180,180,180,0.25)"/>
      </linearGradient>

      {Object.entries(PALETTE).map(([key, p]) => (
        <g key={key}>
          {/* 버블 돔 베이스 */}
          <radialGradient id={`dome_${key}`} cx="42%" cy="38%" r="55%" fx="38%" fy="34%">
            <stop offset="0%"   stopColor={p.shine}/>
            <stop offset="28%"  stopColor={p.base} stopOpacity="0.92"/>
            <stop offset="65%"  stopColor={p.mid}  stopOpacity="0.95"/>
            <stop offset="100%" stopColor={p.deep} stopOpacity="1"/>
          </radialGradient>
          {/* 유리 반사 하이라이트 */}
          <radialGradient id={`shine_${key}`} cx="35%" cy="28%" r="45%">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.9)"/>
            <stop offset="50%"  stopColor="rgba(255,255,255,0.3)"/>
            <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
          </radialGradient>
          {/* 타일 배경 틴트 */}
          <radialGradient id={`bg_${key}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={p.base} stopOpacity="0.22"/>
            <stop offset="100%" stopColor={p.base} stopOpacity="0.06"/>
          </radialGradient>
        </g>
      ))}

      {/* 고스트 그라디언트 */}
      <radialGradient id="ghost_dome" cx="42%" cy="38%" r="55%">
        <stop offset="0%"   stopColor="rgba(255,255,255,0.4)"/>
        <stop offset="100%" stopColor="rgba(180,200,220,0.15)"/>
      </radialGradient>

      {/* 드롭 섀도우 필터 */}
      <filter id="tileShad" x="-15%" y="-15%" width="130%" height="130%">
        <feDropShadow dx="1" dy="2" stdDeviation="2" floodColor="rgba(0,0,0,0.22)"/>
      </filter>
      <filter id="glowFilter" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
  );
}

// 유리 버블 타일 한 칸
function GlassTile({ cx, cy, tileKey, ghost=false, flash=false, size }) {
  const p = PALETTE[tileKey] || PALETTE.I;
  const pad = 1.5;
  const inner = size - pad*2;
  const cr = 4; // corner radius
  const bx = cx+pad, by = cy+pad;

  if (flash) return (
    <rect x={bx} y={by} width={inner} height={inner} fill="rgba(255,255,255,0.9)" rx={cr}/>
  );

  if (ghost) return (
    <g>
      {/* 프레임 */}
      <rect x={bx} y={by} width={inner} height={inner} fill="none"
        stroke="rgba(255,255,255,0.45)" strokeWidth={2} rx={cr}/>
    </g>
  );

  const cx2=cx+size/2, cy2=cy+size/2;
  const br=inner*0.40;  // bubble radius

  return (
    <g filter="url(#tileShad)">
      {/* 타일 배경 (반투명 틴트) */}
      <rect x={bx} y={by} width={inner} height={inner}
        fill={`url(#bg_${tileKey})`} rx={cr}/>

      {/* 플라스틱 프레임 테두리 */}
      <rect x={bx} y={by} width={inner} height={inner}
        fill="none" stroke="url(#frameGrad)" strokeWidth={1.2} rx={cr}/>

      {/* 버블 돔 */}
      <ellipse cx={cx2} cy={cy2} rx={br} ry={br}
        fill={`url(#dome_${tileKey})`}/>

      {/* 버블 테두리 (반투명) */}
      <ellipse cx={cx2} cy={cy2} rx={br} ry={br}
        fill="none" stroke={p.mid} strokeWidth={0.8} opacity={0.5}/>

      {/* 하이라이트 (렌즈 반사) */}
      <ellipse cx={cx+size*0.36} cy={cy+size*0.32}
        rx={br*0.55} ry={br*0.38}
        fill={`url(#shine_${tileKey})`} opacity={0.88}/>

      {/* 하단 미세 반사 */}
      <ellipse cx={cx2} cy={cy+size*0.72}
        rx={br*0.3} ry={br*0.12}
        fill="rgba(255,255,255,0.2)"/>

      {/* 프레임 내부 모서리 인셋 하이라이트 */}
      <rect x={bx+2} y={by+2} width={inner-4} height={3}
        fill="rgba(255,255,255,0.4)" rx={1}/>
      <rect x={bx+2} y={by+2} width={3} height={inner-4}
        fill="rgba(255,255,255,0.25)" rx={1}/>
    </g>
  );
}

// 미니 프리뷰용 타일 (Next 패널)
function MiniTile({ cx, cy, tileKey, size=22 }) {
  const p = PALETTE[tileKey];
  const pad=1, inner=size-pad*2, cr=3;
  const cx2=cx+size/2, cy2=cy+size/2, br=inner*0.38;
  return (
    <g>
      <rect x={cx+pad} y={cy+pad} width={inner} height={inner}
        fill={`url(#bg_${tileKey})`} rx={cr}/>
      <rect x={cx+pad} y={cy+pad} width={inner} height={inner}
        fill="none" stroke="url(#frameGrad)" strokeWidth={1} rx={cr}/>
      <ellipse cx={cx2} cy={cy2} rx={br} ry={br} fill={`url(#dome_${tileKey})`}/>
      <ellipse cx={cx+size*0.36} cy={cy+size*0.32}
        rx={br*0.52} ry={br*0.36} fill={`url(#shine_${tileKey})`} opacity={0.82}/>
    </g>
  );
}

// ── HOLD & NEXT PIECE PREVIEWS ────────────────────────────────────────────────
function HoldPreview({ piece }) {
  const SZ=24, maxW=4, maxH=2;
  const W=maxW*SZ, H=(maxH+0.5)*SZ;
  return (
    <svg width={W} height={H} style={{display:"block",margin:"0 auto",overflow:"visible"}}>
      <SvgDefs/>
      {piece && piece.shape.map((row,ri)=>row.map((cell,ci)=>{
        if (!cell) return null;
        const offX=Math.floor((maxW-piece.shape[0].length)/2);
        const offY=Math.floor((maxH-piece.shape.length)/2);
        return (
          <MiniTile key={`${ri}-${ci}`}
            cx={(ci+offX)*SZ} cy={(ri+offY)*SZ}
            tileKey={piece.key} size={SZ}/>
        );
      }))}
    </svg>
  );
}

function NextPreview({ piece }) {
  const SZ=24, maxW=4, maxH=2;
  if (!piece) return <div style={{height:70}}/>;
  const offX=Math.floor((maxW-piece.shape[0].length)/2);
  const offY=Math.floor((maxH-piece.shape.length)/2);
  const W=maxW*SZ, H=(maxH+0.5)*SZ;
  return (
    <svg width={W} height={H} style={{display:"block",margin:"0 auto",overflow:"visible"}}>
      <SvgDefs/>
      {piece.shape.map((row,ri)=>row.map((cell,ci)=>!cell?null:(
        <MiniTile key={`${ri}-${ci}`}
          cx={(ci+offX)*SZ} cy={(ri+offY)*SZ}
          tileKey={piece.key} size={SZ}/>
      )))}
    </svg>
  );
}

// ── UI COMPONENTS ─────────────────────────────────────────────────────────────
function Card({ children, accent, glow, style={} }) {
  const col = accent||"rgba(180,210,220,0.3)";
  return (
    <div style={{
      background:"rgba(255,255,255,0.55)",
      border:`1px solid ${glow?col:"rgba(180,210,220,0.5)"}`,
      borderRadius:10,
      padding:"10px 14px",
      backdropFilter:"blur(8px)",
      boxShadow: glow
        ? `0 4px 20px ${col}88, inset 0 1px 0 rgba(255,255,255,0.8)`
        : "0 2px 8px rgba(0,60,80,0.08), inset 0 1px 0 rgba(255,255,255,0.7)",
      transition:"all 0.3s",
      ...style,
    }}>
      {children}
    </div>
  );
}

function Label({ children }) {
  return <div style={{fontSize:9,letterSpacing:4,color:"rgba(60,100,110,0.5)",marginBottom:5,textTransform:"uppercase"}}>{children}</div>;
}

function BigNum({ value, color="#1A5060", size=22, flash=false }) {
  return (
    <div style={{
      fontSize:size, fontWeight:900, letterSpacing:2, color,
      fontFamily:"'Courier New',monospace",
      textShadow:`0 1px 0 rgba(255,255,255,0.8)`,
      animation:flash?"scoreJump 0.4s ease":"none",
    }}>{value}</div>
  );
}

function LevelBar({ lines, level }) {
  const pct=(lines%10)/10*100;
  const cols=["#3AACAC","#2A8A8A","#C8B878","#8AAAB8","#5A8080","#4A7090"];
  const col=cols[(level-1)%cols.length];
  return (
    <Card>
      <Label>LEVEL</Label>
      <BigNum value={String(level).padStart(2,"0")} color={col} size={28}/>
      <div style={{marginTop:8,height:6,background:"rgba(0,80,100,0.1)",borderRadius:3,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${pct}%`,background:col,borderRadius:3,transition:"width 0.3s ease",opacity:0.8}}/>
      </div>
      <div style={{display:"flex",gap:3,marginTop:5}}>
        {Array.from({length:10},(_,i)=>(
          <div key={i} style={{
            flex:1,height:3,borderRadius:2,
            background:i<lines%10?col:"rgba(0,80,100,0.12)",
            transition:"all 0.2s",
          }}/>
        ))}
      </div>
      <div style={{fontSize:9,color:"rgba(60,100,110,0.45)",marginTop:4,letterSpacing:2}}>
        {10-lines%10} to next
      </div>
    </Card>
  );
}

function ControlsCard() {
  const keys=[["← →","이동"],["↑  Z","회전"],["↓","소프트"],["SPC","하드 드롭"],["C","홀드"],["ESC","일시정지"]];
  return (
    <Card>
      <Label>CONTROLS</Label>
      {keys.map(([k,v])=>(
        <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <kbd style={{
            background:"rgba(255,255,255,0.7)",border:"1px solid rgba(100,160,180,0.3)",
            borderRadius:3,padding:"1px 7px",fontSize:9,
            color:"#2A7080",fontFamily:"'Courier New',monospace",letterSpacing:1,
            boxShadow:"0 1px 0 rgba(0,0,0,0.1)",
          }}>{k}</kbd>
          <span style={{fontSize:9,color:"rgba(60,100,110,0.45)",letterSpacing:1}}>{v}</span>
        </div>
      ))}
    </Card>
  );
}

function ScoringCard() {
  return (
    <Card>
      <Label>SCORING</Label>
      {[["1-LINE","100"],["2-LINE","300"],["3-LINE","500"],["TETRIS","800"]].map(([k,v])=>(
        <div key={k} style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
          <span style={{fontSize:9,color:k==="TETRIS"?"#A07020":"rgba(60,100,110,0.5)",letterSpacing:2}}>{k}</span>
          <span style={{fontSize:9,color:"rgba(60,100,110,0.4)",letterSpacing:1}}>{v} pts</span>
        </div>
      ))}
      <div style={{fontSize:8,color:"rgba(60,100,110,0.3)",marginTop:4,letterSpacing:1}}>× combo multiplier</div>
    </Card>
  );
}

// ── SCORE POPUP ───────────────────────────────────────────────────────────────
function ScorePopup({ popups, cellSize }) {
  return (
    <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:20}}>
      {popups.map(p=>(
        <div key={p.id} style={{
          position:"absolute",left:"50%",top:p.row*cellSize,
          transform:"translateX(-50%)",
          color:p.tSpin ? "#A040A0" : (p.count===4?"#8A6010":"#2A6070"),
          fontSize:p.tSpin ? 16 : (p.count===4?18:13),
          fontFamily:"'Courier New',monospace",
          fontWeight:900,letterSpacing:3,
          textShadow:p.tSpin ? "0 2px 8px rgba(160,64,160,0.4)" : (p.count===4?"0 2px 8px rgba(160,120,0,0.4)":"0 2px 6px rgba(0,100,120,0.3)"),
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

// ── MAIN GAME ─────────────────────────────────────────────────────────────────
export default function Tetris() {
  const [board, setBoard]         = useState(createBoard());
  const [current, setCurrent]     = useState(null);
  const [next, setNext]           = useState(null);
  const [heldPiece, setHeldPiece] = useState(null);
  const [hasSwapped, setHasSwapped] = useState(false);
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
  const [cellSize, setCellSize] = useState(34);

  const live = useRef({});
  const bagRef = useRef([]);
  const lastMoveWasRotation = useRef(false);

  const fillBag = useCallback(() => {
    let newBag = [...PIECE_KEYS];
    for (let i = newBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newBag[i], newBag[j]] = [newBag[j], newBag[i]];
    }
    bagRef.current = newBag;
  }, []);

  const nextPieceFromBag = useCallback(() => {
    if (bagRef.current.length === 0) {
      fillBag();
    }
    return createPiece(bagRef.current.pop());
  }, [fillBag]);

  live.current = {board,current,gameOver,paused,clearing,combo,heldPiece,hasSwapped,lastMoveWasRotation:lastMoveWasRotation.current};

  useEffect(() => {
    const handleResize = () => {
      const newCellSize = Math.floor(window.innerHeight * 0.8 / ROWS);
      setCellSize(newCellSize);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const spawnPiece = useCallback((b) => {
    setNext(prev => {
      const piece = prev||nextPieceFromBag();
      if (!isValid(b,piece.shape,piece.x,piece.y)) { setGameOver(true); return prev; }
      setCurrent(piece);
      lastMoveWasRotation.current = false;
      return nextPieceFromBag();
    });
  }, [nextPieceFromBag]);

  const settle = useCallback((piece, b) => {
    const locked = lockPiece(b,piece);
    setHasSwapped(false);

    let tSpin = false;
    if (piece.key === 'T' && lastMoveWasRotation.current) {
      const corners = [
        [piece.y, piece.x],
        [piece.y, piece.x + 2],
        [piece.y + 2, piece.x],
        [piece.y + 2, piece.x + 2]
      ];
      let occupiedCorners = 0;
      corners.forEach(([y, x]) => {
        if (y >= ROWS || x < 0 || x >= COLS || (b[y] && b[y][x])) {
          occupiedCorners++;
        }
      });
      if (occupiedCorners >= 3) {
        tSpin = true;
      }
    }

    const full = findFullRows(locked);
    if (full.length > 0) {
      setClearing(true); setClearRows(full);
      setTimeout(()=>{
        const nb=removeLines(locked,full);
        const count=full.length;
        setBoard(nb); setClearRows([]); setClearing(false);
        setLines(prev=>{const nl=prev+count;setLevel(Math.floor(nl/10)+1);return nl;});
        setCombo(prev=>{
          const nc2=prev+1;
          let scoreIndex = count;
          if (tSpin) {
            if (count === 1) scoreIndex = 5; // T-Spin Single
            if (count === 2) scoreIndex = 6; // T-Spin Double
          }
          const pts = (tSpin ? T_SPIN_BONUS : 0) + LINE_SCORES[scoreIndex] * nc2;
          setScore(s=>{const ns=s+pts;setHiScore(h=>Math.max(h,ns));return ns;});
          setScoreFlash(true); setTimeout(()=>setScoreFlash(false),500);
          const tr=Math.min(...full);
          setPopups(ps=>[...ps,{id:Date.now(),count,bonus:nc2,row:tr,tSpin}]);
          setTimeout(()=>setPopups(ps=>ps.slice(1)),1000);
          return nc2;
        });
        spawnPiece(nb);
      },CLEAR_MS);
    } else {
      if (tSpin) { // T-Spin with no lines cleared
        const pts = T_SPIN_BONUS;
        setScore(s=>{const ns=s+pts;setHiScore(h=>Math.max(h,ns));return ns;});
        setScoreFlash(true); setTimeout(()=>setScoreFlash(false),500);
        setPopups(ps=>[...ps,{id:Date.now(),count:0,bonus:1,row:piece.y,tSpin}]);
        setTimeout(()=>setPopups(ps=>ps.slice(1)),1000);
      }
      setBoard(locked); setCombo(0); spawnPiece(locked);
    }
  },[spawnPiece]);

  useEffect(()=>{
    if (!started||gameOver||paused||!current||clearing) return;
    const delay=Math.max(80,800-(level-1)*72);
    const id=setInterval(()=>{
      const {current:p,board:b,gameOver:go,paused:pa,clearing:cl}=live.current;
      if (!p||go||pa||cl) return;
      if (isValid(b,p.shape,p.x,p.y+1)) {
        lastMoveWasRotation.current = false;
        setCurrent(prev=>({...prev,y:prev.y+1}));
      }
      else settle(p,b);
    },delay);
    return ()=>clearInterval(id);
  },[started,gameOver,paused,current,level,clearing,settle]);

  useEffect(()=>{
    if (!started||gameOver) return;
    const onKey=e=>{
      const {paused:pa,current:p,board:b,clearing:cl,heldPiece:h,hasSwapped:hs}=live.current;
      if (e.key==="Escape"){setPaused(v=>!v);return;}
      if (pa||cl||!p) return;
      if (e.key==="ArrowLeft") {
        if(isValid(b,p.shape,p.x-1,p.y)) {
          setCurrent(prev=>({...prev,x:prev.x-1}));
          lastMoveWasRotation.current = false;
        }
      }
      else if (e.key==="ArrowRight") {
        if(isValid(b,p.shape,p.x+1,p.y)) {
          setCurrent(prev=>({...prev,x:prev.x+1}));
          lastMoveWasRotation.current = false;
        }
      }
      else if (e.key==="ArrowDown") {
        if(isValid(b,p.shape,p.x,p.y+1)) {
          setCurrent(prev=>({...prev,y:prev.y+1}));
          lastMoveWasRotation.current = false;
        } else settle(p,b);
      } else if (e.key==="ArrowUp"||e.key==="z"||e.key==="Z") {
        const rot=rotateCW(p.shape);
        for (const dx of [0,-1,1,-2,2]) {
          if(isValid(b,rot,p.x+dx,p.y)){
            setCurrent(prev=>({...prev,shape:rot,x:prev.x+dx}));
            lastMoveWasRotation.current = true;
            break;
          }
        }
      } else if (e.key===" ") {
        e.preventDefault();
        let gy=p.y; while(isValid(b,p.shape,p.x,gy+1)) gy++;
        settle({...p,y:gy},b);
      } else if ((e.key==="c"||e.key==="C")&&!hs) {
        setHasSwapped(true);
        if (h) {
          const newCurrent = { ...h, x: Math.floor(COLS/2)-Math.ceil(h.shape[0].length/2), y: 0 };
          const newHeld = { ...p, x: 0, y: 0 };
          if (isValid(b, newCurrent.shape, newCurrent.x, newCurrent.y)) {
            setCurrent(newCurrent);
            setHeldPiece(newHeld);
          }
        } else {
          setHeldPiece({ ...p, x: 0, y: 0 });
          spawnPiece(b);
        }
      }
    };
    window.addEventListener("keydown",onKey);
    return ()=>window.removeEventListener("keydown",onKey);
  },[started,gameOver,settle,spawnPiece]);

  const startGame=()=>{
    fillBag();
    const b=createBoard();
    const p=nextPieceFromBag();
    setBoard(b);setCurrent(p);setNext(nextPieceFromBag());
    setScore(0);setLines(0);setLevel(1);setCombo(0);
    setGameOver(false);setStarted(true);setPaused(false);
    setClearRows([]);setClearing(false);setPopups([]);
    setHeldPiece(null);setHasSwapped(false);
  };

  // build display board
  const ghost=(current&&!gameOver&&!clearing)?getGhost(board,current):null;
  const displayBoard=board.map(r=>[...r]);
  if (ghost) ghost.shape.forEach((row,r)=>row.forEach((cell,c)=>{
    if (!cell) return;
    const nr=ghost.y+r,nc=ghost.x+c;
    if (nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&!displayBoard[nr][nc]) displayBoard[nr][nc]="__ghost__";
  }));
  if (current&&!gameOver) current.shape.forEach((row,r)=>row.forEach((cell,c)=>{
    if (!cell) return;
    const nr=current.y+r,nc=current.x+c;
    if (nr>=0&&nr<ROWS&&nc>=0&&nc<COLS) displayBoard[nr][nc]=current.key;
  }));

  const BW=COLS*cellSize, BH=ROWS*cellSize;
  const newHi=score>0&&score>=hiScore;
  const comboActive=combo>1;

  return (
    <div style={{
      minHeight:"100vh",
      background:"linear-gradient(145deg,#E8F2F5 0%,#D0E8EC 35%,#E4EEF0 65%,#F0EBE0 100%)",
      display:"flex",alignItems:"center",justifyContent:"center",
      fontFamily:"'Courier New',monospace",
    }}>
      <style>{`
        @keyframes popFloat{0%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}60%{opacity:1;transform:translateX(-50%) translateY(-32px) scale(1.08)}100%{opacity:0;transform:translateX(-50%) translateY(-56px) scale(0.9)}}
        @keyframes scoreJump{0%,100%{transform:scale(1)}40%{transform:scale(1.2)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes tileWave{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
        .glass-btn{
          cursor:pointer;border-radius:24px;
          font-family:'Courier New',monospace;font-size:11px;
          letter-spacing:4px;padding:10px 28px;text-transform:uppercase;
          transition:all 0.2s;
          background:rgba(255,255,255,0.7);
          border:1px solid rgba(100,180,190,0.5);
          color:#2A7080;
          box-shadow:0 2px 12px rgba(0,100,120,0.15),inset 0 1px 0 rgba(255,255,255,0.9);
          backdrop-filter:blur(8px);
        }
        .glass-btn:hover{
          background:rgba(255,255,255,0.9);
          box-shadow:0 4px 20px rgba(0,100,120,0.25),inset 0 1px 0 rgba(255,255,255,1);
          transform:translateY(-1px);
        }
      `}</style>

      <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>

        {/* ══ LEFT PANEL ══ */}
        <div style={{display:"flex",flexDirection:"column",gap:10,width:158}}>

          {/* Hold Piece */}
          <Card accent={heldPiece?PALETTE[heldPiece.key]?.base:"transparent"} glow={!!heldPiece}>
            <Label>HOLD</Label>
            <HoldPreview piece={heldPiece} />
          </Card>

          {/* Hi-Score */}
          <Card accent="#C8A030" glow={newHi}>
            <Label>HI-SCORE</Label>
            <BigNum value={hiScore.toString().padStart(8,"0")} color={newHi?"#8A6010":"rgba(60,100,110,0.4)"} size={14}/>
            {newHi&&<div style={{fontSize:8,color:"#A07020",letterSpacing:3,marginTop:3}}>✦ NEW RECORD</div>}
          </Card>

          {/* Score */}
          <Card glow={scoreFlash} accent="rgba(0,150,180,0.5)">
            <Label>SCORE</Label>
            <BigNum value={score.toString().padStart(8,"0")} color="#1A6070" size={17} flash={scoreFlash}/>
          </Card>

          {/* Lines */}
          <Card>
            <Label>LINES</Label>
.
            <BigNum value={lines.toString().padStart(4,"0")} color="#2A8A70"/>
          </Card>

          {/* Combo */}
          <Card accent={comboActive?"rgba(160,120,0,0.4)":undefined} glow={comboActive}>
            <Label>COMBO</Label>
            <div style={{display:"flex",alignItems:"baseline",gap:6}}>
              <BigNum value={combo} color={comboActive?"#8A6010":"rgba(60,100,110,0.2)"} size={32}/>
              {comboActive&&<span style={{fontSize:11,color:"#8A6010",letterSpacing:2}}>×{combo}</span>}
            </div>
            {comboActive&&<div style={{fontSize:8,color:"#A07030",letterSpacing:2,marginTop:2}}>MULTIPLIER ACTIVE</div>}
          </Card>

          <div style={{flex:1}}/>
          <ControlsCard/>
        </div>

        {/* ══ BOARD ══ */}
        <div style={{display:"flex",flexDirection:"column"}}>
          {/* 타이틀 */}
          <div style={{
            textAlign:"center",fontSize:11,letterSpacing:10,
            color:"rgba(40,100,110,0.35)",marginBottom:8,
            fontWeight:700,
          }}>TETRIS</div>

          {/* 보드 컨테이너 */}
          <div style={{
            position:"relative",
            background:"rgba(255,255,255,0.35)",
            border:"1px solid rgba(180,220,228,0.6)",
            borderRadius:8,
            boxShadow:"0 8px 32px rgba(0,80,100,0.12), inset 0 1px 0 rgba(255,255,255,0.8)",
            overflow:"hidden",
            backdropFilter:"blur(4px)",
          }}>
            <svg width={BW} height={BH} style={{display:"block"}}>
              <SvgDefs/>

              {/* 그리드 라인 */}
              {Array.from({length:ROWS+1},(_,i)=>(
                <line key={`h${i}`} x1={0} y1={i*cellSize} x2={BW} y2={i*cellSize}
                  stroke="rgba(100,160,180,0.12)" strokeWidth={1}/>
              ))}
              {Array.from({length:COLS+1},(_,i)=>(
                <line key={`v${i}`} x1={i*cellSize} y1={0} x2={i*cellSize} y2={BH}
                  stroke="rgba(100,160,180,0.12)" strokeWidth={1}/>
              ))}

              {/* 셀 렌더링 */}
              {displayBoard.map((row,ri)=>row.map((cell,ci)=>{
                if (!cell) return null;
                const isGhost=cell==="__ghost__";
                const key=isGhost?(current?.key||"I"):cell;
                const isClearing=clearRows.includes(ri);
                return (
                  <GlassTile key={`${ri}-${ci}`}
                    cx={ci*cellSize} cy={ri*cellSize}
                    tileKey={key}
                    ghost={isGhost}
                    flash={isClearing}
                    size={cellSize}
                  />
                );
              }))}
            </svg>

            <ScorePopup popups={popups} cellSize={cellSize}/>

            {/* 오버레이 */}
            {(!started||gameOver||paused)&&(
              <div style={{
                position:"absolute",inset:0,
                background:"rgba(230,242,245,0.88)",
                backdropFilter:"blur(12px)",
                display:"flex",flexDirection:"column",alignItems:"center",
                justifyContent:"center",gap:16,
                animation:"fadeUp 0.25s ease",
              }}>
                {gameOver?(
                  <>
                    <div style={{fontSize:9,letterSpacing:6,color:"rgba(60,100,110,0.4)"}}>— GAME OVER —</div>
                    <div style={{
                      fontSize:38,fontWeight:900,color:"#1A5060",letterSpacing:4,
                      textShadow:"0 2px 0 rgba(255,255,255,0.9),0 4px 12px rgba(0,80,100,0.2)",
                    }}>OVER</div>
                    <div style={{fontSize:9,color:"rgba(60,100,110,0.4)",letterSpacing:3}}>FINAL SCORE</div>
                    <div style={{
                      fontSize:26,fontWeight:900,color:"#8A6010",
                      textShadow:"0 2px 0 rgba(255,255,255,0.9)",
                    }}>{score.toString().padStart(8,"0")}</div>
                    {newHi&&<div style={{fontSize:9,color:"#A07020",letterSpacing:4}}>✦ NEW HI-SCORE ✦</div>}
                    <button className="glass-btn" onClick={startGame} style={{marginTop:6}}>RETRY</button>
                  </>
                ):paused?(
                  <>
                    <div style={{fontSize:24,fontWeight:900,color:"#1A6070",letterSpacing:8,
                      textShadow:"0 2px 0 rgba(255,255,255,0.9)"}}>PAUSED</div>
                    <button className="glass-btn" onClick={()=>setPaused(false)}>RESUME</button>
                  </>
                ):(
                  <>
                    <div style={{fontSize:9,letterSpacing:8,color:"rgba(60,100,110,0.4)"}}>— ARCADE EDITION —</div>
                    <div style={{
                      fontSize:46,fontWeight:900,letterSpacing:4,
                      background:"linear-gradient(135deg,#2A9090,#5BC4C4 40%,#A09050 70%,#C8B878)",
                      WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",
                      textShadow:"none",
                      filter:"drop-shadow(0 3px 6px rgba(0,100,120,0.2))",
                    }}>TETRIS</div>
                    {/* 샘플 타일 장식 */}
                    <div style={{display:"flex",gap:4,margin:"4px 0"}}>
                      {["I","S","O","T","L"].map(k=>(
                        <svg key={k} width={28} height={28} style={{overflow:"visible"}}>
                          <SvgDefs/>
                          <GlassTile cx={0} cy={0} tileKey={k} size={28}/>
                        </svg>
                      ))}
                    </div>
                    <button className="glass-btn" onClick={startGame} style={{marginTop:8}}>START GAME</button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ══ RIGHT PANEL ══ */}
        <div style={{display:"flex",flexDirection:"column",gap:10,width:158}}>

          {/* NEXT PIECE */}
          <Card accent={next?PALETTE[next.key]?.base:"transparent"} glow={!!next}>
            <Label>NEXT PIECE</Label>
            <NextPreview piece={next}/>
            {next&&(
              <div style={{
                textAlign:"center",fontSize:9,letterSpacing:4,marginTop:4,
                color:PALETTE[next.key]?.mid||"#2A7080",
              }}>{next.key}-PIECE</div>
            )}
          </Card>

          {/* Level */}
          <LevelBar lines={lines} level={level}/>

          {/* Speed */}
          <Card>
            <Label>SPEED</Label>
            <div style={{display:"flex",gap:3,marginTop:4}}>
              {Array.from({length:10},(_,i)=>{
                const on=i<Math.min(level,10);
                const cols=["#3AACAC","#2A8A8A","#C8B878","#8AAAB8","#5A8080","#4A7090","#3AACAC","#2A8A8A","#C8B878","#1A4070"];
                return (
                  <div key={i} style={{
                    flex:1,height:20,borderRadius:3,
                    background:on?cols[i]:"rgba(0,80,100,0.08)",
                    opacity:on?0.85:1,
                    boxShadow:on?`0 1px 4px ${cols[i]}66`:"none",
                    transition:"all 0.3s",
                    border:on?"none":"1px solid rgba(0,80,100,0.1)",
                  }}/>
                );
              })}
            </div>
          </Card>

          <ScoringCard/>

          <div style={{flex:1}}/>

          {started&&!gameOver&&(
            <button className="glass-btn"
              onClick={()=>setPaused(v=>!v)}
              style={{fontSize:10,letterSpacing:3,padding:"8px",width:"100%"}}>
              {paused?"▶ RESUME":"⏸ PAUSE"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
