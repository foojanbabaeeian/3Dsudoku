import * as THREE from 'https://cdn.jsdelivr.net/npm/three@latest/build/three.module.js';

// Create Scene, Camera, and Renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Clear the scene to ensure no leftover objects
scene.clear();

// Parameters for the Grid
const gridSize = 3; // 3x3x3 grid
const cellSize = 1.5; // Distance between cubes

// Create a 3D Grid of Cubes
for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
        for (let z = 0; z < gridSize; z++) {
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const material = new THREE.MeshBasicMaterial({
                color: 0xffffff, // Default color (white)
                wireframe: true, // Wireframe for better visibility
            });

            const cube = new THREE.Mesh(geometry, material);

            // Position the cube in the 3D grid
            cube.position.set(
                x * cellSize - (gridSize * cellSize) / 2,
                y * cellSize - (gridSize * cellSize) / 2,
                z * cellSize - (gridSize * cellSize) / 2
            );

            scene.add(cube);
        }
    }
}

// Adjust Camera Position to View the Entire Grid
camera.position.z = 10;

// Animation Loop to Spin the Grid
function animate() {
    requestAnimationFrame(animate);

    // Rotate the entire grid (scene)
    scene.rotation.x += 0.01;
    scene.rotation.y += 0.01;

    // Render the scene
    renderer.render(scene, camera);
}
animate();
