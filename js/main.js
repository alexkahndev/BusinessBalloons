//********************************************************************************************************************
//  Business Balloons
//  Author: Alex Kahn
//  Company: Event Games
//  Date: 9/14/2023
//  Description: A game where you pop balloons to get points
//  Resources: sources.txt
//********************************************************************************************************************

//********************************************************************************************************************
//  Imports
//********************************************************************************************************************

import * as THREE from "three";
import * as BALLOON from "./balloon.js";
import Stats from "three/addons/libs/stats.module.js";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";

//********************************************************************************************************************
//  Global Variables
//********************************************************************************************************************

//--------------------------------------------------------------------------------------------
//  ThreeJS Variables
//--------------------------------------------------------------------------------------------
let renderer, scene, gui, camera, orbitalControls, aspect;

//--------------------------------------------------------------------------------------------
//  Mesh Variables
//--------------------------------------------------------------------------------------------
let balloonMesh, poppedBalloonMesh;

//--------------------------------------------------------------------------------------------
//  Material Variables
//--------------------------------------------------------------------------------------------
let logoTexture;

//--------------------------------------------------------------------------------------------
//  Prop Variables
//--------------------------------------------------------------------------------------------
let balloonData = [];
let propData = {
  balloonData: [],
};

//--------------------------------------------------------------------------------------------
//  Mouse Variables
//--------------------------------------------------------------------------------------------
let selected = null;
let mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

//--------------------------------------------------------------------------------------------
//  Statistic Variables
//--------------------------------------------------------------------------------------------
const clock = new THREE.Clock();
const stats = new Stats();


//--------------------------------------------------------------------------------------------
//  Loader Variables
//--------------------------------------------------------------------------------------------
const glbLoader = new GLTFLoader();
const rgbeLoader = new RGBELoader();
const fontLoader = new FontLoader();
const audioLoader = new THREE.AudioLoader();
const textureLoader = new THREE.TextureLoader();

//--------------------------------------------------------------------------------------------
//  Audio Variables
//--------------------------------------------------------------------------------------------
const audioListener = new THREE.AudioListener();

//--------------------------------------------------------------------------------------------
//  Geometry Default Variables
//--------------------------------------------------------------------------------------------
const quaternion = new THREE.Quaternion();
const balloonScale = new THREE.Vector3(20, 20, 20);
const maxBalloons = 50;
const gridWidthScale = 0.09;
const gridHeightScale = 0.09;

const api = {
  velocity: 0.1,
  color: 0xff0000,
  score: 0,
  timer: clock.getElapsedTime(),
};

//********************************************************************************************************************
//  Main (starts the render loop)
//********************************************************************************************************************

init();
animate();


//********************************************************************************************************************
//  Initialization Functions
//********************************************************************************************************************

//--------------------------------------------------------------------------------------------
//  Initialize the scene and all of its components
//--------------------------------------------------------------------------------------------

function init() {
  // renderer
  renderer = new THREE.WebGLRenderer({ antialias: true});
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // scene
  scene = new THREE.Scene();

  // camera
  aspect = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera(
    75, // fov
    aspect, // aspect ratio
    0.1, // near clipping plane 
    1000 // far clipping plane
  );
  camera.position.set(0, 0, 75);
  //camera.rotation.order = "YXZ"; 

  // audio
  camera.add(audioListener);

  // orbital controls
  orbitalControls = new OrbitControls(camera, renderer.domElement);
  orbitalControls.enablePan = false;

  // lights
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

  // sky
  rgbeLoader.load("./resources/skies/sky.hdr", function (texture) {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = texture;
    scene.environment = texture;
  });

  // balloon
  createBalloons();

  // gui
  createGUI();

  // event listeners
  window.addEventListener("resize", onWindowResize);
  window.addEventListener("mousedown", mouseDown, false);
  window.addEventListener("mousemove", mouseMove, false);
  window.addEventListener("keydown", onDocumentKeyDown, false);
  window.addEventListener("keyup", onDocumentKeyUp, false);

  // stats
  document.body.appendChild(stats.dom);
}

//--------------------------------------------------------------------------------------------
//  Create the GUI using the functions from the lil-gui module
//--------------------------------------------------------------------------------------------
function createGUI() {
  gui = new GUI();
  gui.add(api, "velocity", 0, 0.5).onChange(updateVelocities);
  gui.addColor(api, "color").onChange(updateBalloonColors);
  gui.add(api, "score").listen();
  gui.add(api, "timer").listen();

}

//--------------------------------------------------------------------------------------------
//  Create the balloons using the GLTF loader and an instanced mesh to render them efficiently
//--------------------------------------------------------------------------------------------
function createBalloons() {
  glbLoader.load("resources/props/balloon.glb", function (gltf) {
    const balloon = gltf.scene;
    let balloonGeometries = [];
    balloon.speed = api.speed;
    balloon.traverse(function (node) {
      if (node.isMesh) {
        balloonGeometries.push(node.geometry);
      }
    });

    const balloonMaterial = new THREE.MeshPhongMaterial();
    balloonMesh = new THREE.InstancedMesh(
      balloonGeometries[0], 
      balloonMaterial,
      maxBalloons,
    );

    logoTexture = textureLoader.load("resources/logos/event_games_logo.jpg");

    initBalloons();
  });
}

//--------------------------------------------------------------------------------------------
//  Initialize the balloons by setting their properties and then adding the data to the array
//--------------------------------------------------------------------------------------------
function initBalloons() {
  for (let i = 0; i < maxBalloons; i++) {
    let startX = (Math.random() * window.innerWidth - window.innerWidth / 2) * gridWidthScale;
    let startY = Math.random() * 15 - window.innerHeight * gridHeightScale;
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

//--------------------------------------------------------------------------------------------
//  Update the position of the balloons based on their velocity and reset them when they reach
//  the top of the screen
//--------------------------------------------------------------------------------------------
function updateBalloonPositions() {
  for (let i = 0; i < maxBalloons; i++) {
    let balloon = balloonData[i];
    let updatedPos = balloon.position.clone();
    let velocity = balloon.velocity.clone();

    updatedPos.add(velocity);

    if (updatedPos.y > window.innerHeight * gridHeightScale - 15) {
      updatedPos.x = (Math.random() * window.innerWidth - window.innerWidth / 2) * gridWidthScale;
      updatedPos.y = Math.random() * 10 - window.innerHeight * gridHeightScale;
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

//--------------------------------------------------------------------------------------------
//  Update the color of the balloons based on the color picker
//--------------------------------------------------------------------------------------------
function updateBalloonColors() {
  let newColor = new THREE.Color(api.color);
  for (let i = 0; i < maxBalloons; i++) {
    balloonMesh.setColorAt(i, newColor);
  }

  balloonMesh.instanceColor.needsUpdate = true;
}

//--------------------------------------------------------------------------------------------
//  Update the velocity of the balloons based on the slider
//--------------------------------------------------------------------------------------------
function updateVelocities() {
  for (let i = 0; i < maxBalloons; i++) {
    let randomY = Math.random() * 0.1;
    balloonData[i].velocity.y = api.velocity + randomY;
  }
}

//********************************************************************************************************************
//  Event Functions
//********************************************************************************************************************

//--------------------------------------------------------------------------------------------
//  When the screen is resized, update the camera and renderer as well as any other components
//--------------------------------------------------------------------------------------------
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

//--------------------------------------------------------------------------------------------
//  Handle the mouse moving over the screen
//--------------------------------------------------------------------------------------------
function mouseMove(event) {
  event.preventDefault();
}

//--------------------------------------------------------------------------------------------
//  When the mouse is clicked, check if it intersects with a balloon and pop it if it does
//--------------------------------------------------------------------------------------------
function mouseDown(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  let intersects = raycaster.intersectObjects([balloonMesh]);
  if (intersects.length > 0) {
    selected = intersects[0].instanceId;
    balloonMesh.setColorAt(selected, new THREE.Color(0x0000ff));
    balloonMesh.instanceColor.needsUpdate = true;
    balloonData[selected].popped = true;
    api.score ++;  
  }
}

//********************************************************************************************************************
// Key Press Functions
//********************************************************************************************************************

//--------------------------------------------------------------------------------------------
//  When a key is pressed, check which key it is and perform the appropriate action
//--------------------------------------------------------------------------------------------
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

//--------------------------------------------------------------------------------------------
//  When a key is released, check which key it is and perform the appropriate action
//--------------------------------------------------------------------------------------------
function onDocumentKeyUp(event) {}

//********************************************************************************************************************
// Animation Functions
//********************************************************************************************************************

//--------------------------------------------------------------------------------------------
//  The render loop that updates the scene every frame
//--------------------------------------------------------------------------------------------
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