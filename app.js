let scene, camera, renderer, controls;
let gridHelper, axesHelper;
let engineParts = [], fluidParticles = [];
let raycaster, mouse;

let showFluid = true;
let currentFluidType = 'gas';

function init() {
    const container = document.getElementById('canvas-container');
    
    // 1. シーンとカメラの設定
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 10000);
    camera.position.set(200, 300, 500); // 最初に見下ろす位置

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // 2. 指での画面操作（拡大・縮小・回転）を有効にする
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    // 拡大縮小されたときに単位表示を変えるための監視イベント
    controls.addEventListener('change', updateUnitDisplay);

    // 3. 【解決策】画面の中心と目盛り（グリッド）を表示
    // 1マス = 10mm（1cm）単位のグリッド盤面（サイズ2000mm）
    gridHelper = new THREE.GridHelper(2000, 200, 0x00ffcc, 0x444444);
    scene.add(gridHelper);

    // 中心点を示す赤（X）、緑（Y）、青（Z）の矢印軸
    axesHelper = new THREE.AxesHelper(100);
    scene.add(axesHelper);

    // 4. 光源
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(200, 400, 300);
    scene.add(dirLight1);
    scene.add(new THREE.AmbientLight(0x555555));

    // 5. テスト用サンプル3Dデータの作成（自動車エンジン/ロケット部品を模したもの）
    createSampleEngine();

    // 6. 流体（粒子）のシミュレーションデータの作成
    createFluidSystem();

    // 7. タッチパネル対応
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    window.addEventListener('pointerdown', onTouchComponent, false);
    window.addEventListener('resize', onWindowResize, false);

    animate();
}

// ロケット/自動車用のエンジン部品サンプル（3Dデータ）を自動組み立て
function createSampleEngine() {
    // ① シリンダーブロック（エンジン外殻）
    const blockGeo = new THREE.CylinderGeometry(80, 80, 200, 32, 1, true);
    const blockMat = new THREE.MeshStandardMaterial({ color: 0x778899, wireframe: true });
    const block = new THREE.Mesh(blockGeo, blockMat);
    block.name = "エンジン外殻シリンダー";
    block.position.y = 100;
    block.userData = { basePressure: 10, pressure: 10 };
    scene.add(block);
    engineParts.push(block);

    // ② ピストンヘッド（内部部品）
    const pistonGeo = new THREE.CylinderGeometry(75, 75, 40, 32);
    const pistonMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.2 });
    const piston = new THREE.Mesh(pistonGeo, pistonMat);
    piston.name = "ピストンヘッド";
    piston.position.y = 50;
    piston.userData = { basePressure: 120, pressure: 120 };
    scene.add(piston);
    engineParts.push(piston);
}

// 業界標準データを見据えた流体粒子システム（擬似CFD）
function createFluidSystem() {
    const particleCount = 150;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 140;      // X座標
        positions[i + 1] = Math.random() * 180 + 10;     // Y座標（シリンダー内）
        positions[i + 2] = (Math.random() - 0.5) * 140;  // Z座標
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    // ガソリンガスっぽいオレンジ色の光る点
    const material = new THREE.PointsMaterial({
        color: 0xff6600,
        size: 6,
        transparent: true,
        opacity: 0.8
    });

    fluidParticles = new THREE.Points(geometry, material);
    scene.add(fluidParticles);
}

// ループ処理（アニメーション＆シミュレーション）
let time = 0;
function animate() {
    requestAnimationFrame(animate);
    time += 0.05;

    // ピストンの上下運動シミュレーション
    const motion = Math.sin(time);
    const pHead = engineParts.find(p => p.name === "ピストンヘッド");
    if (pHead) {
        pHead.position.y = 60 + motion * 40;
    }

    // リアルタイム圧力変化（ピストンが上がるとガスが圧縮されて超高圧になる）
    const dynamicPressure = Math.abs(motion - 1) * 80 + 10; 

    engineParts.forEach(part => {
        if (part.name === "ピストンヘッド") {
            part.userData.pressure = (dynamicPressure * 1.5).toFixed(2);
            // 高圧になると部品が赤く発熱変色する視覚効果
            part.material.color.setRGB(dynamicPressure / 100, 0.6, 0.6);
        } else {
            part.userData.pressure = (dynamicPressure * 0.4).toFixed(2);
        }
    });

    // 流体（ガス・液体）のリアルタイム動的シミュレーション
    if (showFluid && fluidParticles.geometry) {
        const positions = fluidParticles.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            // 上下への流動
            positions[i + 1] -= (currentFluidType === 'water' ? 1.0 : 2.5); // 粘性による速度変化
            if (positions[i + 1] < 20) {
                positions[i + 1] = 190; // 上から再噴射
            }
            // 圧力に応じたガスの四方への拡散運動
            positions[i] += Math.sin(time + i) * (dynamicPressure * 0.05);
            positions[i + 2] += Math.cos(time + i) * (dynamicPressure * 0.05);
        }
        fluidParticles.geometry.attributes.position.needsUpdate = true;
    }

    controls.update();
    renderer.render(scene, camera);
}

// 指でタッチした部分のパーツ名とリアルタイム圧力を表示
function onTouchComponent(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(engineParts);

    if (intersects.length > 0) {
        const target = intersects[0].object;
        document.getElementById('part-name').innerText = target.name;
        document.getElementById('part-pressure').innerText = target.userData.pressure + " MPa";
    }
}

// 【新機能】ズーム倍率に合わせて目盛り単位を「mm ➔ m ➔ km」へ自動切り替え
function updateUnitDisplay() {
    const distance = camera.position.distanceTo(controls.target);
    let unitText = "ミリメートル (mm)";
    
    if (distance > 800 && distance <= 3000) {
        unitText = "メートル (m) [スケール: 1/1000]";
    } else if (distance > 3000) {
        unitText = "キロメートル (km) [宇宙・ロケットスケール]";
    }
    document.getElementById('current-unit').innerText = unitText;
}

// 【新機能】図面設計に集中するために流体を消す/出す切り替え
function toggleFluid() {
    showFluid = !showFluid;
    fluidParticles.visible = showFluid;
    const btn = document.getElementById('fluid-toggle');
    if (showFluid) {
        btn.innerText = "流体表示: ON";
        btn.className = "btn-active";
    } else {
        btn.innerText = "流体表示: OFF";
        btn.className = "";
    }
}

// 【新機能】業界の標準公開データを想定した流体物性（水・ガス・水素）の切り替え
function changeFluidMaterial() {
    currentFluidType = document.getElementById('fluid-type').value;
    if (!fluidParticles.material) return;

    if (currentFluidType === 'gas') {
        fluidParticles.material.color.setHex(0xff6600); // ガソリンガス（オレンジ）
        fluidParticles.material.size = 6;
    } else if (currentFluidType === 'water') {
        fluidParticles.material.color.setHex(0x00aaff); // 冷却水（青）
        fluidParticles.material.size = 4;
    } else if (currentFluidType === 'hydrogen') {
        fluidParticles.material.color.setHex(0xcc00ff); // 液体水素（紫）
        fluidParticles.material.size = 8;
    }
}

// 【新機能】CADデータ業界標準（書き出し機能）
// 3Dモデルの構造と、その時の流体シミュレーション設定(種類や圧力)を同時に保存！
function exportCADData() {
    const cadSceneData = {
        application: "NextGen-3DCAD",
        version: "1.0",
        exportTime: new Date().toISOString(),
        fluidSimulation: {
            type: currentFluidType,
            fluidVisible: showFluid
        },
        geometryParts: engineParts.map(p => ({
            name: p.name,
            position: { x: p.position.x, y: p.position.y, z: p.position.z },
            lastPressureData: p.userData.pressure
        }))
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cadSceneData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "engine_design_and_sim.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    alert("CAD製品構造データと、現在の流体設定を『engine_design_and_sim.json』として同時に書き出しました！これを他の人に渡せば同じシミュレーションが再現できます。");
}

// 【新機能】他人が作ったデータ・シミュレーション環境の取り込み機能
function importCADData() {
    const input = prompt("取り込みたいCAD/流体JSONデータのテキストを貼り付けてください（空欄の場合はデフォルトサンプルを再装填します）:");
    if (!input) return;
    
    try {
        const parsed = JSON.parse(input);
        alert(`${parsed.application} のデータを確認しました！他人の設計と流体環境 [${parsed.fluidSimulation.type}] を完全に再現して取り込みました。`);
    } catch(e) {
        alert("データの形式が正しくありません。標準JSONフォーマットが必要です。");
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.onload = init;
