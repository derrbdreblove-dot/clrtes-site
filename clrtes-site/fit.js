import * as THREE from "https://esm.sh/three@0.179.1";
import { GLTFLoader } from "https://esm.sh/three@0.179.1/examples/jsm/loaders/GLTFLoader.js";

const canvasHost = document.getElementById("threeCanvas");

let avatar;
let mixer;
let clock = new THREE.Clock();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0a);

const camera = new THREE.PerspectiveCamera(
  45,
  canvasHost.clientWidth / 720,
  0.1,
  1000
);

camera.position.set(0, 1.6, 4.8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(canvasHost.clientWidth, 720);
renderer.setPixelRatio(window.devicePixelRatio);
canvasHost.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 1.8));

const keyLight = new THREE.DirectionalLight(0xffffff, 2);
keyLight.position.set(5, 10, 8);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xbfbfbf, 1);
fillLight.position.set(-5, 5, 5);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffffff, 0.6);
rimLight.position.set(0, 5, -8);
scene.add(rimLight);

// floor
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(5, 64),
  new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.92,
    metalness: 0.08
  })
);

floor.rotation.x = -Math.PI / 2;
floor.position.y = -1.9;
scene.add(floor);

// loader
const loader = new GLTFLoader();

loader.load(
  "./assets/avatar.glb",

  (gltf) => {

    avatar = gltf.scene;

    avatar.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    scene.add(avatar);

    const box = new THREE.Box3().setFromObject(avatar);
    const center = box.getCenter(new THREE.Vector3());

    avatar.position.x -= center.x;
    avatar.position.y -= center.y;
    avatar.position.z -= center.z;

    const size = box.getSize(new THREE.Vector3());
    const scale = 3 / size.y;

    avatar.scale.setScalar(scale);

    avatar.position.y = -1.9;

    // animation
    if (gltf.animations && gltf.animations.length > 0) {

      mixer = new THREE.AnimationMixer(avatar);

      const action = mixer.clipAction(gltf.animations[0]);

      action.play();

    }

  },

  undefined,

  (error) => {
    console.error("Avatar failed to load:", error);
  }

);

// rotate avatar
let rotating = false;
let prevX = 0;

renderer.domElement.addEventListener("mousedown", (e) => {
  rotating = true;
  prevX = e.clientX;
});

window.addEventListener("mouseup", () => {
  rotating = false;
});

window.addEventListener("mousemove", (e) => {

  if (!rotating || !avatar) return;

  const delta = e.clientX - prevX;

  avatar.rotation.y += delta * 0.01;

  prevX = e.clientX;

});

// zoom
renderer.domElement.addEventListener("wheel", (e) => {

  e.preventDefault();

  camera.position.z += e.deltaY * 0.003;

  camera.position.z = Math.max(2, Math.min(10, camera.position.z));

});

// resize
function onResize() {

  const width = canvasHost.clientWidth;
  const height = 720;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);

}

window.addEventListener("resize", onResize);

// animate
function animate() {

  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  if (mixer) mixer.update(delta);

  renderer.render(scene, camera);

}

animate();