import * as THREE from "three";

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

// Cube inside the bubble
const cubeGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const cubeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red color for better visibility
const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
scene.add(cube); // Add cube to the scene
cube.position.set(0, 0, 0); // Position cube at the center of the bubble

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

// Create and add the skyboxa
const skyboxGeo = new THREE.BoxGeometry(50, 50, 50); // Adjust size as needed
const skybox = new THREE.Mesh(skyboxGeo, materialArray);
scene.add(skybox);

// Start animation
animate();
