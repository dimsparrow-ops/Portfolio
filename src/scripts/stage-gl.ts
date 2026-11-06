// The covers are drawn by one WebGL canvas behind the whole stage (the CSS cards above it keep the chips, hover and
// clicks, with their faces see-through). Each card is a grid of quads, the way the reference (pacomepertant.com)
// draws its project planes: its own px are carried through the card's exact transform (`m`, the matrix the card gets
// as its CSS transform) and projected the way CSS projects the stage, so the WebGL plate lands precisely on the CSS
// card. Before that the plate's middle bulges out along its normal (bend, px); after it, in the spiral, the column
// leans right with height (warpK · y²) and the plate's middle sways with the scroll speed (swirl, px). A depth buffer
// sorts and cuts the plates where they meet, so a plate stays bent at any angle, edge-on included, and nothing tears.
const VERT = `attribute vec2 p;uniform mat4 m;uniform vec2 box;uniform float bend;uniform float warpK;uniform float swirl;
uniform float cy;uniform float persp;uniform vec2 axis;uniform vec2 view;varying vec2 vUv;varying float vFace;
void main(){vUv=p*.5+.5;
vec4 w=m*vec4(vUv.x*box.x,(1.-vUv.y)*box.y,bend*cos(1.5708*p.x),1.);
vFace=dot(normalize((m*vec4(0.,0.,1.,0.)).xyz),normalize(vec3(0.,0.,persp)-w.xyz));
w.x+=warpK*(w.y*w.y-cy*cy)+swirl*cos(1.5708*p.y);
float d=(persp-w.z)/persp;
vec2 s=axis+w.xy/d;
gl_Position=vec4((s.x/view.x*2.-1.)*d,(1.-s.y/view.y*2.)*d,clamp(-w.z/8000.,-1.,1.)*d,d);}`;
// same falloff as cappen.com/works: uv is pulled toward the cursor by 1/(1+(d/r)^4 * k). Corners are rounded here
// (8px, --r-card). A plate turning its back to the eye blurs in gradually, by how far it faces away (vFace: the
// cosine between its normal and the line to the camera, through perspective), lightly: a 5×5 tent of reads 0.75% of
// the card apart. Seen from behind the cover reads mirrored, as a real sheet would, with no flip to jump at 90°
const FRAG = `precision highp float;uniform sampler2D t;uniform vec2 mo;uniform vec2 ratio;uniform float k;uniform float z;uniform vec2 box;
uniform float op;varying vec2 vUv;varying float vFace;
void main(){vec2 q=abs(vUv-.5)*box-box*.5+8.;float a=clamp(8.5-length(max(q,0.)),0.,1.)*op;if(a<.004)discard;
vec2 uv=vUv-mo;float d=length(uv)/.8;uv*=1./(1.+pow(d,4.)*k);uv+=mo;
uv=(uv-.5)*z+.5;uv=vec2(uv.x*ratio.x+(1.-ratio.x)*.5,uv.y*ratio.y+(1.-ratio.y)*.5);
vec2 st=vec2(uv.x,1.-uv.y);vec3 c=texture2D(t,st).rgb;
float b=smoothstep(.25,-.35,vFace);
if(b>.002){vec3 bl=vec3(0.);for(int i=-2;i<=2;i++)for(int j=-2;j<=2;j++)bl+=texture2D(t,st+vec2(float(i),float(j))*.0075).rgb*(3.-abs(float(i)))*(3.-abs(float(j)));c=mix(c,bl/81.,b);}
gl_FragColor=vec4(c*a,a);}`;

/** One plate to draw this frame: the card's transform, its size, cover and the deformation (see VERT / FRAG). */
export interface Plate {
  tex: WebGLTexture;
  aspect: number; // cover's natural width / height
  m: DOMMatrix; // the card's transform, without the back-side mirror
  w: number;
  h: number;
  z: number; // depth of its centre, for back-to-front order
  bend: number;
  warpK: number;
  swirl: number;
  cy: number; // its centre's y in the world (px from the axis), the lean's zero
  op: number;
  warp: number; // hover distortion amount and where (card uv)
  u: number;
  v: number;
}

export interface StageGL {
  texture(img: HTMLImageElement): WebGLTexture | null;
  /** The canvas was resized, which clears it: it needs a draw even when nothing moved. */
  readonly stale: boolean;
  /** ay: the axis' y in the stage (px); it sits mid-width. */
  draw(plates: Plate[], persp: number, ay: number): void;
  dispose(): void;
}

export function createStageGL(stage: HTMLElement): StageGL | null {
  const canvas = document.createElement('canvas');
  canvas.className = 'stage-gl';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true });
  if (!gl) return null;
  const sh = (type: number, src: string) => {
    const o = gl.createShader(type)!;
    gl.shaderSource(o, src);
    gl.compileShader(o);
    return o;
  };
  const pr = gl.createProgram()!;
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(pr);
  gl.useProgram(pr);
  // a grid of quads over the card (see VERT)
  const cols = 16;
  const rows = 18;
  const pts: number[] = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) pts.push((i / cols) * 2 - 1, (j / rows) * 2 - 1);
  const ids: number[] = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i;
      const b = a + cols + 1;
      ids.push(a, a + 1, b, a + 1, b + 1, b);
    }
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pts), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(ids), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);
  const U = (n: string) => gl.getUniformLocation(pr, n);
  const u = {
    m: U('m'), box: U('box'), bend: U('bend'), warpK: U('warpK'), swirl: U('swirl'), cy: U('cy'), persp: U('persp'),
    axis: U('axis'), view: U('view'), mo: U('mo'), ratio: U('ratio'), k: U('k'), z: U('z'), op: U('op'),
  };
  const texs: WebGLTexture[] = [];
  let vw = 0;
  let vh = 0;
  let stale = true;
  const fit = () => {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    vw = w;
    vh = h;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    stale = true;
  };
  const ro = new ResizeObserver(fit);
  ro.observe(stage);
  stage.prepend(canvas); // under the cards: their chips and hover stay on top
  fit();
  return {
    texture(img) {
      const tex = gl.createTexture();
      if (!tex) return null;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      texs.push(tex);
      return tex;
    },
    get stale() {
      return stale;
    },
    draw(plates, persp, ay) {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      if (!vw) return;
      stale = false;
      gl.uniform1f(u.persp, persp);
      gl.uniform2f(u.axis, vw / 2, ay);
      gl.uniform2f(u.view, vw, vh);
      plates.sort((a, b) => a.z - b.z); // back to front, for the soft edges and the fades
      for (const pl of plates) {
        gl.bindTexture(gl.TEXTURE_2D, pl.tex);
        gl.uniformMatrix4fv(u.m, false, pl.m.toFloat32Array());
        gl.uniform2f(u.box, pl.w, pl.h);
        gl.uniform1f(u.bend, pl.bend);
        gl.uniform1f(u.warpK, pl.warpK);
        gl.uniform1f(u.swirl, pl.swirl);
        gl.uniform1f(u.cy, pl.cy);
        gl.uniform1f(u.op, pl.op);
        const ca = pl.w / pl.h;
        gl.uniform2f(u.ratio, Math.min(ca / pl.aspect, 1), Math.min(pl.aspect / ca, 1));
        gl.uniform2f(u.mo, pl.u, pl.v);
        gl.uniform1f(u.k, pl.warp);
        gl.uniform1f(u.z, 1 - 0.14 * pl.warp); // slight push-in so stretched edges never show the border
        gl.drawElements(gl.TRIANGLES, ids.length, gl.UNSIGNED_SHORT, 0);
      }
    },
    // browsers cap live WebGL contexts: free ours when the Work page is torn down
    dispose() {
      ro.disconnect();
      texs.forEach((t) => gl.deleteTexture(t));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
    },
  };
}
