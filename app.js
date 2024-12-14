import * as THREE from './node_modules/three/build/three.module.js';
import { FontLoader } from 'node_modules/three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'node_modules/three/examples/jsm/geometries/TextGeometry.js';


// Create Scene, Camera, and Renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

console.log("3D Sudoku Grid with Numbers Loaded");

// Clear the scene to ensure no leftover objects
scene.clear();

// Parameters for the Grid
const gridSize = 3; // 3x3x3 grid
const cellSize = 1.5; // Distance between cubes
const fontUrl = 'https://cdn.jsdelivr.net/npm/three@latest/examples/fonts/helvetiker_regular.typeface.json';

// Predefined Valid 3D Sudoku Puzzle (3x3x3 Array)
const sudokuPuzzle = [
    [
        [1, 2, 3], [4, 5, 6], [7, 8, 9]
    ],
    [
        [7, 8, 9], [1, 2, 3], [4, 5, 6]
    ],
    [
        [4, 5, 6], [7, 8, 9], [1, 2, 3]
    ]
];

// Load the Font
const fontLoader = new FontLoader();
fontLoader.load(fontUrl, (font) => {
    // Create a 3D Grid of Cubes
    for (let x = 0; x < gridSize; x++) {
        for (let y = 0; y < gridSize; y++) {
            for (let z = 0; z < gridSize; z++) {
                // Create the Cube
                const geometry = new THREE.BoxGeometry(1, 1, 1);
                const material = new THREE.MeshBasicMaterial({
                    color: 0xffffff, // Default color (white)
                    wireframe: true, // Wireframe for visibility
                });

                const cube = new THREE.Mesh(geometry, material);

                // Position the Cube
                cube.position.set(
                    x * cellSize - (gridSize * cellSize) / 2,
                    y * cellSize - (gridSize * cellSize) / 2,
                    z * cellSize - (gridSize * cellSize) / 2
                );

                // Add the Cube to the Scene
                scene.add(cube);

                // Get the Number from the Sudoku Puzzle
                const number = sudokuPuzzle[x][y][z];

                // Create the Number Text
                const textGeometry = new TextGeometry(number.toString(), {
                    font: font,
                    size: 0.5, // Size of the number
                    height: 0.1, // Depth of the number
                });
                const textMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 }); // Black color for numbers
                const textMesh = new THREE.Mesh(textGeometry, textMaterial);

                // Position the Number at the Center of the Cube
                textMesh.position.set(
                    cube.position.x - 0.25, // Center alignment adjustment
                    cube.position.y - 0.25,
                    cube.position.z + 0.6 // Slightly in front of the cube for visibility
                );

                // Add the Number to the Scene
                scene.add(textMesh);
            }
        }
    }
});

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
