import fs from 'node:fs';

const file = process.argv[2] || 'index.html';
let h = fs.readFileSync(file, 'utf8');
const fail = m => { console.error('Error: ' + m); process.exit(1); };
if (h.includes('function pageVec(')) fail('vector extraction is already applied');
fs.writeFileSync(file + '.bak', h);

const VEC = String.raw`/* ---------- Elements: vector graphics ---------- */
const hx3=(r,g,b)=>'#'+[r,g,b].map(q=>Math.round(clamp(q,0,1)*255).toString(16).padStart(2,'0')).join('');
function vcol(a){
  if(!a.length) return null;
  if(a[a.length-1].t==='name') return '#808080';
  const v=a.filter(t=>t.t==='num').map(t=>t.v);
  if(v.length===1) return hx3(v[0],v[0],v[0]);
  if(v.length===3) return hx3(v[0],v[1],v[2]);
  if(v.length===4) return hx3((1-v[0])*(1-v[3]),(1-v[1])*(1-v[3]),(1-v[2])*(1-v[3]));
  return null;
}
const VPT={f:[1,0,0],F:[1,0,0],'f*':[1,0,1],S:[0,1,0],s:[0,1,0],B:[1,1,0],'B*':[1,1,1],b:[1,1,0],'b*':[1,1,1]};
async function pageVec(n,lim){
  if(lim==null) lim=60;
  const doc=await getXDoc(), pg=doc.getPage(n-1), mb=pg.getMediaBox(), paths=[];
  const run=async(b,res,ctm0,gs0,depth)=>{
    let ctm=ctm0.slice(), gs=Object.assign({},gs0), st=[], cur=[], bb=null, segs=0, curv=0, sp=null, cp=null;
    const reset=()=>{ cur=[]; bb=null; segs=0; curv=0; };
    const P=(x,y)=>{
      const X=ctm[0]*x+ctm[2]*y+ctm[4], Y=ctm[1]*x+ctm[3]*y+ctm[5];
      if(!bb) bb=[X,Y,X,Y]; else { if(X<bb[0]) bb[0]=X; if(Y<bb[1]) bb[1]=Y; if(X>bb[2]) bb[2]=X; if(Y>bb[3]) bb[3]=Y; }
      return [X,Y];
    };
    const add=(f,s,eo)=>{
      if(cur.length&&bb){
        const sc=Math.sqrt(Math.abs(ctm[0]*ctm[3]-ctm[1]*ctm[2]))||1, lw=Math.max(.25,gs.lw*sc), pad=s?lw/2:0;
        const w=bb[2]-bb[0], hh=bb[3]-bb[1];
        if(!(w>=.9*mb.width&&hh>=.9*mb.height)) paths.push({cmds:cur,bb:[bb[0]-pad,bb[1]-pad,bb[2]+pad,bb[3]+pad],fill:f?gs.fill:null,stroke:s?gs.stroke:null,lw,cap:gs.cap,join:gs.join,eo,segs,curv});
      }
      reset();
    };
    const ops=parseContent(b);
    for(let k=0;k<ops.length;k++){
      if(paths.length>=20000) return;
      if(k%2000===1999) await tick();
      const o=ops[k], a=o.args, v=i=>(a[i]&&a[i].v)||0;
      switch(o.op){
        case 'q': st.push([ctm.slice(),Object.assign({},gs)]); break;
        case 'Q': if(st.length){ const s=st.pop(); ctm=s[0]; gs=s[1]; } break;
        case 'cm': ctm=mmul([v(0),v(1),v(2),v(3),v(4),v(5)],ctm); break;
        case 'w': gs.lw=v(0); break;
        case 'J': gs.cap=v(0); break;
        case 'j': gs.join=v(0); break;
        case 'g': gs.fill=hx3(v(0),v(0),v(0)); break;
        case 'G': gs.stroke=hx3(v(0),v(0),v(0)); break;
        case 'rg': gs.fill=hx3(v(0),v(1),v(2)); break;
        case 'RG': gs.stroke=hx3(v(0),v(1),v(2)); break;
        case 'k': gs.fill=hx3((1-v(0))*(1-v(3)),(1-v(1))*(1-v(3)),(1-v(2))*(1-v(3))); break;
        case 'K': gs.stroke=hx3((1-v(0))*(1-v(3)),(1-v(1))*(1-v(3)),(1-v(2))*(1-v(3))); break;
        case 'sc': case 'scn': { const c=vcol(a); if(c) gs.fill=c; break; }
        case 'SC': case 'SCN': { const c=vcol(a); if(c) gs.stroke=c; break; }
        case 'm': cp=sp=P(v(0),v(1)); cur.push(['M',cp[0],cp[1]]); break;
        case 'l': cp=P(v(0),v(1)); cur.push(['L',cp[0],cp[1]]); segs++; break;
        case 'c': { const p1=P(v(0),v(1)), p2=P(v(2),v(3)), p3=P(v(4),v(5)); cur.push(['C',p1[0],p1[1],p2[0],p2[1],p3[0],p3[1]]); cp=p3; segs++; curv++; break; }
        case 'v': { const p2=P(v(0),v(1)), p3=P(v(2),v(3)), p1=cp||p2; cur.push(['C',p1[0],p1[1],p2[0],p2[1],p3[0],p3[1]]); cp=p3; segs++; curv++; break; }
        case 'y': { const p1=P(v(0),v(1)), p3=P(v(2),v(3)); cur.push(['C',p1[0],p1[1],p3[0],p3[1],p3[0],p3[1]]); cp=p3; segs++; curv++; break; }
        case 'h': cur.push(['Z']); cp=sp; break;
        case 're': { const x=v(0), y=v(1), w=v(2), hh=v(3), p0=P(x,y), p1=P(x+w,y), p2=P(x+w,y+hh), p3=P(x,y+hh);
          cur.push(['M',p0[0],p0[1]],['L',p1[0],p1[1]],['L',p2[0],p2[1]],['L',p3[0],p3[1]],['Z']); sp=cp=p0; segs+=4; break; }
        case 'n': reset(); break;
        case 'Do': {
          const nm=a[0]&&a[0].t==='name'?bstr(b,a[0].s+1,a[0].e):null; if(!nm||depth>=5) break;
          try{
            const xo=res&&res.lookupMaybe(N('XObject'),PDFDict)?.lookup(N(nm));
            if(xo instanceof PDFRawStream&&xo.dict.lookup(N('Subtype'))?.toString()==='/Form'){
              const ma=xo.dict.lookupMaybe(N('Matrix'),PDFArray), m=ma&&ma.size()>=6?[0,1,2,3,4,5].map(i=>nv(ma.lookup(i))):[1,0,0,1,0,0];
              await run(PDFLib.decodePDFRawStream(xo).decode(),xo.dict.lookupMaybe(N('Resources'),PDFDict)||res,mmul(m,ctm),gs,depth+1);
            }
          }catch(e){}
          break;
        }
        default: {
          const pt=VPT[o.op];
          if(pt){ if(o.op==='s'||o.op==='b'||o.op==='b*') cur.push(['Z']); add(!!pt[0],!!pt[1],!!pt[2]); }
        }
      }
    }
  };
  await run(pageBytes(pg),pg.node.Resources(),[1,0,0,1,0,0],{fill:'#000000',stroke:'#000000',lw:1,cap:0,join:0},0);
  const idx=paths.map((_,i)=>i).sort((x,y)=>paths[x].bb[0]-paths[y].bb[0]), par=paths.map((_,i)=>i), G=3;
  const find=i=>{ while(par[i]!==i){ par[i]=par[par[i]]; i=par[i]; } return i; };
  for(let i=0;i<idx.length;i++){
    if(i%500===499) await tick();
    const A=paths[idx[i]];
    for(let j=i+1;j<idx.length;j++){
      const B=paths[idx[j]]; if(B.bb[0]>A.bb[2]+G) break;
      if(B.bb[1]<=A.bb[3]+G&&B.bb[3]>=A.bb[1]-G){ const r1=find(idx[i]), r2=find(idx[j]); if(r1!==r2) par[r2]=r1; }
    }
  }
  const groups=new Map();
  paths.forEach((p,i)=>{
    const r=find(i); let g=groups.get(r);
    if(!g) groups.set(r,g={paths:[],bb:p.bb.slice(),segs:0,curv:0});
    g.paths.push(p); g.segs+=p.segs; g.curv+=p.curv;
    g.bb=[Math.min(g.bb[0],p.bb[0]),Math.min(g.bb[1],p.bb[1]),Math.max(g.bb[2],p.bb[2]),Math.max(g.bb[3],p.bb[3])];
  });
  const all=[...groups.values()].filter(g=>g.curv>0||g.segs>=6).sort((x,y)=>(y.bb[3]-x.bb[3])||(x.bb[0]-y.bb[0]));
  const out=all.slice(0,lim); out.more=Math.max(0,all.length-out.length); return out;
}
function vecSvg(cl){
  const f=q=>Math.round(q*100)/100, x0=cl.bb[0]-1, y1=cl.bb[3]+1, w=cl.bb[2]-cl.bb[0]+2, hh=cl.bb[3]-cl.bb[1]+2;
  const o=['<svg xmlns="http://www.w3.org/2000/svg" width="'+f(w)+'" height="'+f(hh)+'" viewBox="0 0 '+f(w)+' '+f(hh)+'">'];
  for(const p of cl.paths){
    let d='';
    for(const c of p.cmds){
      if(c[0]==='Z'){ d+='Z'; continue; }
      const nums=[]; for(let i=1;i<c.length;i+=2) nums.push(f(c[i]-x0),f(y1-c[i+1]));
      d+=c[0]+nums.join(' ');
    }
    o.push('<path d="'+d+'" fill="'+(p.fill||'none')+'"'+(p.eo?' fill-rule="evenodd"':'')+' stroke="'+(p.stroke||'none')+'"'+(p.stroke?' stroke-width="'+f(p.lw)+'" stroke-linecap="'+(['butt','round','square'][p.cap]||'butt')+'" stroke-linejoin="'+(['miter','round','bevel'][p.join]||'miter')+'"':'')+'/>');
  }
  o.push('</svg>'); return {svg:o.join('\n'),w,h:hh};
}
async function vecPng(o){
  let sc=300/72; const a=o.w*o.h*sc*sc; if(a>3e7) sc*=Math.sqrt(3e7/a);
  const url=URL.createObjectURL(new Blob([o.svg],{type:'image/svg+xml'})), im=new Image();
  await new Promise((res,rej)=>{ im.onload=res; im.onerror=()=>rej(new Error('This graphic couldn\u2019t be rendered.')); im.src=url; });
  const c=canvas(Math.max(1,Math.round(o.w*sc)),Math.max(1,Math.round(o.h*sc))); c.getContext('2d').drawImage(im,0,0,c.width,c.height); URL.revokeObjectURL(url);
  const blob=await new Promise(r=>c.toBlob(r,'image/png')); return new Uint8Array(await blob.arrayBuffer());
}
async function vecSaveAll(){
  try{
    const z=new JSZip(); let k=0, tot=pdfDoc.numPages;
    for(let n=1;n<=tot;n++){
      $('elnote').textContent='Scanning vector graphics\u2026 page '+n+' of '+tot; await tick();
      (await pageVec(n,Infinity)).forEach((cl,i)=>{ z.file(base()+'-p'+n+'-vector'+(i+1)+'.svg',vecSvg(cl).svg); k++; });
    }
    if(!k){ $('elnote').textContent='No vector graphics found.'; return; }
    $('elnote').textContent='Building ZIP\u2026'; await saveBytes(await z.generateAsync({type:'uint8array'}),base()+'-vectors.zip',$('elnote'));
  }catch(e){ $('elnote').textContent='Failed: '+(e.message||e); }
}
`;

const ROWS = String.raw`  let vecs=[];
  try{ vecs=await pageVec(n); }catch(e){ box.insertAdjacentHTML('beforeend','<p class="note">Couldn\u2019t scan vector graphics: '+esc(e.message||e)+'</p>'); }
  if(EL.page!==n||EL.sec!=='img') return;
  if(vecs.length){
    box.insertAdjacentHTML('beforeend','<p class="note" style="margin:12px 0 6px"><b>Vector graphics</b> on this page: '+vecs.length+(vecs.more?' (showing the first '+vecs.length+')':'')+'. Drawn shapes and lines rather than pictures, grouped when they touch or overlap. Text isn\u2019t included. Extract as SVG (stays vector) or PNG.</p>');
    vecs.forEach((cl,k)=>{
      const i=rows.length, row=document.createElement('div'), o=vecSvg(cl), nm=base()+'-p'+n+'-vector'+(k+1);
      row.className='xrow'; rows.push(row); boxes.push(cl.bb);
      row.innerHTML=rowHtml('','<b>Vector '+(k+1)+'</b><br>'+Math.round(o.w)+'\u00d7'+Math.round(o.h)+' pt \u00b7 '+cl.paths.length+' path'+(cl.paths.length===1?'':'s'),'<button data-a="svg">Extract SVG</button><button data-a="png">Extract PNG</button>');
      const g=new Image(); g.src=URL.createObjectURL(new Blob([o.svg],{type:'image/svg+xml'})); row.firstChild.appendChild(g);
      row.onclick=e=>{ if(!e.target.closest('button')) elSelect(stage,S,i,rows,boxes); };
      row.querySelector('.eb').onclick=async e=>{
        const b=e.target.closest('button'); if(!b) return;
        try{
          if(b.dataset.a==='svg') await saveBytes(new TextEncoder().encode(o.svg),nm+'.svg',$('elnote'));
          else await saveBytes(await vecPng(o),nm+'.png',$('elnote'));
        }catch(err){ $('elnote').textContent='Failed: '+(err.message||err); }
      };
      box.appendChild(row);
    });
  }
`;

function once(s, label) {
  const i = h.indexOf(s);
  if (i === -1) fail(label + ' not found');
  if (h.indexOf(s, i + 1) !== -1) fail(label + ' is not unique');
  return i;
}

// 1. SVG mime type
{
  const s = "zip:'application/zip'}";
  const i = once(s, 'mime map');
  h = h.slice(0, i) + "zip:'application/zip',svg:'image/svg+xml'}" + h.slice(i + s.length);
}
// 2. Extract-all button + handler
{
  const s = '<button class="t g" id="imgAll">Extract all images (ZIP)</button>';
  const i = once(s, 'imgAll button');
  h = h.slice(0, i + s.length) + '<button class="t g" id="vecAll">Extract all vectors (ZIP)</button>' + h.slice(i + s.length);
  const t = "$('imgAll').onclick=()=>imgSaveAll(d);";
  const j = once(t, 'imgAll handler');
  h = h.slice(0, j + t.length) + " $('vecAll').onclick=vecSaveAll;" + h.slice(j + t.length);
}
// 3. Rows, inserted before the dashed-box loop in elImgs
{
  const marker = "  if(boxes.some(b=>!b)) box.insertAdjacentHTML('beforeend','<p class=\"note\">Some images have no known position";
  const m = once(marker, 'elImgs end marker');
  const i = h.lastIndexOf('  boxes.forEach(', m);
  if (i === -1) fail('boxes loop not found');
  h = h.slice(0, i) + ROWS + h.slice(i);
}
// 4. Functions, before elImgs
{
  const i = once('async function elImgs(){', 'elImgs');
  h = h.slice(0, i) + VEC + h.slice(i);
}

fs.writeFileSync(file, h);
console.log('Patched ' + file + ' (backup: ' + file + '.bak)');
