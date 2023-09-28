//********************************************************************************************************************
//  Imports
//********************************************************************************************************************
import * as THREE from "three";

//********************************************************************************************************************
//  Balloon Variables
//********************************************************************************************************************

const quaternion = new THREE.Quaternion();
const balloonScale = new THREE.Vector3(20, 20, 20);
const maxBalloons = 50;

//--------------------------------------------------------------------------------------------
//  Create the balloons using the GLTF loader and an instanced mesh to render them efficiently
//--------------------------------------------------------------------------------------------
export function createBalloons(scene, api, glbLoader, propData) {   
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
    const balloonMesh = new THREE.InstancedMesh(
        balloonGeometries[0], 
        balloonMaterial,
        maxBalloons,
    );
    
    initBalloons(scene,api,propData,balloonMesh);
    return balloonMesh;

    });
}
  

//--------------------------------------------------------------------------------------------
//  Initialize the balloons by setting their properties and then adding the data to the array
//--------------------------------------------------------------------------------------------
export function initBalloons(scene,api,propData,balloonMesh) {
    for (let i = 0; i < maxBalloons; i++) {
        let startX = Math.random() * 100 - 50;
        let startY = Math.random() * 10 - 100;
        let startZ = Math.random() * 100 - 50;
        let startPos = new THREE.Vector3(startX, startY, startZ);
        let randomY = Math.random() * 0.1 - 0.05;

        propData.balloonData.push({
        position: startPos.clone(),
        quaternion: quaternion.clone(),
        scale: balloonScale.clone(),
        velocity: new THREE.Vector3(0, api.velocity + randomY, 0),
        popped: false,
        index: i,
        });

        balloonMesh.setMatrixAt(
            i,
            new THREE.Matrix4().compose(startPos, quaternion, balloonScale),
        );
        balloonMesh.setColorAt(i, new THREE.Color(api.color));
    }

    scene.add(balloonMesh);
}

//--------------------------------------------------------------------------------------------
//  Update the position of the balloons based on their velocity and reset them when they reach
//  the top of the screen
//--------------------------------------------------------------------------------------------
export function updateBalloonPositions(api, balloonData, balloonMesh) {
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

//--------------------------------------------------------------------------------------------
//  Update the color of the balloons based on the color picker
//--------------------------------------------------------------------------------------------
export function updateBalloonColors(api, balloonMesh) {
    
    if(balloonMesh){
        let newColor = new THREE.Color(api.color);
        for (let i = 0; i < maxBalloons; i++) {
            balloonMesh.setColorAt(i, newColor);
        }
    }

    balloonMesh.instanceColor.needsUpdate = true;
}

//--------------------------------------------------------------------------------------------
//  Update the velocity of the balloons based on the slider
//--------------------------------------------------------------------------------------------
export function updateBalloonVelocities(api, balloonData) {
    if(balloonData.length === 0) return;

    for (let i = 0; i < maxBalloons; i++) {
        let randomY = Math.random() * 0.1;
        balloonData[i].velocity.y = api.velocity + randomY;
    }
}
