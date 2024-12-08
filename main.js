import * as THREE from "three";
import { ImprovedNoise } from "three/examples/jsm/math/ImprovedNoise.js";
import { GPUComputationRenderer } from "three/examples/jsm/misc/GPUComputationRenderer.js";
import { SimplexNoise } from "three/examples/jsm/math/SimplexNoise.js";

// Scene, Camera, Renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Bubble in the center
const bubbleGeometry = new THREE.SphereGeometry(1, 32, 32);
const bubbleMaterial = new THREE.MeshBasicMaterial({
  color: 0x87ceeb, // Light blue
  transparent: true,
  opacity: 0.6,
});
const bubble = new THREE.Mesh(bubbleGeometry, bubbleMaterial);
scene.add(bubble);

// Initial Camera Position
let radius = 5; // Distance from the bubble
let theta = 0; // Horizontal angle (rotation around Y-axis)
let phi = Math.PI / 4; // Vertical angle (rotation from Y-axis)
camera.position.set(
  radius * Math.sin(phi) * Math.cos(theta),
  radius * Math.cos(phi),
  radius * Math.sin(phi) * Math.sin(theta)
);
camera.lookAt(0, 0, 0);

// Movement variables
const movement = { forward: 0, sideways: 0, vertical: 0 };

// Keyboard controls for movement
document.addEventListener("keydown", (event) => {
  switch (event.code) {
    case "KeyW":
      movement.forward = -1;
      break; // Move closer to the bubble
    case "KeyS":
      movement.forward = 1;
      break; // Move farther from the bubble
    case "KeyA":
      movement.sideways = -1;
      break; // Rotate left
    case "KeyD":
      movement.sideways = 1;
      break; // Rotate right
    case "Space":
      movement.vertical = 1;
      break; // Move up
    case "ShiftLeft":
      movement.vertical = -1;
      break; // Move down
  }
});

document.addEventListener("keyup", (event) => {
  switch (event.code) {
    case "KeyW":
    case "KeyS":
      movement.forward = 0;
      break;
    case "KeyA":
    case "KeyD":
      movement.sideways = 0;
      break;
    case "Space":
    case "ShiftLeft":
      movement.vertical = 0;
      break;
  }
});

// Movement update logic
const moveSpeed = 0.05; // Speed for rotating
const zoomSpeed = 0.1; // Speed for zooming in/out
function updateMovement() {
  // Horizontal rotation (A/D keys)
  theta += movement.sideways * moveSpeed;

  // Vertical rotation (Space/Shift keys)
  phi -= movement.vertical * moveSpeed;

  // Clamp phi to avoid flipping
  phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi));

  // Zoom in/out (W/S keys)
  radius += movement.forward * zoomSpeed; // Inverted direction
  radius = Math.max(2, radius); // Prevent camera from going inside the bubble

  // Update camera position
  camera.position.set(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );

  // Keep looking at the bubble
  camera.lookAt(0, 0, 0);
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  updateMovement(); // Update camera position
  renderer.render(scene, camera);
}

// Handle resizing
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/**
 *  S K Y B O X
 */
const ft = new THREE.TextureLoader().load("left.png");
const bk = new THREE.TextureLoader().load("right.png");
const up = new THREE.TextureLoader().load("top.png");
const dn = new THREE.TextureLoader().load("bottom.png");
const rt = new THREE.TextureLoader().load("back.png");
const lf = new THREE.TextureLoader().load("front.png");
const skyboxTextures = [ft, bk, up, dn, rt, lf];

// Skybox materials
const materialArray = skyboxTextures.map(
  (texture) =>
    new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide,
    })
);

// Create and add the skyboxa
const skyboxGeo = new THREE.BoxGeometry(50, 50, 50); // Adjust size as needed
const skybox = new THREE.Mesh(skyboxGeo, materialArray);
scene.add(skybox);
/**
 *
 */

// Ensure gpuCompute and heightmapVariable are initialized first
const gpuCompute = new GPUComputationRenderer(256, 256, renderer);

// Create and fill the initial heightmap texture
const heightmap0 = gpuCompute.createTexture();
fillTexture(heightmap0);

// Add the heightmap variable for GPU computation
const heightmapVariable = gpuCompute.addVariable(
  "heightmap",
  `
  precision highp float;
  uniform sampler2D heightmap;
  varying vec2 vUv;

  void main() {
    vec4 data = texture2D(heightmap, vUv);
    gl_FragColor = data;
  }
  `,
  heightmap0
);

// Set variable dependencies
gpuCompute.setVariableDependencies(heightmapVariable, [heightmapVariable]);

// Check for errors during GPUComputationRenderer initialization
const error = gpuCompute.init();
if (error !== null) {
  console.error("GPUComputationRenderer initialization error:", error);
}

// Create the water plane
const waterGeometry = new THREE.PlaneGeometry(100, 100, 256, 256);
const waterMaterial = new THREE.ShaderMaterial({
  vertexShader: `
  uniform sampler2D heightmap;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec4 heightData = texture2D(heightmap, uv);
    vec3 newPosition = position + normal * heightData.r * 2.0; // Adjust wave height
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
  }
  `,
  fragmentShader: `
  varying vec2 vUv;

  void main() {
    gl_FragColor = vec4(0.2, 0.5, 0.9, 1.0); // Deep blue
  }
  `,
  uniforms: {
    heightmap: {
      value: gpuCompute.getCurrentRenderTarget(heightmapVariable).texture,
    },
  },
});

const water = new THREE.Mesh(waterGeometry, waterMaterial);
water.rotation.x = -Math.PI / 2;
water.position.y = 25; // Place at the top of the skybox
scene.add(water);

// Fill the heightmap texture with initial values
function fillTexture(texture) {
  const data = texture.image.data;
  const simplex = new SimplexNoise();
  for (let i = 0; i < data.length; i += 4) {
    const x = (i / 4) % 256;
    const y = Math.floor(i / (4 * 256));
    const height = simplex.noise(x / 10, y / 10) * 2.0; // Adjust noise scale
    data[i] = height; // R channel
    data[i + 1] = height; // G channel
    data[i + 2] = height; // B channel
    data[i + 3] = 255; // A channel
  }
}

// Update the water surface in the animation loop
function updateWater() {
  gpuCompute.compute();
  water.material.uniforms.heightmap.value =
    gpuCompute.getCurrentRenderTarget(heightmapVariable).texture;
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  updateMovement(); // Update camera movement
  updateWater(); // Update water surface
  renderer.render(scene, camera);
}

// /**
//  * W A T E R     D I S P L A C E M E N T
//  */
// const waterWidth = 100; //skybox dimensions
// const waterHeight = 100;

// // Create a plane for the water surface
// const waterGeometry = new THREE.PlaneGeometry(
//   waterWidth,
//   waterHeight,
//   256,
//   256
// );
// const waterMaterial = new THREE.MeshPhongMaterial({
//   color: 0x1e90ff, // Deep blue
//   shininess: 100,
//   side: THREE.DoubleSide,
//   flatShading: false,
// });
// // Add custom shader logic to use the heightmap
// waterMaterial.onBeforeCompile = (shader) => {
//   shader.uniforms.heightmap = {
//     value: gpuCompute.getCurrentRenderTarget(heightmapVariable).texture,
//   };

//   shader.vertexShader = shader.vertexShader.replace(
//     "#include <common>",
//     `
//     uniform sampler2D heightmap;
//     #include <common>
//     `
//   );

//   shader.vertexShader = shader.vertexShader.replace(
//     "#include <begin_vertex>",
//     `
//     vec3 transformed = vec3( position.xy, texture2D( heightmap, uv ).x );
//     `
//   );
// };

// const water = new THREE.Mesh(waterGeometry, waterMaterial);
// water.rotation.x = -Math.PI / 2; // Rotate to lay flat
// water.position.y = 25; // Place at the top of the skybox
// scene.add(water);

// const gpuCompute = new GPUComputationRenderer(256, 256, renderer);
// const heightmap0 = gpuCompute.createTexture();
// fillTexture(heightmap0);

// const heightmapVariable = gpuCompute.addVariable(
//   "heightmap",
//   `precision highp float;
//   uniform sampler2D heightmap;
//   varying vec2 vUv;
//   void main() {
//       vec4 data = texture2D(heightmap, vUv);
//       gl_FragColor = data;
//   }`,
//   heightmap0
// );

// gpuCompute.setVariableDependencies(heightmapVariable, [heightmapVariable]);
// gpuCompute.init();

// // Update Water Mesh with Computed Heights
// function updateWater() {
//   gpuCompute.compute();
//   const currentHeightMap = gpuCompute.getCurrentRenderTarget(heightmapVariable);
//   waterMaterial.map = currentHeightMap.texture;
//   // water.material.uniforms.heightmap.value =
//   //   gpuCompute.getCurrentRenderTarget(heightmapVariable).texture;
// }

// function fillTexture(texture) {
//   const data = texture.image.data;
//   const simplex = new SimplexNoise();
//   const waterMaxHeight = 2; // Maximum height for waves

//   for (let i = 0; i < data.length; i += 4) {
//     const x = (i / 4) % texture.image.width;
//     const y = Math.floor(i / (4 * texture.image.width));
//     const height = simplex.noise(x / 10, y / 10) * waterMaxHeight;
//     data[i] = height; // R channel
//     data[i + 1] = height; // G channel
//     data[i + 2] = height; // B channel
//     data[i + 3] = 255; // A channel
//   }
// }

// // Cube inside the bubble
// const cubeGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
// const cubeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red color for better visibility
// const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
// scene.add(cube); // Add cube to the scene
// cube.position.set(0, 0, 0); // Position cube at the center of the bubble
// Hemisphere (flipped to cover the bottom half)
const terrainRadius = 0.8; // Radius of the hemisphere
const terrainSegments = 64; // Segments for smoothness
const hemisphereGeometry = new THREE.SphereGeometry(
  terrainRadius, // Radius
  terrainSegments, // Width segments
  terrainSegments, // Height segments
  0, // phiStart: Start angle horizontally (unchanged)
  Math.PI * 2, // phiLength: Full horizontal circle
  Math.PI / 2, // thetaStart: Start at the equator
  Math.PI / 2 // thetaLength: Covers only the bottom hemisphere
);

// Default material for the hemisphere with a sand color
const hemisphereMaterial = new THREE.MeshPhongMaterial({
  color: 0xd2b48c, // Tan/sand color
  shininess: 20, // Adds a subtle shine
  flatShading: false, // Ensures smooth shading
});

const hemisphere = new THREE.Mesh(hemisphereGeometry, hemisphereMaterial);
scene.add(hemisphere);

// Disc geometry for the flat cut region
const discRadius = terrainRadius; // Match the radius of the hemisphere
const discSegments = terrainSegments;
const cutRegionGeometry = new THREE.CircleGeometry(
  discRadius, // Radius of the disc
  discSegments // Segments for smoothness
);

// Rotate the disc to align with the flat cut of the hemisphere
cutRegionGeometry.rotateX(-Math.PI / 2); // Align the disc to face upwards

// Material for the disc with a light beige color
const cutRegionMaterial = new THREE.MeshPhongMaterial({
  color: 0xf5deb3, // Wheat color (light beige)
  shininess: 20, // Subtle shine
  side: THREE.DoubleSide, // Ensure visibility from both sides
});

const cutRegion = new THREE.Mesh(cutRegionGeometry, cutRegionMaterial);
scene.add(cutRegion);

// Position the disc exactly at the equator of the hemisphere
cutRegion.position.set(0, -terrainRadius / 20, 0); // Set position to the cut (equator) of the hemisphere

// Modify the disc geometry to create terrain-like bumps using Perlin noise
const perlin = new ImprovedNoise();
const scale = 4; // Scale for Perlin noise
const amplitude = 0.1; // Maximum height of terrain bumps

const positions = cutRegionGeometry.attributes.position.array;
for (let i = 0; i < positions.length; i += 3) {
  const x = positions[i];
  const z = positions[i + 2];

  // Calculate noise based on x and z
  const noise = perlin.noise(x * scale, z * scale, 0) * amplitude;

  // Update the y (height) position
  positions[i + 1] = noise; // Modify the y-coordinate (height)
}

// Update normals for correct shading
cutRegionGeometry.computeVertexNormals();
cutRegionGeometry.attributes.position.needsUpdate = true;

const light = new THREE.AmbientLight(0x404040, 1); // Ambient light with soft white color
scene.add(light);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1); // White directional light
directionalLight.position.set(0.3, 3, 1).normalize(); // Directional light from above
scene.add(directionalLight);

// // Animation loop
// function animate() {
//   requestAnimationFrame(animate);
//   updateWater(); // Update the water surface
//   updateMovement(); // Update camera
//   renderer.render(scene, camera);
// }

animate();
// // Start animation
// animate();
