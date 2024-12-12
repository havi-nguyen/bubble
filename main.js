import * as THREE from "three";
import { ImprovedNoise } from "three/examples/jsm/math/ImprovedNoise.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/****************************************************************************
 *
 * Scene, Camera, Renderer
 *
 ****************************************************************************/
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
const moveSpeed = 0.02; // Speed for rotating
const zoomSpeed = 0.05; // Speed for zooming in/out
function updateMovement() {
  // Horizontal rotation (A/D keys)
  theta += movement.sideways * moveSpeed;

  // Vertical rotation (Space/Shift keys)
  phi -= movement.vertical * moveSpeed;

  // Clamp phi to avoid flipping
  phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi));

  // Zoom in/out (W/S keys)
  radius += movement.forward * zoomSpeed; // Inverted direction

  // Update camera position
  camera.position.set(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );

  // Keep looking at the bubble
  camera.lookAt(0, 0, 0);
}

// Handle resizing
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const listener = new THREE.AudioListener();
camera.add(listener);
const sound = new THREE.Audio(listener);
const audioLoader = new THREE.AudioLoader();
audioLoader.load("ambient.ogg", function (buffer) {
  sound.setBuffer(buffer);
  sound.setLoop(true);
  sound.setVolume(0.5);
  sound.play();
});

/****************************************************************************
 *
 * Lighting
 *
 ****************************************************************************/
const light = new THREE.AmbientLight(0x404040, 1); // Ambient light with soft white color
scene.add(light);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1); // White directional light
directionalLight.position.set(0.3, 3, 1).normalize(); // Directional light from above
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 2); // Brighter ambient light
scene.add(ambientLight);

/****************************************************************************
 *
 * Skybox
 *
 ****************************************************************************/
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

/****************************************************************************
 *
 * Refraction Environment Map / Bubble
 *
 ****************************************************************************/
let isRefractionEnabled = true;
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
    envMap: { value: environmentMap }, // Refraction map
    refractionRatio: { value: 0.98 }, // Refraction ratio
    time: { value: 0.0 }, // Animation time
    color: { value: new THREE.Color(0x87ceeb) }, // Base bubble color
    useRefraction: { value: true }, // Whether to use refraction
  },
  vertexShader: `
    varying vec3 vWorldPosition;
    varying vec3 vNormal;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPosition, 1.0);
    }
  `,
  fragmentShader: `
    uniform samplerCube envMap;
    uniform float refractionRatio;
    uniform float time;
    uniform vec3 color;
    uniform bool useRefraction;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;

    void main() {
      vec3 viewDir = normalize(vWorldPosition - cameraPosition);
      vec3 refractedDir = refract(viewDir, vNormal, refractionRatio);

      // Use environment map if refraction is enabled, fallback to base color otherwise
      vec3 envColor = useRefraction ? textureCube(envMap, refractedDir).rgb : vec3(0.0, 0.0, 0.0);

      // Iridescence effect
      float iridescence = sin(dot(vNormal, vec3(0.0, 1.0, 0.0)) * 10.0 + time) * 0.5 + 0.5;

      // Final bubble color blending
      vec3 bubbleColor = mix(color, envColor, useRefraction ? 0.5 : 0.0);
      bubbleColor = mix(bubbleColor, color, iridescence * 0.2);

      gl_FragColor = vec4(bubbleColor, 0.4); // Adjust alpha for transparency
    }
  `,
  transparent: true,
});

const bubble = new THREE.Mesh(bubbleGeometry, bubbleMaterial);
scene.add(bubble);
const originalBubbleMaterial = new THREE.MeshBasicMaterial({
  color: 0x87ceeb,
  transparent: true,
  opacity: 0.3,
});

// Toggle refraction environment map on/off
window.addEventListener("keydown", (event) => {
  if (event.code === "KeyR") {
    isRefractionEnabled = !isRefractionEnabled;
    if (isRefractionEnabled) {
      bubble.material = bubbleMaterial;
    } else {
      bubble.material = originalBubbleMaterial;
    }
  }
});

/****************************************************************************
 *
 * Sand / Hemisphere and Disc
 *
 ****************************************************************************/
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

/****************************************************************************
 *
 * Bubbles / Particle System
 *
 ****************************************************************************/
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

const loaders = new GLTFLoader();

loaders.load(
  "seaweed.glb",
  function (gltf) {
    const seaweed = gltf.scene;

    seaweed.scale.set(0.5, 0.5, 0.5);
    seaweed.position.set(-0.5, 0.05, 0.0);
    scene.add(seaweed);
  },
  undefined,
  function (error) {
    console.error(error);
  }
);

loaders.load(
  "seaweed.glb",
  function (gltf) {
    const sea = gltf.scene;

    sea.scale.set(0.5, 0.5, 0.5);
    sea.position.set(-0.5, 0.1, 0.0);
    sea.rotateX(45);
    scene.add(sea);
  },
  undefined,
  function (error) {
    console.error(error);
  }
);

loaders.load(
  "rock.glb",
  function (gltf) {
    const rock = gltf.scene;

    rock.scale.set(0.7, 0.7, 0.7);
    rock.position.set(0.5, 0.1, 0.0);
    scene.add(rock);
  },
  undefined,
  function (error) {
    console.error(error);
  }
);

loaders.load(
  "white.glb",
  function (gltf) {
    const white = gltf.scene;

    white.scale.set(0.01, 0.01, 0.01);
    white.position.set(-0.1, 0.0, 0.6);
    scene.add(white);
  },
  undefined,
  function (error) {
    console.error(error);
  }
);

loaders.load(
  "coral.glb",
  function (gltf) {
    const coral = gltf.scene;

    coral.scale.set(0.04, 0.04, 0.04);
    coral.position.set(-0.5, 0.0, 0.0);
    scene.add(coral);
  },
  undefined,
  function (error) {
    console.error(error);
  }
);

loaders.load(
  "purple_coral.glb",
  function (gltf) {
    const corals = gltf.scene;

    corals.scale.set(0.05, 0.05, 0.05);
    corals.position.set(-0.3, 0.002, -0.5);
    scene.add(corals);
  },
  undefined,
  function (error) {
    console.error(error);
  }
);

loaders.load(
  "cluster.glb",
  function (gltf) {
    const cluster = gltf.scene;

    cluster.scale.set(0.05, 0.05, 0.05);
    cluster.position.set(0, -0.15, -0.5);
    scene.add(cluster);
  },
  undefined,
  function (error) {
    console.error(error);
  }
);

loaders.load(
  "spined.glb",
  function (gltf) {
    const purple = gltf.scene;

    purple.scale.set(0.0005, 0.0005, 0.0005);
    purple.position.set(-0.3, 0.002, -0.2);
    scene.add(purple);
  },
  undefined,
  function (error) {
    console.error(error);
  }
);

/****************************************************************************
 *
 * Fish / Texture Loading
 *
 ****************************************************************************/
const loader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader(); // Texture loader for loading textures

// Preload all textures based on indices provided
const textures = [
  textureLoader.load("./textures/body_baseColor.png"), // index 0
  textureLoader.load("./textures/body_metallicRoughness.png"), // index 1
  textureLoader.load("./textures/body_normal.png"), // index 2

  textureLoader.load("./textures/Fin_down_baseColor.png"), // index 3
  textureLoader.load("./textures/Fin_down_metallicRoughness.png"), // index 4
  textureLoader.load("./textures/Fin_down_normal.png"), // index 5

  textureLoader.load("./textures/fin_back_baseColor.png"), // index 6
  textureLoader.load("./textures/fin_back_metallicRoughness.png"), // index 7
  textureLoader.load("./textures/fin_back_nomral.png"), // index 8

  textureLoader.load("./textures/fin_top_baseColor.png"), // index 9
  textureLoader.load("./textures/fin_top_metallicRoughness.png"), // index 10
  textureLoader.load("./textures/fin_top_normal.png"), // index 11

  textureLoader.load("./textures/eyes_baseColor.png"), // index 12
  textureLoader.load("./textures/eyes_metallicRoughness.png"), // index 13
];

loader.load(
  "./red_betta_fish/scene.gltf",
  (gltf) => {
    const fish = gltf.scene;

    // Log loaded GLTF object
    console.log("GLTF Loaded:", fish);

    // Scale and position adjustments
    fish.scale.set(0.0008, 0.0008, 0.0008);
    fish.position.set(0, 0, 0);

    // Traverse and apply textures based on the materials' names
    fish.traverse((node) => {
      if (node.isMesh) {
        const material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(0xffabfa), // Set the color to orange
          metalness: 0.2, // Adjust metalness
          roughness: 0.8, // Adjust roughness
        });

        // Optional: Remove the texture map to prioritize the color
        if (node.name === "body" || node.name.startsWith("Fin")) {
          material.map = null; // Ensure no base color texture conflicts with the color
        } else if (node.name === "eyes") {
          material.color = new THREE.Color(0x000000); // Keep the eyes black
        }

        material.side = THREE.DoubleSide; // Ensure visibility from both sides
        node.material = material;
      }
    });

    // Add fish to the scene
    scene.add(fish);
    window.fish = fish;

    console.log("Fish added to scene:", fish.position);

    /****************************************************************************
     *
     * Fish / Movement
     *
     ****************************************************************************/
    // Compute fish's bounding box
    const boundingBox = new THREE.Box3().setFromObject(fish);
    const fishDimensions = new THREE.Vector3();
    boundingBox.getSize(fishDimensions);

    // Calculate the radius buffer (distance from the center to the furthest part of the fish)
    const fishRadiusBuffer = fishDimensions.length() / 2;

    // Initial fish position and direction
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
    let fishSpeed = getRandomSpeed(0.0001, 0.002); // Slower speed between 0.001 and 0.0020

    // Time tracking for direction changes
    let changeDirectionCounter = 0;
    const changeDirectionInterval = 300; // Increase the interval to change direction every 300 frames

    // Ensure the fish stays inside the 0.9-radius sphere (accounting for its size)
    function keepInsideSphere(position, maxRadius, buffer) {
      // If the fish moves outside the sphere, reflect its position back inside
      if (position.length() + buffer > maxRadius) {
        position.normalize().multiplyScalar(maxRadius - buffer - 0.01); // Slightly inside
        // Reverse direction to prevent immediately leaving again
        fishDirection.reflect(position.clone().normalize());
      }

      // Ensure the fish stays in the top hemisphere (y >= 0)
      if (position.y <= 0) {
        position.y = 0; // Prevent fish from going below the equator
        fishDirection.y = Math.abs(fishDirection.y); // Adjust direction to stay upwards
      }
    }

    // Ensure the fish stays in the top hemisphere (y >= 0)
    function keepInTopHemisphere(position) {
      if (position.y < 0) {
        position.y = Math.abs(position.y); // Reflect to stay above equator
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

      // Ensure movement stays within the 0.9-radius sphere
      keepInsideSphere(newPosition, 0.9, fishRadiusBuffer);

      // Ensure the fish stays in the top hemisphere
      keepInTopHemisphere(newPosition);

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

      // Point the fish in the direction it's moving
      const targetQuaternion = new THREE.Quaternion();
      targetQuaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1), // Default forward direction
        fishDirection.clone().normalize() // Fish's movement direction
      );
      fish.quaternion.copy(targetQuaternion);
    }

    /****************************************************************************
     *
     * Animation
     *
     ****************************************************************************/
    function animate() {
      requestAnimationFrame(animate);
      updateFish();
      updateMovement();
      updateParticles();
      renderer.render(scene, camera);
    }
    animate();
  },
  (xhr) => {
    console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
  },
  (error) => {
    console.error("An error occurred while loading the GLTF file:", error);
  }
);
