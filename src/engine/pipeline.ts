import * as THREE from 'three';
import { MOBILE, VIEW } from '../config';

// Renders the scene into a small render target (the "pixel" buffer), then runs
// bloom and an atmosphere pass (outlines, fog, ground mist, cloud shadows, grading)
// at that resolution, and finally blits it to the screen with nearest filtering and a
// sub-pixel offset so camera motion stays smooth while pixels stay locked to the grid.

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const NOISE = /* glsl */ `
float h12(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h12(i), h12(i + vec2(1, 0)), u.x), mix(h12(i + vec2(0, 1)), h12(i + vec2(1, 1)), u.x), u.y);
}
float fbm3(vec2 p) { return vnoise(p) * 0.55 + vnoise(p * 2.03 + 7.1) * 0.3 + vnoise(p * 4.1 + 3.7) * 0.15; }
`;

const BRIGHT_FRAG = /* glsl */ `
uniform sampler2D tSrc; uniform float uThreshold;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  float k = max(l - uThreshold, 0.0) / max(l, 1e-4);
  gl_FragColor = vec4(c * k, 1.0);
}
`;

const BLUR_FRAG = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uDir;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb * 0.227;
  c += texture2D(tSrc, vUv + uDir * 1.385).rgb * 0.316;
  c += texture2D(tSrc, vUv - uDir * 1.385).rgb * 0.316;
  c += texture2D(tSrc, vUv + uDir * 3.231).rgb * 0.070;
  c += texture2D(tSrc, vUv - uDir * 3.231).rgb * 0.070;
  gl_FragColor = vec4(c, 1.0);
}
`;

/** Steps along the view ray for the sea's light shafts (fewer and longer on phones: the same reach). */
const RAYS = MOBILE ? 5 : 8;

const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D tColor, tDepth, tBloom1, tBloom2;
uniform vec2 uTexel;
uniform mat4 uInvViewProj;
uniform float uNear, uFar, uTime;
uniform vec3 uFogColor, uFogTop, uMistColor;
uniform float uFogNear, uFogFar;
uniform float uMistLevel, uMistDepth, uMistAmount;
uniform float uSea, uSeaCaustics, uSeaRays, uSeaSurface, uSeaFloor;
uniform vec3 uSeaDeep, uSeaRayColor;
uniform float uCloud, uExposure, uBloom, uOutline, uSaturation, uWarmth;
uniform vec3 uLift, uGain;
uniform float uFlash; uniform vec3 uFlashColor;
uniform float uDesat;
uniform sampler2D tFow; uniform vec2 uFowOrigin; uniform float uFowSize, uFowAmount; uniform vec3 uFowColor;
varying vec2 vUv;
${NOISE}

float linDepth(float d) { return uNear + d * (uFar - uNear); }

vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }

float bayer4(vec2 p) {
  ivec2 i = ivec2(mod(p, 4.0));
  int idx = i.x + i.y * 4;
  float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  return m[idx] / 16.0 - 0.5;
}

void main() {
  vec4 src = texture2D(tColor, vUv);
  vec3 col = src.rgb;
  float d = texture2D(tDepth, vUv).x;
  float z = linDepth(d);
  bool sky = d >= 0.99999;

  // Outlines: darken the pixel that sits in front of a depth step.
  if (!sky && src.a > 0.5) {
    float zl = linDepth(texture2D(tDepth, vUv - vec2(uTexel.x, 0.0)).x);
    float zr = linDepth(texture2D(tDepth, vUv + vec2(uTexel.x, 0.0)).x);
    float zu = linDepth(texture2D(tDepth, vUv + vec2(0.0, uTexel.y)).x);
    float zd = linDepth(texture2D(tDepth, vUv - vec2(0.0, uTexel.y)).x);
    float step = max(max(zl, zr), max(zu, zd)) - z;
    float edge = smoothstep(0.3, 0.6, step);
    col = mix(col, col * 0.28 + vec3(0.004, 0.003, 0.012), edge * uOutline);
  }

  vec3 wp = vec3(0.0);
  if (!sky) {
    vec4 ndc = vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
    vec4 w = uInvViewProj * ndc; wp = w.xyz / w.w;

    // Drifting cloud shadows over the moonlit ground.
    float cl = fbm3(wp.xz * 0.045 + vec2(uTime * 0.018, uTime * 0.008));
    col *= 1.0 - uCloud * smoothstep(0.42, 0.72, cl);

    if (uSea > 0.0 && wp.y < uSeaSurface) {
      // Below the sea's surface: light rippling over everything (two drifting layers of ridges), brightest
      // where it's shallow; deeper down, darker and bluer.
      vec2 cq = wp.xz * 0.36;
      float ca = 1.0 - abs(vnoise(cq + vec2(uTime * 0.21, uTime * 0.13)) * 2.0 - 1.0);
      float cb = 1.0 - abs(vnoise(cq * 1.31 + vec2(-uTime * 0.17, uTime * 0.19) + 5.3) * 2.0 - 1.0);
      float caus = pow(ca, 7.0) + pow(cb, 7.0);
      float shallow = clamp((wp.y - uSeaFloor) / max(1.0, uSeaSurface - uSeaFloor), 0.0, 1.0);
      col *= 1.0 + caus * uSeaCaustics * (0.3 + 0.7 * shallow);
      col = mix(col, uSeaDeep, 0.12 + (1.0 - shallow) * 0.7);
    }

    // Ground mist pooled in low places, rolling slowly.
    float mh = clamp((uMistLevel - wp.y) / uMistDepth, 0.0, 1.0);
    float mn = fbm3(wp.xz * 0.16 + vec2(uTime * 0.05, -uTime * 0.03));
    float mist = mh * mh * (0.35 + 0.65 * mn) * uMistAmount;
    col = mix(col, uMistColor, clamp(mist, 0.0, 0.85));

    // Depth fog toward the top of the screen.
    float f = smoothstep(uFogNear, uFogFar, z);
    col = mix(col, uFogColor, f);

    if (uSeaRays > 0.0 && wp.y < uSeaSurface) {
      // Shafts of light from the surface: step back along the view ray from what's seen, and for each
      // point ask whether its light came down through a bright patch of the surface (the light slants,
      // so points at different heights look up through different places: streaks that stay put).
      vec4 n0 = uInvViewProj * vec4(vUv * 2.0 - 1.0, -1.0, 1.0);
      vec3 back = normalize(n0.xyz / n0.w - wp);
      float acc = 0.0;
      for (int k = 1; k <= ${RAYS}; k++) {
        vec3 q = wp + back * (float(k) * ${(13.6 / RAYS).toFixed(2)});
        if (q.y > uSeaSurface) break;
        vec2 s = q.xz + vec2(0.42, 0.26) * (uSeaSurface - q.y);
        float band = vnoise(vec2(s.x * 0.11 + s.y * 0.04, s.y * 0.02) + vec2(uTime * 0.035, -uTime * 0.02));
        acc += smoothstep(0.64, 0.9, band);
      }
      col += uSeaRayColor * (acc / ${RAYS}.0) * uSeaRays * (1.0 - f * 0.6);
    }

    // Fog of war: unexplored land lies under a soft haze. The edge is a wide
    // gradient that drifts very slowly; the land stays faintly visible, tall
    // things rise above it and lights glow through.
    if (uFowAmount > 0.0) {
      vec2 drift = vec2(vnoise(wp.xz * 0.03 + uTime * 0.008), vnoise(wp.xz * 0.03 + 7.3 - uTime * 0.006)) - 0.5;
      vec2 fuv = (wp.xz + drift * 3.0 - uFowOrigin) / uFowSize;
      float seen = (fuv.x < 0.0 || fuv.y < 0.0 || fuv.x > 1.0 || fuv.y > 1.0) ? 0.0 : texture2D(tFow, fuv).r;
      float unseen = 1.0 - seen;
      unseen = unseen * unseen * (3.0 - 2.0 * unseen);
      unseen *= 1.0 - smoothstep(6.0, 16.0, wp.y) * 0.65;
      float cloud = vnoise(wp.xz * 0.022 + vec2(uTime * 0.005, uTime * 0.003)) * 0.65 + vnoise(wp.xz * 0.05 - vec2(uTime * 0.004, 0.0)) * 0.35;
      float dens = unseen * (0.62 + 0.2 * cloud) * uFowAmount;
      float bright = max(max(col.r, col.g), col.b);
      vec3 under = col * (0.18 + clamp(bright - 0.9, 0.0, 2.0) * 0.4);
      col = mix(col, uFowColor * (0.85 + 0.3 * cloud) + under, dens);
    }
  } else {
    col = mix(uFogColor, uFogTop, clamp(vUv.y * 1.2 - 0.1, 0.0, 1.0));
  }

  col += texture2D(tBloom1, vUv).rgb * uBloom + texture2D(tBloom2, vUv).rgb * uBloom * 0.8;

  col *= uExposure;
  col = aces(col);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSaturation * (1.0 - uDesat));
  col = col * uGain + uLift * (1.0 - col);
  col = mix(col, col * vec3(1.06, 1.0, 0.9), uWarmth);
  col = mix(col, uFlashColor, uFlash);
  col = toSRGB(clamp(col, 0.0, 1.0));
  col += bayer4(gl_FragCoord.xy) / 255.0 * 1.5;
  gl_FragColor = vec4(col, 1.0);
}
`;

const UPSCALE_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uSrcSize, uScreenSize, uOffset;
uniform float uScale, uVignette, uNarrow;
varying vec2 vUv;
void main() {
  vec2 p = vUv * uScreenSize / uScale + 1.0 + uOffset;
  vec3 c = texture2D(tSrc, p / uSrcSize).rgb;
  vec2 q = vUv - 0.5; q.x *= uScreenSize.x / uScreenSize.y;
  c *= 1.0 - uVignette * smoothstep(0.35, 1.1, length(q) * 1.25);
  c *= 1.0 - uNarrow * 0.85 * smoothstep(0.14, 0.64, length(q));
  gl_FragColor = vec4(c, 1.0);
}
`;

class Pass {
  scene = new THREE.Scene();
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  constructor(public material: THREE.ShaderMaterial) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    m.frustumCulled = false;
    this.scene.add(m);
  }
  run(r: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget | null) {
    r.setRenderTarget(target);
    r.render(this.scene, this.cam);
  }
}

const mk = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });

export interface Atmosphere {
  fogColor: THREE.Color;
  fogTop: THREE.Color;
  fogNear: number;
  fogFar: number;
  mistColor: THREE.Color;
  mistLevel: number;
  mistDepth: number;
  mistAmount: number;
  /** Under the sea (0 or 1), the water's deep colour, how bright the rippling light and the shafts are, the
   *  shafts' colour, and the heights of the surface and the deepest floor. */
  sea: number;
  seaDeep: THREE.Color;
  seaCaustics: number;
  seaRays: number;
  seaRayColor: THREE.Color;
  seaSurface: number;
  seaFloor: number;
  cloud: number;
  exposure: number;
  bloom: number;
  bloomThreshold: number;
  saturation: number;
  warmth: number;
  lift: THREE.Color;
  gain: THREE.Color;
  vignette: number;
}

export class Pipeline {
  renderer: THREE.WebGLRenderer;
  scale = 3;
  /** Inner size of the pixel buffer (what maps to the screen). */
  innerW = 0;
  innerH = 0;
  /** Full pixel buffer size including a 1px margin on each side. */
  w = 0;
  h = 0;
  offset = new THREE.Vector2();
  flash = 0;
  flashColor = new THREE.Color(1, 1, 1);
  desat = 0;
  /** The view closing in to a tunnel (out of air). */
  narrow = 0;
  time = 0;
  fow: { tex: THREE.Texture; x: number; z: number; size: number; amount: number } | null = null;
  atmo: Atmosphere = {
    fogColor: new THREE.Color(0.012, 0.014, 0.035),
    fogTop: new THREE.Color(0.006, 0.006, 0.02),
    fogNear: 70,
    fogFar: 130,
    mistColor: new THREE.Color(0.07, 0.085, 0.14),
    mistLevel: 1.2,
    mistDepth: 2.2,
    mistAmount: 0.8,
    sea: 0,
    seaDeep: new THREE.Color(0, 0, 0),
    seaCaustics: 0,
    seaRays: 0,
    seaRayColor: new THREE.Color(0, 0, 0),
    seaSurface: 16,
    seaFloor: -3,
    cloud: 0.28,
    exposure: 1.45,
    bloom: 0.9,
    bloomThreshold: 0.9,
    saturation: 1.05,
    warmth: 0,
    lift: new THREE.Color(0.012, 0.014, 0.04),
    gain: new THREE.Color(1, 1, 1),
    vignette: 0.55,
  };

  private sceneRT!: THREE.WebGLRenderTarget;
  private compRT!: THREE.WebGLRenderTarget;
  private b1a!: THREE.WebGLRenderTarget;
  private b1b!: THREE.WebGLRenderTarget;
  private b2a!: THREE.WebGLRenderTarget;
  private b2b!: THREE.WebGLRenderTarget;
  private bright: Pass;
  private blur: Pass;
  private comp: Pass;
  private up: Pass;
  private tmpM = new THREE.Matrix4();

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.autoClear = true;
    this.renderer.setClearColor(0x000000, 1);
    container.appendChild(this.renderer.domElement);

    this.bright = new Pass(mk(BRIGHT_FRAG, { tSrc: { value: null }, uThreshold: { value: 1 } }));
    this.blur = new Pass(mk(BLUR_FRAG, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } }));
    this.comp = new Pass(
      mk(COMPOSITE_FRAG, {
        tColor: { value: null }, tDepth: { value: null }, tBloom1: { value: null }, tBloom2: { value: null },
        uTexel: { value: new THREE.Vector2() }, uInvViewProj: { value: new THREE.Matrix4() },
        uNear: { value: 1 }, uFar: { value: 200 }, uTime: { value: 0 },
        uFogColor: { value: new THREE.Color() }, uFogTop: { value: new THREE.Color() }, uMistColor: { value: new THREE.Color() },
        uFogNear: { value: 0 }, uFogFar: { value: 0 },
        uMistLevel: { value: 0 }, uMistDepth: { value: 1 }, uMistAmount: { value: 0 },
        uSea: { value: 0 }, uSeaCaustics: { value: 0 }, uSeaRays: { value: 0 }, uSeaSurface: { value: 16 }, uSeaFloor: { value: -3 },
        uSeaDeep: { value: new THREE.Color() }, uSeaRayColor: { value: new THREE.Color() },
        uCloud: { value: 0 }, uExposure: { value: 1 }, uBloom: { value: 1 }, uOutline: { value: 1 },
        uSaturation: { value: 1 }, uWarmth: { value: 0 },
        uLift: { value: new THREE.Color() }, uGain: { value: new THREE.Color() },
        uFlash: { value: 0 }, uFlashColor: { value: new THREE.Color() }, uDesat: { value: 0 },
        tFow: { value: null }, uFowOrigin: { value: new THREE.Vector2() }, uFowSize: { value: 1 }, uFowAmount: { value: 0 },
        uFowColor: { value: new THREE.Color(0.018, 0.02, 0.045) },
      }),
    );
    this.up = new Pass(
      mk(UPSCALE_FRAG, {
        tSrc: { value: null }, uSrcSize: { value: new THREE.Vector2() }, uScreenSize: { value: new THREE.Vector2() },
        uOffset: { value: new THREE.Vector2() }, uScale: { value: 3 }, uVignette: { value: 0.5 }, uNarrow: { value: 0 },
      }),
    );
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.floor(window.innerWidth * dpr), H = Math.floor(window.innerHeight * dpr);
    this.renderer.setSize(W, H, false);
    this.renderer.domElement.style.width = window.innerWidth + 'px';
    this.renderer.domElement.style.height = window.innerHeight + 'px';
    const lines = Number(new URLSearchParams(location.search).get('lines')) || (MOBILE ? 250 : VIEW.targetLines);
    this.scale = Math.max(1, Math.round(Math.min(W, H) / lines));
    this.innerW = Math.ceil(W / this.scale);
    this.innerH = Math.ceil(H / this.scale);
    this.w = this.innerW + 2;
    this.h = this.innerH + 2;

    for (const rt of [this.sceneRT, this.compRT, this.b1a, this.b1b, this.b2a, this.b2b]) rt?.dispose();
    const near = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter };
    const lin = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: THREE.HalfFloatType };
    const depthTexture = new THREE.DepthTexture(this.w, this.h, THREE.UnsignedInt248Type);
    depthTexture.format = THREE.DepthStencilFormat;
    this.sceneRT = new THREE.WebGLRenderTarget(this.w, this.h, { ...near, type: THREE.HalfFloatType, depthTexture, stencilBuffer: true });
    this.compRT = new THREE.WebGLRenderTarget(this.w, this.h, near);
    const hw = Math.max(1, this.w >> 1), hh = Math.max(1, this.h >> 1);
    const qw = Math.max(1, this.w >> 2), qh = Math.max(1, this.h >> 2);
    this.b1a = new THREE.WebGLRenderTarget(hw, hh, lin);
    this.b1b = new THREE.WebGLRenderTarget(hw, hh, lin);
    this.b2a = new THREE.WebGLRenderTarget(qw, qh, lin);
    this.b2b = new THREE.WebGLRenderTarget(qw, qh, lin);
    const u = this.up.material.uniforms;
    u.uSrcSize.value.set(this.w, this.h);
    u.uScreenSize.value.set(W, H);
    u.uScale.value = this.scale;
  }

  /** Compile every material in the scene for the target it's drawn into (no frame is drawn). */
  compile(scene: THREE.Scene, camera: THREE.OrthographicCamera) {
    const r = this.renderer;
    r.setRenderTarget(this.sceneRT);
    r.compile(scene, camera);
    r.setRenderTarget(null);
  }

  render(scene: THREE.Scene, camera: THREE.OrthographicCamera) {
    const r = this.renderer, a = this.atmo;
    r.setRenderTarget(this.sceneRT);
    r.render(scene, camera);

    // Bloom: bright pass at half res, blurred, then a wider quarter-res level.
    const bu = this.bright.material.uniforms;
    bu.tSrc.value = this.sceneRT.texture;
    bu.uThreshold.value = a.bloomThreshold;
    this.bright.run(r, this.b1a);
    const blur = this.blur.material.uniforms;
    const blurPass = (src: THREE.WebGLRenderTarget, tmp: THREE.WebGLRenderTarget) => {
      blur.tSrc.value = src.texture;
      blur.uDir.value.set(1 / src.width, 0);
      this.blur.run(r, tmp);
      blur.tSrc.value = tmp.texture;
      blur.uDir.value.set(0, 1 / src.height);
      this.blur.run(r, src);
    };
    blurPass(this.b1a, this.b1b);
    blur.tSrc.value = this.b1a.texture;
    blur.uDir.value.set(0.5 / this.b1a.width, 0);
    this.blur.run(r, this.b2a);
    blurPass(this.b2a, this.b2b);

    const c = this.comp.material.uniforms;
    c.tColor.value = this.sceneRT.texture;
    c.tDepth.value = this.sceneRT.depthTexture;
    c.tBloom1.value = this.b1a.texture;
    c.tBloom2.value = this.b2a.texture;
    c.uTexel.value.set(1 / this.w, 1 / this.h);
    this.tmpM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).invert();
    c.uInvViewProj.value.copy(this.tmpM);
    c.uNear.value = camera.near;
    c.uFar.value = camera.far;
    c.uTime.value = this.time;
    c.uFogColor.value.copy(a.fogColor);
    c.uFogTop.value.copy(a.fogTop);
    c.uMistColor.value.copy(a.mistColor);
    c.uFogNear.value = a.fogNear;
    c.uFogFar.value = a.fogFar;
    c.uMistLevel.value = a.mistLevel;
    c.uMistDepth.value = a.mistDepth;
    c.uMistAmount.value = a.mistAmount;
    c.uSea.value = a.sea;
    c.uSeaCaustics.value = a.seaCaustics;
    c.uSeaRays.value = a.seaRays;
    c.uSeaSurface.value = a.seaSurface;
    c.uSeaFloor.value = a.seaFloor;
    c.uSeaDeep.value.copy(a.seaDeep);
    c.uSeaRayColor.value.copy(a.seaRayColor);
    c.uCloud.value = a.cloud;
    c.uExposure.value = a.exposure;
    c.uBloom.value = a.bloom;
    c.uSaturation.value = a.saturation;
    c.uWarmth.value = a.warmth;
    c.uLift.value.copy(a.lift);
    c.uGain.value.copy(a.gain);
    c.uFlash.value = this.flash;
    c.uFlashColor.value.copy(this.flashColor);
    c.uDesat.value = this.desat;
    if (this.fow) {
      c.tFow.value = this.fow.tex;
      c.uFowOrigin.value.set(this.fow.x, this.fow.z);
      c.uFowSize.value = this.fow.size;
      c.uFowAmount.value = this.fow.amount;
      c.uFowColor.value.copy(a.fogColor).lerp(a.mistColor, 0.45);
    }
    this.comp.run(r, this.compRT);

    const u = this.up.material.uniforms;
    u.tSrc.value = this.compRT.texture;
    u.uOffset.value.copy(this.offset);
    u.uVignette.value = a.vignette;
    u.uNarrow.value = this.narrow;
    this.up.run(r, null);
  }
}
