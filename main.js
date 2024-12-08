import * as THREE from "three";
import { ImprovedNoise } from "three/examples/jsm/math/ImprovedNoise.js";

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

// Refraction Environment Map
const cubeTextureLoader = new THREE.CubeTextureLoader();
const environmentMap = cubeTextureLoader.load([
  "right.png", // Positive X
  "left.png", // Negative X
  "top.png", // Positive Y
  "bottom.png", // Negative Y
  "front.png", // Positive Z
  "back.png", // Negative Z
]);
environmentMap.mapping = THREE.CubeRefractionMapping; // Enable refraction mapping

// Bubble in the center
const bubbleGeometry = new THREE.SphereGeometry(1, 64, 64); // Higher resolution for better visuals
const bubbleMaterial = new THREE.ShaderMaterial({
  uniforms: {
    envMap: { value: environmentMap }, // Link the environment map
    refractionRatio: { value: 0.98 }, // Refraction index
    time: { value: 0.0 },
    color: { value: new THREE.Color(0xffffff) }, // Bubble base color
  },
  vertexShader: `
    varying vec3 vWorldPosition;
    varying vec3 vNormal;

    void main() {
      vNormal = normalize(normalMatrix * normal); // Pass normals to fragment shader
      vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz; // World position of the vertex
      gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPosition, 1.0);
    }
  `,
  fragmentShader: `
    uniform samplerCube envMap;
    uniform float refractionRatio;
    uniform float time;
    uniform vec3 color;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;

    void main() {
      vec3 viewDir = normalize(vWorldPosition - cameraPosition); // View direction
      vec3 refractedDir = refract(viewDir, vNormal, refractionRatio); // Refracted direction
      vec3 envColor = textureCube(envMap, refractedDir).rgb; // Fetch the refracted color

      // Add iridescence for a bubble effect
      float iridescence = sin(dot(vNormal, vec3(0.0, 1.0, 0.0)) * 10.0 + time) * 0.5 + 0.5;
      vec3 bubbleColor = mix(envColor, color, iridescence * 0.2); // Blend with iridescence

      gl_FragColor = vec4(bubbleColor, 0.4); // Transparent bubble
    }
  `,
  transparent: true,
});

const bubble = new THREE.Mesh(bubbleGeometry, bubbleMaterial);
scene.add(bubble);

// Add this to the animation loop
let previousTimestamp = 0;

// Animate the bubble shader's time uniform
function animateBubbleMaterial(delta) {
  bubbleMaterial.uniforms.time.value += delta; // Increment time for iridescence animation
}

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
  updateParticles();
  updateFish();
  renderer.render(scene, camera);
  const delta = (timestamp - previousTimestamp) * 0.001; // Convert to seconds
  previousTimestamp = timestamp;

  animateBubbleMaterial(delta);
}

// Handle resizing
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// skybox functionality
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

// Create and add the skybox
const skyboxGeo = new THREE.BoxGeometry(50, 50, 50); // Adjust size as needed
const skybox = new THREE.Mesh(skyboxGeo, materialArray);
scene.add(skybox);

const terrainRadius = 0.9; // Radius of the hemisphere
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

// Default material for the hemisphere with a sand color
const hemisphereMaterial = new THREE.MeshPhongMaterial({
  color: 0xd2b48c, // Tan/sand color
  shininess: 20, // Adds a subtle shine
  flatShading: false, // Ensures smooth shading
});

const hemisphere = new THREE.Mesh(hemisphereGeometry, hemisphereMaterial);
scene.add(hemisphere);

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

// Bubbles on Mouse Click and Drag
let bubbleGenerationCounter = 0; // Counter to control frequency
const activeParticleSystems = [];
let isMouseDown = false; // Track whether the mouse is pressed
let mousePosition = new THREE.Vector3(); // Track mouse world position

// Function to create a particle system
function createParticleSystem(position) {
  const particleCount = 50; // Number of particles
  const particlesGeometry = new THREE.BufferGeometry();
  const particlesMaterial = new THREE.PointsMaterial({
    color: 0x87ceeb,
    transparent: true,
    opacity: 0.8,
    size: 0.1,
  });

  // Create particle positions and velocities
  const particlePositions = new Float32Array(particleCount * 3);
  const particleVelocities = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    const index = i * 3;

    const angle = Math.random() * Math.PI * 2; // Random angle for circular distribution
    const radius = Math.random() * 0.5; // Random radius within a range

    particlePositions[index] = position.x + Math.cos(angle) * radius;
    particlePositions[index + 1] = position.y + Math.random() * 0.2; // Slight vertical offset
    particlePositions[index + 2] = position.z + Math.sin(angle) * radius;

    particleVelocities[index] = (Math.random() - 0.5) * 0.02; // x velocity
    particleVelocities[index + 1] = 0.02 + Math.random() * 0.04; // y velocity
    particleVelocities[index + 2] = (Math.random() - 0.5) * 0.02; // z velocity
  }
  particlesGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(particlePositions, 3)
  );

  const particles = new THREE.Points(particlesGeometry, particlesMaterial);
  scene.add(particles);

  activeParticleSystems.push({ particles, particleVelocities, lifetime: 2 });
}

document.addEventListener("mousedown", (event) => {
  isMouseDown = true;
  updateMousePosition(event); // Update mouse position immediately on click
});

// Event listener for mousemove
document.addEventListener("mousemove", (event) => {
  if (isMouseDown) {
    updateMousePosition(event); // Continuously update mouse position while dragging
  }
});

// Event listener for mouseup
document.addEventListener("mouseup", () => {
  isMouseDown = false;
});

// Function to update mouse position
function updateMousePosition(event) {
  // Convert screen coordinates to normalized device coordinates (NDC)
  const mouse = new THREE.Vector2();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Convert NDC to world space
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  // Set the mouse position in the world space
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Horizontal plane
  const intersectionPoint = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(groundPlane, intersectionPoint)) {
    mousePosition.copy(intersectionPoint);
  }
}

// Update all active particle systems
function updateParticles() {
  // Generate particles if mouse is down
  if (isMouseDown) {
    bubbleGenerationCounter++;
    if (bubbleGenerationCounter % 5 === 0) {
      // Create a particle system every 5 frames
      createParticleSystem(mousePosition);
    }
  } else {
    bubbleGenerationCounter = 0; // Reset counter when mouse is not pressed
  }

  for (let i = activeParticleSystems.length - 1; i >= 0; i--) {
    const system = activeParticleSystems[i];
    const positions = system.particles.geometry.attributes.position.array;
    const velocities = system.particleVelocities;

    for (let j = 0; j < positions.length; j += 3) {
      positions[j] += velocities[j]; // Update x
      positions[j + 1] += velocities[j + 1]; // Update y (upward movement)
      positions[j + 2] += velocities[j + 2]; // Update z
    }

    system.particles.geometry.attributes.position.needsUpdate = true;

    // Decrease lifetime and remove the system if expired
    system.lifetime -= 0.003;
    if (system.lifetime <= 0) {
      scene.remove(system.particles);
      activeParticleSystems.splice(i, 1);
    }
  }
}

// Fish
const fishGeometry = new THREE.SphereGeometry(0.1, 16, 16); // Fish radius is 0.1
const fishMaterial = new THREE.MeshPhongMaterial({ color: 0xff6347 });
const fish = new THREE.Mesh(fishGeometry, fishMaterial);
scene.add(fish);

// Initial position and direction
let fishPosition = new THREE.Vector3(0.3, 0.2, 0.1); // Start near the center of the sphere
let fishDirection = new THREE.Vector3(
  Math.random(),
  Math.random(),
  Math.random()
).normalize(); // Random initial direction

// Randomized fish speed within a range
function getRandomSpeed(min, max) {
  return Math.random() * (max - min) + min; // Random speed between min and max
}
let fishSpeed = getRandomSpeed(0.001, 0.002); // Slower speed between 0.005 and 0.015

// Time tracking for direction changes
let changeDirectionCounter = 0;
const changeDirectionInterval = 300; // Increase the interval to change direction every 300 frames

// Ensure the fish stays inside the 0.8-radius sphere and the top hemisphere
function keepInsideTopHalfSphere(position, maxRadius) {
  // If the fish moves outside the sphere, reflect its position back inside
  if (position.length() > maxRadius) {
    position.normalize().multiplyScalar(maxRadius - 0.1); // Move it slightly inside
    // Reverse direction to prevent immediately leaving again
    fishDirection.reflect(position.clone().normalize());
  }

  // Ensure the fish stays in the top hemisphere (y >= 0)
  if (position.y < 0) {
    position.y = Math.abs(position.y); // Reflect it to stay above the equator
    fishDirection.y = Math.abs(fishDirection.y); // Adjust direction to point upwards
  }
}

// Update fish movement
function updateFish() {
  // Randomize speed slightly every few frames
  if (changeDirectionCounter++ >= changeDirectionInterval) {
    fishSpeed = getRandomSpeed(0.001, 0.002); // Adjust speed every few frames
    changeDirectionCounter = 0;
  }

  // Attempt to move the fish
  const newPosition = fishPosition
    .clone()
    .add(fishDirection.clone().multiplyScalar(fishSpeed));

  // Ensure movement stays within the 0.8-radius sphere and top hemisphere
  keepInsideTopHalfSphere(newPosition, 0.8);

  // Update fish's position
  fishPosition.copy(newPosition);

  // Randomly change direction every few frames
  if (changeDirectionCounter++ >= changeDirectionInterval) {
    fishDirection
      .set(
        Math.random() - 0.5, // Random X
        Math.random() * 0.5, // Positive bias for Y to stay in the top hemisphere
        Math.random() - 0.5 // Random Z
      )
      .normalize();
    changeDirectionCounter = 0;
  }

  // Update the fish's position in the scene
  fish.position.copy(fishPosition);
}

// Start animation
animate();
