let scene, camera, renderer, controls;
let gridHelper, axesHelper;
let engineParts = [], fluidParticles = [];
let raycaster, mouse;

let showFluid = true;
let currentFluidType = 'gas';
let isUIVisible = true;

function init() {
    const container = document.getElementById('canvas-container');
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.set(200, 300, 500);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.addEventListener('change', updateUnitDisplay);

    // 目盛りがはっきり見えるように色と位置を再設定
    gridHelper = new THREE.GridHelper(1000, 100, 0x00ffcc, 0x555555);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    axesHelper = new THREE.AxesHelper(150);
    scene.add(axesHelper);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight1.position.set(200, 400, 300);
    scene.add(dirLight1);
    scene.add(new THREE.AmbientLight(0x666666));

    createSampleEngine();
    createFluidSystem();

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    window.addEventListener('pointerdown', onTouchComponent, false);
    window.addEventListener('resize', onWindowResize, false);

    animate();
}

function createSampleEngine() {
    const blockGeo = new THREE.CylinderGeometry(80, 80, 200, 32, 1, true);
    const blockMat = new THREE.MeshStandardMaterial({ color: 0x778899, wireframe: true });
    const block = new THREE.Mesh(blockGeo, blockMat);
    block.name = "エンジン外殻シリンダー";
    block.position.y = 100;
    block.userData = { pressure: 10 };
    scene.add(block);
    engineParts.push(block);

    const pistonGeo = new THREE.CylinderGeometry(75, 75, 40, 32);
    const pistonMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.2 });
    const piston = new THREE.Mesh(pistonGeo, pistonMat);
    piston.name = "ピストンヘッド";
    piston.position.y = 50;
    piston.userData = { pressure: 120 };
    scene.add(piston);
    engineParts.push(piston);
}

function createFluidSystem() {
    const particleCount = 150;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 140;
        positions[i + 1] = Math.random() * 180 + 10;
        positions[i + 2] = (Math.random() - 0.5) * 140;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
        color: 0xff6600,
        size: 8,
        transparent: true,
        opacity: 0.9
    });

    fluidParticles = new THREE.Points(geometry, material);
    scene.add(fluidParticles);
}

function animate() {
    requestAnimationFrame(animate);
    let time = Date.now() * 0.003;

    const motion = Math.sin(time);
    const pHead = engineParts.find(p => p.name === "ピストンヘッド");
    if (pHead) {
        pHead.position.y = 80 + motion * 40;
    }

    const dynamicPressure = Math.abs(motion - 1) * 80 + 10; 

    engineParts.forEach(part => {
        if (part.name === "ピストンヘッド") {
            part.userData.pressure = (dynamicPressure * 1.5).toFixed(2);
            part.material.color.setRGB(dynamicPressure / 100, 0.5, 0.5);
        } else {
            part.userData.pressure = (dynamicPressure * 0.4).toFixed(2);
        }
    });

    if (showFluid && fluidParticles.geometry) {
        const positions = fluidParticles.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            positions[i + 1] -= (currentFluidType === 'water' ? 1.0 : 3.0);
            if (positions[i + 1] < 10) positions[i + 1] = 190;
            positions[i] += Math.sin(time + i) * 0.5;
            positions[i + 2] += Math.cos(time + i) * 0.5;
        }
        fluidParticles.geometry.attributes.position.needsUpdate = true;
    }

    controls.update();
    renderer.render(scene, camera);
}

function onTouchComponent(event) {
    // UIをタップした時は判定しない
    if (event.clientX < 300 && isUIVisible) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(engineParts);

    if (intersects.length > 0) {
        const target = intersects.object;
        document.getElementById('part-name').innerText = target.name;
        document.getElementById('part-pressure').innerText = target.userData.pressure + " MPa";
    }
}

function updateUnitDisplay() {
    const distance = camera.position.distanceTo(controls.target);
    let unitText = "ミリメートル (mm)";
    if (distance > 800 && distance <= 2500) {
        unitText = "メートル (m) [1/1000]";
    } else if (distance > 2500) {
        unitText = "キロメートル (km) [ロケットサイズ]";
    }
    document.getElementById('current-unit').innerText = unitText;
}

// 【集中モード】右上のボタンで枠を消したり出したりする関数
function toggleUIPanel() {
    const panel = document.getElementById('control-panel');
    const btn = document.getElementById('toggle-panel-btn');
    isUIVisible = !isUIVisible;
    
    if (isUIVisible) {
        panel.style.opacity = "1";
        panel.style.pointerEvents = "auto";
        btn.innerText = "🛠️";
    } else {
        panel.style.opacity = "0";
        panel.style.pointerEvents = "none";
        btn.innerText = "❌"; // 閉じている時は×マークにする
    }
}

function toggleFluid() {
    showFluid = !showFluid;
    fluidParticles.visible = showFluid;
    const btn = document.getElementById('fluid-toggle');
    btn.innerText = showFluid ? "流体表示: ON" : "流体表示: OFF";
    btn.className = showFluid ? "btn-active" : "";
}

function changeFluidMaterial() {
    currentFluidType = document.getElementById('fluid-type').value;
    if (!fluidParticles.material) return;
    if (currentFluidType === 'gas') {
        fluidParticles.material.color.setHex(0xff6600);
        fluidParticles.material.size = 8;
    } else if (currentFluidType === 'water') {
        fluidParticles.material.color.setHex(0x00aaff);
        fluidParticles.material.size = 5;
    } else if (currentFluidType === 'hydrogen') {
        fluidParticles.material.color.setHex(0xcc00ff);
        fluidParticles.material.size = 10;
    }
}

function exportCADData() {
    const cadSceneData = {
        application: "NextGen-3DCAD",
        geometryParts: engineParts.map(p => ({ name: p.name, lastPressureData: p.userData.pressure }))
    };
    alert(JSON.stringify(cadSceneData, null, 2));
}

function importCADData() {
    alert("取り込み機能を起動しました（開発中）");
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.onload = init;
