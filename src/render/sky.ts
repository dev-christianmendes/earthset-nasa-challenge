// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Céu relativo à câmera, sem paralaxe de 700 m: efemérides offline, escala angular e horizonte LOLA.
import * as THREE from 'three';
import { BODY_IDS, angularRadius, bodyAt, direction, equatorial, sampleIndex, terrestrial, transform, type BodyId } from '../astronomy/sky';
import { SKY } from '../data/sky';
import { SUN } from '../data/sun';
import { TERRAIN } from '../data/terrain';
import { sampleAt } from '../engine/sun';
import type { Site } from '../engine/resources';

const DISTANCE = 700;
const horizonUniform = { value: [...TERRAIN.sites.peak.horizon_deg] };
const horizonShader = `
  uniform float horizon[72];
  varying vec3 skyDirection;
  void clipHorizon() {
    vec3 d = normalize(skyDirection);
    float p = mod(atan(d.x, -d.z) / 6.28318530718 + 1.0, 1.0) * 72.0;
    int i = int(floor(p)); int j = i == 71 ? 0 : i + 1;
    float limit = max(0.0, mix(horizon[i], horizon[j], fract(p)));
    if (asin(clamp(d.y, -1.0, 1.0)) * 57.2957795131 <= limit) discard;
  }
`;
const vertex = `
  varying vec3 skyDirection;
  varying vec3 sphereNormal;
  varying vec2 texCoord;
  void main() {
    vec3 p = (modelMatrix * vec4(position, 1.0)).xyz;
    skyDirection = p; sphereNormal = normal; texCoord = uv;
    gl_Position = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(p, 1.0);
    gl_Position.z = gl_Position.w * 0.99999;
  }
`;
function sphereMaterial(fragment: string, uniforms: Record<string, THREE.IUniform> = {}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({ uniforms: { horizon: horizonUniform, ...uniforms }, vertexShader: vertex,
    fragmentShader: horizonShader + '\nvarying vec3 sphereNormal; varying vec2 texCoord;\n' + fragment,
    depthWrite: false, toneMapped: true });
}
const sphere = new THREE.SphereGeometry(1, 48, 24);
export const astronomicalSky = new THREE.Group();
astronomicalSky.name = 'astronomical-sky';
const solarDisc = new THREE.Mesh(sphere, sphereMaterial(`
  void main() { clipHorizon(); gl_FragColor = vec4(vec3(12.0), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`));
solarDisc.name = 'sun-apparent-disc';
astronomicalSky.add(solarDisc);

const earthMap = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}textures/earth/earth_land_shallow_topo_2048.jpg`);
earthMap.colorSpace = THREE.SRGBColorSpace;
const earthSun = { value: new THREE.Vector3(1, 0, 0) };
const earth = new THREE.Mesh(sphere, sphereMaterial(`
  uniform sampler2D earthMap; uniform vec3 earthSun;
  void main() { clipHorizon();
    float sunlight = max(0.0, dot(normalize(sphereNormal), earthSun));
    gl_FragColor = vec4(texture2D(earthMap, texCoord).rgb * sunlight * 2.2, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`, { earthMap: { value: earthMap }, earthSun }));
earth.name = 'earth-apparent-disc';
astronomicalSky.add(earth);

const planets = BODY_IDS.filter((id): id is Exclude<BodyId, 'sun' | 'earth'> => id !== 'sun' && id !== 'earth');
const count = SKY.stars.samples.length + planets.length;
const pointPositions = new Float32Array(count * 3);
const magnitudes = new Float32Array(count);
SKY.stars.samples.forEach((star, i) => { magnitudes[i] = star.magnitude; });
const pointGeometry = new THREE.BufferGeometry();
pointGeometry.setAttribute('position', new THREE.BufferAttribute(pointPositions, 3));
pointGeometry.setAttribute('magnitude', new THREE.BufferAttribute(magnitudes, 1));
const skyExposure = { value: 0.12 };
const points = new THREE.Points(pointGeometry, new THREE.ShaderMaterial({
  uniforms: { horizon: horizonUniform, skyExposure }, transparent: true, depthWrite: false,
  vertexShader: `attribute float magnitude; varying float flux; varying vec3 skyDirection;
    void main() { skyDirection = position; flux = pow(10.0, -0.4 * magnitude);
      gl_Position = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
      gl_Position.z = gl_Position.w * 0.99999;
      gl_PointSize = clamp(1.4 + 0.22 * (2.0 - magnitude), 0.8, 2.6);
    }`,
  fragmentShader: horizonShader + `uniform float skyExposure; varying float flux;
    void main() { clipHorizon(); float r = length(gl_PointCoord - vec2(0.5)) * 2.0;
      if (r > 1.0) discard;
      float brightness = min(4.0, flux * skyExposure);
      gl_FragColor = vec4(vec3(brightness), (1.0-smoothstep(0.35,1.0,r)) * min(1.0, brightness));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}));
points.name = 'catalog-stars-and-planets';
astronomicalSky.add(points);
for (const object of [solarDisc, earth, points]) { object.frustumCulled = false; object.renderOrder = -10; }

function frame(a: THREE.Vector3, north: THREE.Vector3): THREE.Matrix4 {
  const b = north.clone().addScaledVector(a, -north.dot(a)).normalize();
  return new THREE.Matrix4().makeBasis(a, b, new THREE.Vector3().crossVectors(a, b));
}
let lastSample = -1;
let lastSite: Site | null = null;
/** Long exposure é apresentação opcional no painel Ciência; não altera energia, relógio ou luz. */
export function updateSky(hour: number, lit: boolean, site: Site, longExposure = false): void {
  skyExposure.value = longExposure ? 12 : lit ? 0.06 : 1.5;
  const h = sampleIndex(SKY, hour);
  if (h === lastSample && site === lastSite) return;
  lastSample = h; lastSite = site;
  horizonUniform.value = [...TERRAIN.sites[site].horizon_deg];
  const solar = sampleAt(SUN, hour);
  solarDisc.position.fromArray(direction(solar.az, solar.el)).multiplyScalar(DISTANCE);
  solarDisc.scale.setScalar(angularRadius(bodyAt(SKY, 'sun', hour).diameter_arcsec, DISTANCE));
  const sample = bodyAt(SKY, 'earth', hour);
  const d = new THREE.Vector3().fromArray(direction(sample.az, sample.el));
  earth.position.copy(d).multiplyScalar(DISTANCE);
  earth.scale.setScalar(angularRadius(sample.diameter_arcsec, DISTANCE));
  const matrix = SKY.icrf_to_local[h];
  // Orientação da textura pelo ponto subobservador e eixo terrestre do Horizons; sem emissivo no lado noturno.
  const observer = new THREE.Vector3().fromArray(terrestrial(sample.observer_lon!, sample.observer_lat!));
  const north = new THREE.Vector3().fromArray(transform(matrix, equatorial(sample.pole_ra!, sample.pole_dec!)));
  earth.quaternion.setFromRotationMatrix(frame(d.clone().negate(), north).multiply(frame(observer, new THREE.Vector3(0, 1, 0)).transpose()));
  earthSun.value.fromArray(terrestrial(sample.solar_lon!, sample.solar_lat!));
  SKY.stars.samples.forEach((star, i) => {
    const v = transform(matrix, equatorial(star.ra, star.dec));
    pointPositions.set(v.map((x) => x * DISTANCE), i * 3);
  });
  planets.forEach((id, i) => {
    const p = bodyAt(SKY, id, hour);
    pointPositions.set(direction(p.az, p.el).map((x) => x * DISTANCE), (SKY.stars.samples.length + i) * 3);
    magnitudes[SKY.stars.samples.length + i] = p.magnitude ?? 99;
  });
  pointGeometry.attributes.position.needsUpdate = true;
  pointGeometry.attributes.magnitude.needsUpdate = true;
}
