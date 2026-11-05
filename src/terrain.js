import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BANDS, spectrumIndex } from './dsp.js';
import { historyFade, hillEnvelope, stereoVariation, stereoDrift, radialLevels, radialShape, radialRadius } from './shape.js';
import { PRESETS } from './presets.js';

export const DEFAULT_VIEW = { ...PRESETS[0].view };
export class Terrain {
  constructor(container) {
    this.container = container; this.options = { ...DEFAULT_VIEW };
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#060808');
    this.camera = new THREE.PerspectiveCamera(48, 1, .03, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    container.appendChild(this.renderer.domElement);
    this.help = 'ЛКМ: вращение. ПКМ или Shift + ЛКМ: перемещение. Колесо: масштаб к указателю. Средняя кнопка: масштаб перетаскиванием. Двойной щелчок: сброс. Стрелки: перемещение. F11: только визуализация на весь экран. Escape: вернуть интерфейс.';
    this.renderer.domElement.setAttribute('aria-label', 'История аудиоспектра. ' + this.help);
    this.renderer.domElement.title = this.help; this.renderer.domElement.tabIndex = 0;
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; this.controls.dampingFactor = .08;
    this.controls.minDistance = 1; this.controls.maxDistance = 250;
    this.controls.maxPolarAngle = Math.PI; this.controls.enablePan = true;
    this.controls.screenSpacePanning = true; this.controls.zoomToCursor = true; this.controls.cursorStyle = 'grab';
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    this.controls.listenToKeyEvents(this.renderer.domElement);
    this.renderer.domElement.addEventListener('pointerdown', () => this.renderer.domElement.focus({ preventScroll: true }));
    this.renderer.domElement.addEventListener('dblclick', () => { if (!this.options.flight) this.resetCamera(); });
    this.group = new THREE.Group(); this.echoGroup = new THREE.Group(); this.echoGroup.scale.z = -1;
    this.scene.add(this.group, this.echoGroup);
    this.scene.add(new THREE.HemisphereLight(0xe5f0ff, 0x14201b, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 3); sun.position.set(-15, 30, 10); this.scene.add(sun);
    this.mode = 'slices'; this.flightTime = 0; this.colorTime = 0; this.maxHeight = 0;
    this.variationSeed = Math.random() * Math.PI * 2;
    this.palette = { active: { value: 0 }, hue: { value: .4 } }; this.hue = .4; this.hueTarget = .4;
    this.fadeUniforms = { enabled: { value: 1 }, phase: { value: 0 }, radial: { value: 1 } };
    this.resetCamera(); new ResizeObserver(() => this.resize()).observe(container); this.resize();
  }
  resetCamera() {
    this.controls.enableDamping = false; this.controls.update();
    const scale = Math.max(1, 1.42 / this.camera.aspect);
    this.camera.position.set(0, 24 * scale, 36 * scale); this.controls.target.set(0, 2, -3);
    this.controls.update(); this.controls.enableDamping = true;
  }
  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight; if (!w || !h) return;
    if (!this.options.flight) {
      const oldFit = Math.max(1, 1.42 / this.camera.aspect), newFit = Math.max(1, 1.42 / (w / h));
      this.camera.position.sub(this.controls.target).multiplyScalar(newFit / oldFit).add(this.controls.target);
    }
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h);
  }
  colorMaterial(material, mountain = false) {
    material.onBeforeCompile = shader => {
      shader.uniforms.waveColors = this.palette.active; shader.uniforms.waveHue = this.palette.hue;
      this.addFadeShader(shader);
      shader.vertexShader = 'varying vec3 wavePosition;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nwavePosition = position;');
      shader.fragmentShader = `uniform float waveColors; uniform float waveHue; varying vec3 wavePosition;
vec3 wavePalette(float h) { vec3 p = abs(fract(vec3(h) + vec3(0.0, 0.666667, 0.333333)) * 6.0 - 3.0); return mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), 0.65); }
` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
if (waveColors > 0.5) { diffuseColor.rgb *= wavePalette(waveHue + abs(wavePosition.x) * 0.009 + wavePosition.y * 0.022 - wavePosition.z * 0.002); }
`);
    };
    material.customProgramCacheKey = () => 'wave-palette-trail-' + (mountain ? 'surface' : 'lines');
    return material;
  }
  addFadeShader(shader, depthOnly = false, moving = true) {
    shader.uniforms.waveFadeEnabled = this.fadeUniforms.enabled; shader.uniforms.waveFadePhase = this.fadeUniforms.phase;
    shader.uniforms.waveRadial = this.fadeUniforms.radial;
    shader.vertexShader = 'attribute float waveAge; attribute float waveTravelFactor; varying float waveDistance; uniform float waveRadial; uniform float waveFadePhase;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nwaveDistance = waveAge;' + (moving ? '\nif (waveRadial > 0.5 && length(transformed.xz) > 0.001) transformed.xz += normalize(transformed.xz) * 22.5 * (pow(waveAge + waveFadePhase, 0.35) - pow(waveAge, 0.35)) * waveTravelFactor;' : ''));
    shader.fragmentShader = 'uniform float waveFadeEnabled; uniform float waveFadePhase; varying float waveDistance;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
float trailFade = waveFadeEnabled > 0.5 ? pow(max(0.0, 1.0 - waveDistance - waveFadePhase), 1.7) : 1.0;
${depthOnly ? 'if (trailFade < 0.08) discard;' : 'diffuseColor.a *= trailFade;'}
`);
  }
  allocate(rows) {
    const geometries = new Set(), materials = new Set();
    for (const item of [...this.group.children]) { this.group.remove(item); geometries.add(item.geometry); materials.add(item.material); }
    this.echoGroup.clear();
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    this.rows = rows; this.columns = this.options.mirrored ? BANDS * 2 : BANDS;
    this.meshRows = rows;
    const extent = this.options.mountains || this.options.flight ? 72 : 30;
    this.spacing = (this.options.flow === 'radial' ? 18 : extent / (this.options.flow === 'center' ? 2 : 1)) / (rows - 1);
    const width = this.options.mountains || this.options.flight ? 42 : 30;
    this.positions = new Float32Array(this.meshRows * this.columns * 3);
    const colors = new Float32Array(this.positions.length);
    const ages = new Float32Array(this.meshRows * this.columns), travel = new Float32Array(ages.length);
    for (let r = 0; r < this.meshRows; r++) for (let b = 0; b < this.columns; b++) {
      const i = (r * this.columns + b) * 3;
      this.positions[i] = (b / (this.columns - 1) - .5) * width;
      this.positions[i + 2] = this.options.flow === 'center' ? r * this.spacing : (this.options.flight ? -55 + r * this.spacing : 11 - r * this.spacing);
      ages[r * this.columns + b] = r / (rows - 1);
      travel[r * this.columns + b] = r > 0 ? 1 : 0;
      const shade = .93;
      colors[i] = shade; colors[i + 1] = shade; colors[i + 2] = shade;
    }
    this.attribute = new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage);
    const ageAttribute = new THREE.BufferAttribute(ages, 1), travelAttribute = new THREE.BufferAttribute(travel, 1);
    const lineGeometry = new THREE.BufferGeometry().setAttribute('position', this.attribute).setAttribute('color', new THREE.BufferAttribute(colors, 3)).setAttribute('waveAge', ageAttribute).setAttribute('waveTravelFactor', travelAttribute);
    const lineMaterial = () => this.colorMaterial(new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, fog: false }));
    // Dim all lines first, write only surface depth, then draw the fully lit front lines.
    this.backLines = new THREE.LineSegments(lineGeometry, lineMaterial());
    this.backLines.material.depthTest = false; this.backLines.renderOrder = 0;
    const surfaceGeometry = new THREE.BufferGeometry().setAttribute('position', this.attribute).setAttribute('waveAge', ageAttribute).setAttribute('waveTravelFactor', travelAttribute);
    const triangles = [];
    for (let r = 0; r < this.meshRows - 1; r++) for (let b = 0; b < this.columns - (this.options.flow === 'radial' ? 0 : 1); b++) {
      const a = r * this.columns + b, c = a + this.columns, next = r * this.columns + (b + 1) % this.columns;
      triangles.push(a, c, next, next, c, next + this.columns);
    }
    surfaceGeometry.setIndex(triangles);
    const depthMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, transparent: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 });
    depthMaterial.onBeforeCompile = shader => { this.addFadeShader(shader, true); shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\ngl_Position.z += 0.000002 * gl_Position.w;'); };
    depthMaterial.customProgramCacheKey = () => 'wave-trail-depth';
    this.depthSurface = new THREE.Mesh(surfaceGeometry, depthMaterial); this.depthSurface.renderOrder = 1;
    this.mountainSurface = new THREE.Mesh(surfaceGeometry, this.colorMaterial(new THREE.MeshStandardMaterial({ color: 0x424d50, roughness: 1, metalness: 0, flatShading: true, side: THREE.DoubleSide, transparent: true, depthWrite: false }), true));
    this.mountainSurface.renderOrder = -1;
    this.lines = new THREE.LineSegments(lineGeometry, lineMaterial()); this.lines.renderOrder = 2;
    for (const item of [this.mountainSurface, this.backLines, this.depthSurface, this.lines]) { item.frustumCulled = false; this.group.add(item); this.echoGroup.add(item.clone()); }
    this.setMode(this.mode); this.applySurface();
  }
  applySurface() {
    if (!this.lines) return;
    const opacity = this.options.black ? 1 - this.options.transparency / 100 : 0;
    this.depthSurface.visible = opacity > 0;
    this.backLines.visible = opacity > 0 && opacity < 1;
    this.backLines.material.opacity = 1 - opacity;
    this.lines.material.depthTest = opacity > 0;
    this.lines.material.opacity = this.options.mountains ? .82 : 1;
    this.mountainSurface.visible = this.options.mountains && opacity > 0;
    this.mountainSurface.material.opacity = opacity;
    this.palette.active.value = +this.options.colors;
    this.fadeUniforms.enabled.value = +this.options.taper;
    this.echoGroup.visible = this.options.flow === 'center';
    this.fadeUniforms.radial.value = +(this.options.flow === 'radial');
    this.group.children.forEach((item, i) => { this.echoGroup.children[i].visible = item.visible; });
  }
  setOptions(next, history, gain) {
    const before = this.options; this.options = { ...before, ...next };
    if (before.flow !== this.options.flow) this.mode = this.options.flow === 'radial' ? 'slices' : 'longitudinal';
    if (this.options.flight !== before.flight) {
      if (this.options.flight) {
        this.savedView = { position: this.camera.position.clone(), target: this.controls.target.clone() };
        this.flightTime = 0; this.camera.position.set(0, Math.max(12, this.maxHeight + 4), 25);
      } else if (this.savedView) {
        this.camera.position.copy(this.savedView.position); this.controls.target.copy(this.savedView.target);
      }
      this.controls.enabled = !this.options.flight;
    }
    if (this.options.colors && !before.colors) { this.hueTarget = Math.random(); this.colorTime = 0; }
    if (['mirrored', 'mountains', 'flight', 'flow'].some(key => before[key] !== this.options[key])) this.allocate(history.rows);
    this.applySurface(); this.update(history, gain);
  }
  setMode(mode) {
    this.mode = mode; if (!this.lines) return;
    const index = [];
    for (let r = 0; r < this.meshRows; r++) for (let b = 0; b < this.columns; b++) {
      const i = r * this.columns + b;
      const lane = !this.options.mirrored || (b < BANDS ? b % 2 === 1 : b % 2 === 0);
      if (this.options.flow === 'radial') {
        if (mode === 'longitudinal' && r > 0) index.push(i, r * this.columns + (b + 1) % this.columns);
        if (mode === 'slices' && b % 4 === 0 && r < this.meshRows - 1) index.push(i, i + this.columns);
      } else {
        if (mode === 'longitudinal' && lane && r < this.rows - 1) index.push(i, i + this.columns);
        if (mode === 'slices' && b < this.columns - 1) index.push(i, i + 1);
      }
    }
    this.lines.geometry.setIndex(index);
  }
  update(history, gain) {
    if (this.options.flow === 'radial') { this.updateRadial(history, gain); return; }
    this.maxHeight = 0;
    for (let r = 0; r < this.rows; r++) for (let b = 0; b < this.columns; b++) {
      const address = spectrumIndex(b, this.options.mirrored);
      let value = history.at(r, address);
      if (this.options.mountains || this.options.flow === 'center') {
        const bin = address % BANDS;
        const amount = this.options.mountains ? .25 : .15;
        value = value * (1 - 2 * amount) + amount * (history.at(r, address - (bin > 0 ? 1 : 0)) + history.at(r, address + (bin < BANDS - 1 ? 1 : 0)));
      }
      const variation = this.options.variation && this.options.mirrored ? stereoVariation(history.stamp(r), address % BANDS, b < BANDS ? 0 : 1, this.variationSeed, this.options.variationAmount) : 1;
      const envelope = this.options.hill ? hillEnvelope(r, this.rows) : 1;
      const accent = this.options.flow === 'center' ? history.accent(r) : 1;
      const height = Math.pow(value, this.options.mountains ? 1.7 : 2.1) * gain * (this.options.mountains ? 10 : 8) * accent * variation * envelope;
      const width = this.options.mountains || this.options.flight ? 42 : 30;
      const drift = this.options.flow === 'center' && this.options.variation && this.options.mirrored ? stereoDrift(history.stamp(r), address % BANDS, b < BANDS ? 0 : 1, this.variationSeed, this.options.variationAmount) * value * Math.sin(Math.PI * b / (this.columns - 1)) ** 2 : 0;
      this.positions[(r * this.columns + b) * 3] = (b / (this.columns - 1) - .5) * width + drift;
      this.positions[(r * this.columns + b) * 3 + 1] = height; this.maxHeight = Math.max(this.maxHeight, height);
    }
    this.attribute.needsUpdate = true;
    if (this.options.mountains) this.mountainSurface.geometry.computeVertexNormals();
  }
  updateRadial(history, gain) {
    this.maxHeight = 0;
    for (let r = 0; r < this.rows; r++) {
      const levels = radialLevels(history, r, BANDS), stamp = history.stamp(r), accent = history.accent(r);
      if (!this.options.mirrored) {
        for (let i = 0; i < 3; i++) levels[0][i] = levels[1][i] = (levels[0][i] + levels[1][i]) / 2;
        for (let i = 0; i < levels.profiles[0].length; i++) levels.profiles[0][i] = levels.profiles[1][i] = (levels.profiles[0][i] + levels.profiles[1][i]) / 2;
      }
      for (let b = 0; b < this.columns; b++) {
        const angle = b / this.columns * Math.PI * 2;
        const shape = radialShape(levels, angle, stamp, this.variationSeed, this.options.variation ? this.options.variationAmount : 0, gain, accent);
        const radius = radialRadius(r, this.rows) + shape.offset;
        const i = (r * this.columns + b) * 3;
        this.positions[i] = Math.cos(angle) * radius; this.positions[i + 1] = shape.height; this.positions[i + 2] = Math.sin(angle) * radius;
        if (r > 0) this.maxHeight = Math.max(this.maxHeight, shape.height);
      }
    }
    // The newest sample closes the mesh at one point. Every visible ring is actual audio history.
    // There is no stationary cap or separately amplified bass object.
    this.sourceHeight = 0; this.sourceProfilePeak = 0;
    for (let b = 0; b < this.columns; b++) {
      this.sourceHeight += this.positions[b * 3 + 1] / this.columns;
      this.sourceProfilePeak = Math.max(this.sourceProfilePeak, this.positions[b * 3 + 1]);
    }
    for (let b = 0; b < this.columns; b++) {
      const i = b * 3; this.positions[i] = 0; this.positions[i + 1] = this.sourceHeight; this.positions[i + 2] = 0;
    }
    this.maxHeight = Math.max(this.maxHeight, this.sourceHeight);
    this.attribute.needsUpdate = true;
    if (this.options.mountains) this.mountainSurface.geometry.computeVertexNormals();
  }
  render(phase = 0, dt = 0, running = false) {
    if (this.options.flow === 'center') { this.group.position.z = -4 + phase * this.spacing; this.echoGroup.position.z = -4 - phase * this.spacing; }
    else if (this.options.flow === 'radial') this.group.position.z = -4;
    else this.group.position.z = (this.options.flight ? 1 : -1) * phase * this.spacing;
    this.fadeUniforms.phase.value = phase / Math.max(1, this.rows - 1);
    if (running && this.options.colors) {
      this.colorTime += dt;
      if (this.colorTime > 6) { this.hueTarget = Math.random(); this.colorTime = 0; }
      const delta = ((this.hueTarget - this.hue + 1.5) % 1) - .5;
      this.hue = (this.hue + delta * (1 - Math.exp(-dt * .8)) + 1) % 1;
      this.palette.hue.value = this.hue;
    }
    if (this.options.flight && running) {
      this.flightTime += dt;
      const t = this.flightTime;
      const radial = this.options.flow === 'radial';
      const desired = radial ? new THREE.Vector3(Math.sin(t * .12) * 22, Math.max(12, this.maxHeight + 7) + Math.sin(t * .21), -4 + Math.cos(t * .12) * 22) : new THREE.Vector3(Math.sin(t * .14) * 7, Math.max(12, this.maxHeight + 4) + Math.sin(t * .21), 25);
      this.camera.position.lerp(desired, 1 - Math.exp(-Math.max(dt, .001) * 2));
      this.controls.target.set(radial ? 0 : Math.sin(t * .12 + .5) * 4, this.maxHeight * .3, radial ? -4 : -35);
      this.camera.lookAt(this.controls.target);
    } else if (!this.options.flight) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
  diagnostics() {
    const rowHeight = row => { let height = 0; for (let b = 0; b < this.columns; b++) height = Math.max(height, this.positions[(row * this.columns + b) * 3 + 1]); return height; };
    return { ...this.options, sourceHeight: this.options.flow === 'radial' ? this.sourceHeight : rowHeight(0), sourceProfilePeak: this.sourceProfilePeak, edgeHeights: this.options.flow === 'center' ? [rowHeight(this.rows - 1), rowHeight(this.rows - 1)] : [rowHeight(0), rowHeight(this.rows - 1)], middleHeight: rowHeight(this.options.flow === 'center' ? 0 : Math.floor(this.rows / 2)), sourceFade: 1, edgeFade: this.options.taper ? historyFade(this.rows - 1, this.rows) : 1, propagation: this.options.flow, columns: this.columns, hiddenLineOpacity: this.backLines.material.opacity, surfaceVisible: this.depthSurface.visible, mountainSurfaceVisible: this.mountainSurface.visible, hue: this.hue, camera: this.camera.position.toArray(), flightTime: this.flightTime };
  }
  trace(history, stamp) {
    for (let age = 0; age < history.count; age++) if (history.stamp(age) === stamp) {
      const start = age * this.columns * 3;
      const heights = Array.from({ length: this.columns }, (_, b) => this.positions[start + b * 3 + 1]);
      const xs = Array.from({ length: this.columns }, (_, b) => this.positions[start + b * 3]);
      const radialOffsets = Array.from({ length: this.columns }, (_, b) => Math.hypot(this.positions[start + b * 3], this.positions[start + b * 3 + 2]) - radialRadius(age, this.rows));
      return { stamp, age, accent: history.accent(age), heights, xs, radialOffsets, radius: radialRadius(age, this.rows), fade: this.options.taper ? historyFade(age, this.rows) : 1, frontZ: -4 + age * this.spacing, backZ: -4 - age * this.spacing };
    }
    return null;
  }
}

