import * as THREE from 'three';

// Shared uniforms every world material reads.
export const shared = {
  uTime: { value: 0 },
  uPlayer: { value: new THREE.Vector3() },
  uWind: { value: 1 },
  /** Foliage in front of the knight is dithered away inside this screen circle. */
  uCutCenter: { value: new THREE.Vector2() },
  uCutRadius: { value: 0 },
  uCutDepth: { value: 0 },
  uCamPos: { value: new THREE.Vector3() },
  uCamFwd: { value: new THREE.Vector3() },
};

/** Pattern ids written into the aKind vertex attribute. */
export const K = {
  Plain: 0,
  Grass: 1,
  Dirt: 2,
  Cobble: 3,
  Flag: 4, // big flagstones
  Wood: 5,
  Brick: 6,
  Rock: 7,
  Thatch: 8,
  Slate: 9,
  Sand: 10,
  Leaves: 11,
  Bark: 12,
  Plaster: 13,
  Metal: 14,
  Cloth: 15,
  Furrow: 16,
  Path: 17,
} as const;

const PATTERN = /* glsl */ `
float ph(vec2 p) { p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
float ph3(vec3 p) { return ph(p.xy + p.z * 17.13); }
float pn(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(ph(i), ph(i + vec2(1, 0)), u.x), mix(ph(i + vec2(0, 1)), ph(i + vec2(1, 1)), u.x), u.y);
}
float brickEdge(vec2 q) { vec2 f = fract(q); return min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y) * 1.6); }

float pattern(float k, vec3 p, vec3 n) {
  bool top = n.y > 0.7;
  bool sx = abs(n.x) > abs(n.z);
  vec2 t = p.xz;
  vec2 s = sx ? vec2(p.z, p.y) : vec2(p.x, p.y);
  float m = 1.0;
  if (k < 0.5) {
    m = 1.0;
  } else if (k < 1.5) { // grass
    float a = pn(t * 0.9), b = ph(floor(t * 10.0));
    m = 0.82 + 0.3 * a + step(0.94, b) * 0.22 - step(b, 0.05) * 0.14;
    if (!top) m = 0.75 + 0.2 * pn(s * 3.0);
  } else if (k < 2.5) { // dirt, path
    float b = ph(floor(t * 8.0));
    m = 0.88 + 0.16 * pn(t * 1.7) + step(0.93, b) * 0.22 - step(b, 0.07) * 0.14;
    if (!top) m = 0.8 + 0.25 * pn(s * vec2(2.0, 5.0));
  } else if (k < 3.5) { // cobble
    vec2 q = t * 2.3; q.x += mod(floor(q.y), 2.0) * 0.5;
    float e = brickEdge(q);
    m = (0.8 + 0.32 * ph(floor(q))) * mix(0.5, 1.0, step(0.09, e));
    if (!top) m = 0.8 + 0.2 * pn(s * 3.0);
  } else if (k < 4.5) { // flagstones
    vec2 q = top ? t * 0.9 : s * vec2(0.9, 1.4); q.x += mod(floor(q.y), 2.0) * 0.37;
    float e = brickEdge(q);
    m = (0.84 + 0.22 * ph(floor(q)) + 0.08 * pn(q * 4.0)) * mix(0.55, 1.0, step(0.05, e));
  } else if (k < 5.5) { // wood planks
    float v = top ? (sx ? p.z : p.x) * 3.2 : s.x * 3.2;
    float f = fract(v);
    float along = top ? (sx ? p.x : p.z) : s.y;
    m = (0.82 + 0.22 * ph(vec2(floor(v), 3.0))) * mix(0.55, 1.0, step(0.1, f)) * (0.92 + 0.12 * pn(vec2(floor(v) * 7.0, along * 5.0)));
  } else if (k < 6.5) { // stone brick
    vec2 q = top ? t * 1.4 : vec2(s.x * 1.25, s.y * 2.4); q.x += mod(floor(q.y), 2.0) * 0.5;
    float e = brickEdge(q);
    m = (0.78 + 0.3 * ph(floor(q)) + 0.06 * pn(q * 5.0)) * mix(0.52, 1.0, step(0.07, e));
  } else if (k < 7.5) { // cliff rock with strata
    if (top) { m = 0.85 + 0.25 * pn(t * 1.5); }
    else {
      float st = p.y * 1.8 + pn(s * 0.7) * 1.3;
      float band = fract(st);
      m = (0.78 + 0.26 * ph(vec2(floor(st), 1.0))) * mix(0.62, 1.0, step(0.14, band)) * (0.88 + 0.22 * pn(s * vec2(3.0, 1.5)));
    }
  } else if (k < 8.5) { // thatch
    float v = (sx ? p.z : p.x) * 8.0;
    float r = fract(p.y * 2.6);
    m = (0.78 + 0.3 * ph(vec2(floor(v), floor(p.y * 2.6)))) * mix(0.7, 1.0, step(0.16, r));
  } else if (k < 9.5) { // slate shingles
    vec2 q = vec2((sx ? p.z : p.x) * 2.6, p.y * 4.2); q.x += mod(floor(q.y), 2.0) * 0.5;
    vec2 f = fract(q);
    m = (0.78 + 0.3 * ph(floor(q))) * mix(0.55, 1.0, step(0.16, f.y) * step(0.07, f.x));
  } else if (k < 10.5) { // sand, gravel
    m = 0.9 + 0.12 * pn(t * 2.0) + (ph(floor(t * 12.0)) > 0.9 ? 0.1 : 0.0);
  } else if (k < 11.5) { // leaves
    float c = ph3(floor(p * 5.0));
    m = 0.72 + 0.42 * c + 0.12 * pn(t * 3.0);
  } else if (k < 12.5) { // bark
    float v = (sx ? p.z : p.x) * 9.0;
    m = 0.75 + 0.3 * ph(vec2(floor(v), floor(p.y * 2.0))) ;
  } else if (k < 13.5) { // plaster
    m = 0.9 + 0.1 * pn(s * 2.5) + 0.06 * pn(s * 9.0);
  } else if (k < 14.5) { // metal
    m = 0.9 + 0.2 * pn(s * 6.0);
  } else if (k < 15.5) { // cloth
    m = 0.9 + 0.12 * pn(s * vec2(2.0, 8.0));
  } else if (k < 16.5) { // furrowed field: dark soil rows with green crop lines
    float row = fract((p.x + p.z * 0.02) * 1.6);
    m = row < 0.45 ? 0.7 + 0.15 * pn(t * 3.0) : 1.35 + 0.2 * ph(floor(t * 6.0));
  } else { // trodden path: packed earth with pebbles pressed into it
    float b = ph(floor(t * 8.0));
    m = 0.9 + 0.14 * pn(t * 1.7) - step(b, 0.06) * 0.12;
    if (top) {
      vec2 q = t * 2.6, c = floor(q), f = fract(q);
      if (ph(c + 7.1) > 0.55) {
        vec2 o = vec2(ph(c + 1.3), ph(c + 2.9)) * 0.5 + 0.25;
        vec2 dv = (f - o) / (0.2 + 0.14 * ph(c + 5.7));
        float d = length(dv);
        // A pale stone, shadowed on the side away from the moon.
        if (d < 1.0) m = dot(dv, vec2(0.7, -0.7)) > 0.45 ? 0.68 : 1.16 + 0.22 * ph(c + 9.3);
      }
    } else m = 0.8 + 0.25 * pn(s * vec2(2.0, 5.0));
  }
  return m;
}
`;

const WIND = /* glsl */ `
float windWave(vec3 w) {
  return sin(uTime * 1.6 + w.x * 0.35 + w.z * 0.27) * 0.6 + sin(uTime * 2.7 + w.x * 0.9 - w.z * 0.6) * 0.4;
}
`;

/** Lambert material with vertex colours, patterns (aKind) and wind sway (aWind). */
export function worldMaterial(opts: { alphaHash?: boolean } = {}) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.uTime;
    sh.uniforms.uWind = shared.uWind;
    sh.uniforms.uCutCenter = shared.uCutCenter;
    sh.uniforms.uCutRadius = shared.uCutRadius;
    sh.uniforms.uCutDepth = shared.uCutDepth;
    sh.uniforms.uCamPos = shared.uCamPos;
    sh.uniforms.uCamFwd = shared.uCamFwd;
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute float aKind; attribute float aWind;
         varying float vKind; varying vec3 vWPos; varying vec3 vWNrm;
         uniform float uTime; uniform float uWind;
         ${WIND}`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vec4 wp0 = modelMatrix * vec4(transformed, 1.0);
         if (aWind > 0.0) {
           float w = windWave(wp0.xyz) * aWind * uWind;
           transformed.x += w * 0.09;
           transformed.z += w * 0.05;
         }
         vKind = aKind;
         vWPos = wp0.xyz;
         vWNrm = normalize(mat3(modelMatrix) * objectNormal);`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         varying float vKind; varying vec3 vWPos; varying vec3 vWNrm;
         uniform vec2 uCutCenter; uniform float uCutRadius; uniform float uCutDepth;
         uniform vec3 uCamPos; uniform vec3 uCamFwd;
         float bayer16(vec2 p) {
           ivec2 q = ivec2(mod(p, 4.0));
           int i = q.x + q.y * 4;
           float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
           return (m[i] + 0.5) / 16.0;
         }
         ${PATTERN}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         // Trees between the camera and the knight thin out around him: what is cut away keeps only its
         // outline, faint and pale (the specks a dither kept caught the outline pass and read as dark columns).
         float cutRim = 0.0;
         bool woody = vKind > 10.5 && vKind < 12.5;
         float facing = abs(dot(normalize(vWNrm), uCamFwd));
         if (uCutRadius > 0.0 && woody) {
           float fd = dot(vWPos - uCamPos, uCamFwd);
           if (fd < uCutDepth - 0.8) {
             float dd = length(gl_FragCoord.xy - uCutCenter) / uCutRadius;
             float vis = smoothstep(0.55, 1.0, dd);
             if (bayer16(gl_FragCoord.xy) > vis) {
               if (facing > 0.3) discard;
               cutRim = 1.0;
             }
           }
         }
         diffuseColor.rgb *= pattern(vKind, vWPos, normalize(vWNrm));
         ${opts.alphaHash ? `// Screen-door fade: an ordered dither reads as intentional pixel art (crowns and trunks fade to their
         // outline, as above).
         if (opacity < 0.999) {
           ivec2 bp = ivec2(mod(gl_FragCoord.xy, 4.0));
           int bi = bp.x + bp.y * 4;
           float bm[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
           float bt = (bm[bi] + 0.5) / 16.0;
           if (woody) {
             if (bt > (opacity - 0.25) / 0.75) {
               if (facing > 0.3) discard;
               cutRim = 1.0;
             }
           } else if (opacity <= bt) discard;
         }` : ''}`,
      )
      .replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
         // (No alpha: the outline pass leaves it be.)
         if (cutRim > 0.5) gl_FragColor = vec4(gl_FragColor.rgb * 0.55 + vec3(0.03, 0.04, 0.036), 0.0);`,
      );
  };
  mat.customProgramCacheKey = () => 'world' + (opts.alphaHash ? 'h' : '');
  return mat;
}

/** Unlit material for glowing things: windows, embers, runes. Colours may exceed 1 for bloom. */
export function glowMaterial() {
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.uTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nattribute float aKind; varying float vFlick; uniform float uTime;`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vec4 gp = modelMatrix * vec4(transformed, 1.0);
         float ph = gp.x * 1.3 + gp.z * 2.1;
         vFlick = aKind > 0.5 ? 0.82 + 0.1 * sin(uTime * 9.0 + ph) + 0.08 * sin(uTime * 23.0 + ph * 3.0) : 1.0;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying float vFlick;`)
      .replace('#include <color_fragment>', `#include <color_fragment>\ndiffuseColor.rgb *= vFlick;`);
  };
  mat.customProgramCacheKey = () => 'glow';
  return mat;
}

/** Grass tufts: instanced, sway in the wind, part around the player, no outlines. */
export function grassMaterial() {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.uTime;
    sh.uniforms.uPlayer = shared.uPlayer;
    sh.uniforms.uWind = shared.uWind;
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uTime; uniform vec3 uPlayer; uniform float uWind;
         ${WIND}`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vec4 gw = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
         float hgt = clamp(position.y / 0.5, 0.0, 1.0);
         float w = windWave(gw.xyz) * uWind + 0.35 * sin(uTime * 3.1 + gw.x * 2.0 + gw.z * 1.7);
         vec3 bend = vec3(w * 0.12, 0.0, w * 0.07);
         vec2 away = gw.xz - uPlayer.xz;
         float dp = length(away);
         float push = (1.0 - smoothstep(0.2, 1.1, dp)) * step(abs(gw.y - uPlayer.y), 1.2);
         bend.xz += normalize(away + 1e-4) * push * 0.35;
         bend.y -= push * 0.18;
         vec3 lb = (inverse(mat3(modelMatrix * instanceMatrix)) * bend);
         transformed += lb * hgt * hgt;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''))
      .replace('#include <opaque_fragment>', 'gl_FragColor = vec4(outgoingLight, 0.0);');
  };
  mat.customProgramCacheKey = () => 'grass';
  return mat;
}

/** Lit sprite material with a hit-flash uniform and a little self-light so characters read at night. */
export function spriteMaterial(map: THREE.Texture, glow = 0.22) {
  const flash = { value: 0 };
  const tint = { value: new THREE.Color(1, 1, 1) };
  const mat = new THREE.MeshLambertMaterial({
    map,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(glow, glow, glow * 1.15),
    emissiveMap: map,
  });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uFlash = flash;
    sh.uniforms.uTint = tint;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uFlash; uniform vec3 uTint;`)
      .replace(
        '#include <opaque_fragment>',
        `outgoingLight *= uTint;
         outgoingLight = mix(outgoingLight, vec3(1.6, 1.5, 1.4), uFlash);
         #include <opaque_fragment>`,
      );
  };
  mat.customProgramCacheKey = () => 'sprite';
  return { mat, flash, tint };
}
