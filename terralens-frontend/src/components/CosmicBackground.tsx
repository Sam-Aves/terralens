import React, { useEffect, useRef } from 'react';

// WebGL implementation of cosmic_bg.gdshader (Earth Orbit + Twinkling Stars + Braided Flood Basin)
const VERTEX_SHADER = `
  attribute vec2 a_pos;
  void main() {
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;
  uniform vec2 u_resolution;
  uniform float u_time;

  const vec4 space_black = vec4(0.015, 0.025, 0.065, 1.0);  // #040611
  const vec4 space_navy = vec4(0.035, 0.065, 0.16, 1.0);    // #091029
  const vec4 atmosphere_glow = vec4(0.12, 0.55, 0.85, 1.0); // Natural blue atmospheric limb
  const vec4 atmosphere_rim = vec4(0.35, 0.85, 1.0, 1.0);  // Bright thin limb line
  const vec4 land_base = vec4(0.08, 0.14, 0.10, 1.0);        // Terrestrial floodplain
  const vec4 land_highlight = vec4(0.14, 0.22, 0.16, 1.0);   // Vegetation / high ground
  const vec4 flood_water = vec4(0.01, 0.04, 0.09, 1.0);     // Low-backscatter flood inundation
  const vec4 sediment_flow = vec4(0.08, 0.18, 0.28, 1.0);   // Suspended river sediment

  float hash(vec2 p) {
      p = fract(p * vec2(234.34, 435.345));
      p += dot(p, p + 34.23);
      return fract(p.x * p.y);
  }

  float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
      for (int i = 0; i < 5; i++) {
          v += a * noise(p);
          p = rot * p * 2.0;
          a *= 0.5;
      }
      return v;
  }

  void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution.xy;
      uv.y = 1.0 - uv.y; // Match Godot UV orientation (0,0 is top-left)
      
      // 1. CALM, DEEP SPACE BACKGROUND
      vec4 col = mix(space_black, space_navy, uv.y * 0.5);

      // 2. REALISTIC PINPRICK STARFIELD (TWINKLING / FADING IN & OUT)
      vec2 star_pos = floor(uv * vec2(160.0, 90.0));
      float s_hash = hash(star_pos);
      if (s_hash > 0.978 && uv.y < 0.65) {
          vec2 local_s = fract(uv * vec2(160.0, 90.0)) - 0.5;
          float s_dist = length(local_s);
          float ph = hash(star_pos + 7.7) * 6.2832;
          float sp = 0.35 + hash(star_pos + 3.1) * 1.1;
          float tw = pow(0.5 + 0.5 * sin(u_time * sp + ph), 2.0);
          float brightness = max(0.0, 1.0 - s_dist * 5.0) * (0.05 + 0.95 * tw);
          col += vec4(0.85, 0.92, 1.0, 1.0) * brightness * 0.7;
      }

      // 3. EARTH'S CURVED HORIZON FROM LEO (747 KM ALTITUDE)
      vec2 earth_center = vec2(0.5, 2.55);
      float earth_radius = 1.88;
      vec2 diff = vec2((uv.x - earth_center.x) * 1.15, uv.y - earth_center.y);
      float dist = length(diff);

      // Atmospheric Limb Glow (Soft blue rayleigh scattering)
      float limb_dist = dist - earth_radius;
      if (limb_dist > 0.0 && limb_dist < 0.12) {
          float glow_factor = pow(1.0 - (limb_dist / 0.12), 3.0);
          col = mix(col, atmosphere_glow, glow_factor * 0.65);
          if (limb_dist < 0.02) {
              col = mix(col, atmosphere_rim, (1.0 - limb_dist / 0.02) * 0.75);
          }
      }

      // 4. TERRESTRIAL SURFACE & BRAIDED RIVER BASIN FLOOD INUNDATION
      if (dist <= earth_radius) {
          // Perspective mapping on the curved globe with animated flow
          vec2 surface_uv = vec2(uv.x * 2.5 + u_time * 0.003, (earth_radius - dist) * 8.0);
          
          // Base topography: agricultural plains & riverbanks
          float terrain_elevation = fbm(surface_uv * 1.2);
          vec4 ground = mix(land_base, land_highlight, terrain_elevation);

          // Intricate braided river delta (Jamuna / Brahmaputra basin)
          float river_branch = fbm(surface_uv * 3.0);
          float river_main = abs(sin(surface_uv.x * 1.8 + sin(surface_uv.y * 2.0)) - 0.2);
          
          // Floodwater inundation condition (overflowing lowlands)
          float flood_mask = smoothstep(0.42, 0.48, river_branch) * smoothstep(0.65, 0.2, river_main);
          float deep_channel = smoothstep(0.06, 0.0, river_main);

          // Water appearance: deep absorbing specular radar response + silty sediment current
          vec4 water = mix(flood_water, sediment_flow, river_branch * 0.4);
          ground = mix(ground, water, max(flood_mask * 0.85, deep_channel));

          // Atmospheric haze over distance (depth fog toward horizon)
          float depth_fog = smoothstep(0.0, 0.06, earth_radius - dist);
          ground = mix(atmosphere_glow * 0.8, ground, depth_fog);

          // Thin high-altitude weather cloud wisps drifting across
          float cloud = fbm(surface_uv * 0.8 + vec2(u_time * 0.008, 0.0));
          if (cloud > 0.58) {
              float cloud_density = (cloud - 0.58) / 0.42;
              ground = mix(ground, vec4(0.85, 0.92, 0.98, 1.0), cloud_density * 0.35);
          }

          col = ground;
      }

      // 5. SUBTLE SATELLITE SAR RADAR SCANLINE (Scientific swath footprint)
      float scan_beam = mod(uv.y * 3.0 - u_time * 0.3, 1.0);
      if (dist <= earth_radius && scan_beam < 0.08) {
          col += atmosphere_rim * (1.0 - scan_beam / 0.08) * 0.08;
      }

      gl_FragColor = col;
  }
`;

export const CosmicBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) {
      console.warn('WebGL not supported for cosmic background');
      return;
    }

    // Compile shader helper
    const createShader = (type: number, src: string) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(s));
        gl.deleteShader(s);
        return null;
      }
      return s;
    };

    const vs = createShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = createShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(prog));
      return;
    }

    gl.useProgram(prog);

    // Fullscreen quad
    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1,
      ]),
      gl.STATIC_DRAW
    );

    const aPos = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, 'u_resolution');
    const uTime = gl.getUniformLocation(prog, 'u_time');

    let animId = 0;
    const startTime = performance.now();

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };

    const render = () => {
      resize();
      const elapsed = (performance.now() - startTime) / 1000.0;

      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, elapsed);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animId = requestAnimationFrame(render);
    };

    window.addEventListener('resize', resize);
    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(posBuf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
};
