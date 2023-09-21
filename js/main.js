//Imports

import * as THREE from "three";
import Stats from "three/addons/libs/stats.module.js";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";

// Global Variables

let renderer, scene, gui, camera, orbitalControls;
let balloonMaterial, logoMaterial;
let balloonMesh, frontLogoMesh, backLogoMesh, poppedBalloonMesh;
let logoTexture;
let footerMaterial;
let selected = null;
let numbersLoaded = false;
let balloonGeometries = [];
let numbers = [];
let balloonData = [];
let mouse = new THREE.Vector2();

const raycaster = new THREE.Raycaster();
const clock = new THREE.Clock();
const stats = new Stats();
const glbLoader = new GLTFLoader();
const rgbeLoader = new RGBELoader();
const fontLoader = new FontLoader();
const textureLoader = new THREE.TextureLoader();
const maxBalloons = 50;
const quaternion = new THREE.Quaternion();
const balloonScale = new THREE.Vector3(20, 20, 20);
const logoScale = new THREE.Vector3(5, 5, 5);

document.body.appendChild(stats.dom);

const api = {
  velocity: 0.1,
  color: 0xff0000,
  score: 0,
  timer: clock.getElapsedTime(),
};

// Initialize

function init() {
  // renderer
  renderer = new THREE.WebGLRenderer();
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // scene
  scene = new THREE.Scene();

  // sky
  rgbeLoader.load("./resources/skies/sky.hdr", function (texture) {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = texture;
    scene.environment = texture;
  });

  // camera
  camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    1,
    1000,
  );
  camera.position.set(0, 0, 75);
  camera.rotation.order = "YXZ";

  // orbital controls
  orbitalControls = new OrbitControls(camera, renderer.domElement);
  orbitalControls.enablePan = false;

  // light
  const light = new THREE.PointLight(0xffffff, 0.9, 0, 100000);
  light.position.set(0, 50, 120);
  light.castShadow = true;
  light.shadow.mapSize.width = 512; // default
  light.shadow.mapSize.height = 512; // default
  light.shadow.camera.near = 0.5; // default
  light.shadow.camera.far = 5000; // default

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
  directionalLight.castShadow = true;
  directionalLight.position.set(-5, 20, 4);
  directionalLight.target.position.set(9, 0, -9);
  directionalLight.shadow.camera.left *= 9;
  directionalLight.shadow.camera.right *= 9;
  directionalLight.shadow.camera.top *= 9;
  directionalLight.shadow.camera.bottom *= 9;

  scene.add(light);
  scene.add(directionalLight);

  // balloon
  createBalloons();

  // gui
  createGUI();

  //overlay
  //createNumberGeometries();
  //createOverlay();

  // event listeners
  window.addEventListener("resize", onWindowResize);
  window.addEventListener("mousedown", mouseDown, false);
  window.addEventListener("mousemove", mouseMove, false);
  window.addEventListener("keydown", onDocumentKeyDown, false);
  window.addEventListener("keyup", onDocumentKeyUp, false);
}

// GUI

function createGUI() {
  gui = new GUI();
  gui.add(api, "velocity", 0, 2).onChange(updateVelocities);
  gui.addColor(api, "color").onChange(updateBalloonColors);
  gui.add(api, "score").listen();
  gui.add(api, "timer").listen();

}

// Overlay

function createOverlay() {
  const footerGeometry = new THREE.BoxGeometry(75, 5, 1);
  const footerMaterial = getFooterMaterial();
  const footerMesh = new THREE.Mesh(footerGeometry, footerMaterial);
  footerMesh.position.set(0, -17, 30);
  scene.add(footerMesh);
}

function getFooterMaterial() {
  // Define a shader for the rainbow animation
  const rainbowVertexShader = `
  varying vec2 vUv;
  uniform float time;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
  `;

  const rainbowFragmentShader = `
  varying vec2 vUv;
  uniform float time;

  void main() {
    vec3 rainbowColors = vec3(
      0.5 + 0.5 * sin(time),
      0.5 + 0.5 * sin(time + 2.0),
      0.5 + 0.5 * sin(time + 4.0)
    );
    
    gl_FragColor = vec4(rainbowColors, 1.0);
  }
  `;

  // Create a shader material
  footerMaterial = new THREE.ShaderMaterial({
    vertexShader: rainbowVertexShader,
    fragmentShader: rainbowFragmentShader,
    uniforms: {
      time: { value: 0.0 }, // Time uniform for animation
    },
  });

  return footerMaterial;
}

// Numbers

function createNumberGeometries() {
  fontLoader.load('./resources/fonts/Gloock_Regular.json', function (font) {
    for (let i = 0; i < 10; i++) {
      let numberGeometry = new TextGeometry(i.toString(), {
        font: font,
        size: 10,
        height: 1,
        curveSegments: 12,
        bevelEnabled: false,
      });

      let numberMaterial = new THREE.MeshPhongMaterial();
      let numberMesh = new THREE.Mesh(numberGeometry, numberMaterial);
      numberMesh.position.set(0, 0, 0);
      numberMesh.rotation.set(0, 0, 0);
      numbers.push(numberMesh);
    }
  });

  numbersLoaded = true;
}

// Balloon

function createBalloons() {
  glbLoader.load("resources/props/balloon.glb", function (gltf) {
    let balloon = gltf.scene;
    balloon.speed = api.speed;
    balloon.traverse(function (node) {
      if (node.isMesh) {
        balloonGeometries.push(node.geometry);
        console.log(node.name);
      }
    });

    balloonMaterial = new THREE.MeshPhongMaterial();
    balloonMesh = new THREE.InstancedMesh(
      balloonGeometries[0], // Use the geometry from the GLTF model
      balloonMaterial,
      maxBalloons,
    );

    frontLogoMesh = new THREE.InstancedMesh(
      balloonGeometries[1], // Use the geometry from the GLTF model
      logoMaterial,
      maxBalloons,
    );

    backLogoMesh = new THREE.InstancedMesh(
      balloonGeometries[2], // Use the geometry from the GLTF model
      logoMaterial,
      maxBalloons,
    );

    logoTexture = textureLoader.load("resources/logos/event_games_logo.jpg");

    initBalloons();
  });
}

function initBalloons() {
  for (let i = 0; i < maxBalloons; i++) {
    let startX = Math.random() * 50 - 25;
    let startY = Math.random() * 10 - 50;
    let startZ = Math.random() * 50 - 25;
    let startPos = new THREE.Vector3(startX, startY, startZ);
    let randomY = Math.random() * 0.1 - 0.05;

    balloonData.push({
      position: startPos.clone(),
      quaternion: quaternion.clone(),
      scale: balloonScale.clone(),
      velocity: new THREE.Vector3(0, api.velocity + randomY, 0),
      popped: false,
      logo: logoTexture.clone(),
      index: i,
    });

    balloonMesh.setColorAt(i, new THREE.Color(api.color));
  }

  scene.add(balloonMesh);
}

function updateBalloonPositions() {
  for (let i = 0; i < maxBalloons; i++) {
    let balloon = balloonData[i];
    let updatedPos = balloon.position.clone();
    let velocity = balloon.velocity.clone();

    updatedPos.add(velocity);

    if (updatedPos.y > 50) {
      updatedPos.x = Math.random() * 50 - 25;
      updatedPos.y = Math.random() * 10 - 50;
      updatedPos.z = Math.random() * 50 - 25;
      balloonMesh.setColorAt(i, new THREE.Color(api.color));
      balloonData[i].popped = false;
      balloonMesh.instanceColor.needsUpdate = true;
    }

    balloon.position = updatedPos;
    balloonMesh.setMatrixAt(
      i,
      new THREE.Matrix4().compose(updatedPos, quaternion, balloonScale),
    );
  }

  balloonMesh.instanceMatrix.needsUpdate = true;
}

function updateBalloonColors() {
  let newColor = new THREE.Color(api.color);
  for (let i = 0; i < maxBalloons; i++) {
    balloonMesh.setColorAt(i, newColor);
  }

  balloonMesh.instanceColor.needsUpdate = true;
}

function updateVelocities() {
  for (let i = 0; i < maxBalloons; i++) {
    let randomY = Math.random() * 0.1;
    balloonData[i].velocity.y = api.velocity + randomY;
  }
}

// Mouse and Window Events

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function mouseMove(event) {
  event.preventDefault();
}

function mouseDown(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  var intersects = raycaster.intersectObjects([balloonMesh]);

  for (var i = 0; i < intersects.length; i++) {
    selected = intersects[i].instanceId;
    console.log("Selected object: " + selected);
    balloonMesh.setColorAt(selected, new THREE.Color(0x0000ff));
    balloonMesh.instanceColor.needsUpdate = true;
    balloonData[selected].popped = true;
    api.score ++;
    console.log(api.score);
  }
}

// Key Press Functions

function onDocumentKeyDown(event) {
  if (event.keyCode == 87) {
    // Keycode for 'W'
  }
  if (event.keyCode == 83) {
    // Keycode for 'S'
  }
  if (event.keyCode == 65) {
    // Keycode for 'A'
  }
  if (event.keyCode == 68) {
    // Keycode for 'D'
  }
  if (event.keyCode == 32) {
    // Keycode for Spacebar
  }
  if (event.keyCode == 16) {
    // Keycode for Shift
  }
  if (event.keyCode == 187) {
    // Keycode for '+'
  }
  if (event.keyCode == 189) {
    // Keycode for '-'
  }
}

function onDocumentKeyUp(event) {}

// Animation Functions

function render() {
  renderer.render(scene, camera);
}

function animate() {
  requestAnimationFrame(animate);

  // update the scene
  if (balloonMesh) {
    updateBalloonPositions();
    //footerMaterial.uniforms.time.value += 0.01;
  }

  renderer.render(scene, camera);
  stats.update();
  api.timer = clock.getElapsedTime();

}

// Main Functions (starts the render loop)

init();
render();
animate();
