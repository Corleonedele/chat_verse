// import logo from './logo.svg';
// import { Face, Pose, Hand } from "kalidokit";
import React from 'react';
import { Holistic } from "@mediapipe/holistic"
import { Camera } from "@mediapipe/camera_utils"
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { VRM, VRMSchema, VRMUtils } from '@pixiv/three-vrm';
import * as THREE from 'three';
import * as Kalidokit from "kalidokit";
import ChatBar from './ChatBar';

var VRMs = [];
var transforms = [];
var uids = [];

const theta = 2*Math.PI/9;

var uids_loading = [] // 用于记录正在下载VRM的玩家，避免重复下载

var oldLookTarget = new THREE.Euler();
const clock = new THREE.Clock();
const renderer =  new THREE.WebGLRenderer({alpha:true});
var orbitCamera;
var orbitControls

var motion_socket = null;
var uid;
var my_idx = -1;

function ChatRoom() {

    /* State Defnewion */
    const [ videoElement, setVideoElement ] = React.useState(null);
    const [ camera, setCamera ] = React.useState(null)
    const [ holistic, setHolistic ] = React.useState(null)
    const [ scene, setScene ] = React.useState(null)

    
    /* Initalizing Functions */

    const getUid = () => {
        // 从 URL Params 获取 roon name
        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
        uid = urlParams.get('uid');
    }

    const newVideoElement = () => setVideoElement(document.querySelector(".input_video"));

    const newHolistic = () =>{
        setHolistic(new Holistic({
            locateFile: file => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1635989137/${file}`;
            }
        }))
    }

    const initHolistic = () => {
        holistic.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.7,
            refineFaceLandmarks: true,
        });
        holistic.onResults(onResults);
    }

    const newCamera = () => setCamera(new Camera(videoElement, {
        onFrame: async () => {
            await holistic.send({image: videoElement});
        },
        width: 640,
        height: 480
    }))

    const newScene = () => {
        setScene( new THREE.Scene() )
    }

    const newLight = () => {
        const light = new THREE.DirectionalLight(0xffffff);
        light.position.set(1.0, 1.0, 1.0).normalize();
        scene.add(light);
    }

    const initRenderingPipeline = () => {

        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(renderer.domElement);

        // 下面这行可以禁用THREE的交互
        // renderer.domElement.style.pointerEvents = "none" 

        orbitCamera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight,0.1,1000);
        orbitCamera.position.set(0.0, 1.4, 0.7);

        orbitControls = new OrbitControls(orbitCamera, renderer.domElement);
        orbitControls.screenSpacePanning = true;
        orbitControls.target.set(0.0, 1.4, 0.0);
        orbitControls.update();
    }




    /* Logic Functions */

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const loadVRM = (_uid) => {

        if(!scene) { console.log("No scene, return");return}

        uids_loading.push(_uid)

        const loader = new GLTFLoader();
        loader.crossOrigin = "anonymous";

        // TODO: 不同的UID从不同的URL获取
        // 需要查询Avatar数据库
        loader.load(
            "https://cdn.glitch.com/29e07830-2317-4b15-a044-135e73c7f840%2FAshtra.vrm?v=1630342336981",
    
            gltf => {
                VRMUtils.removeUnnecessaryJoints(gltf.scene);
    
                VRM.from(gltf).then(vrm => {
                    let idx = VRMs.length
                    scene.add(vrm.scene);
                    VRMs[idx] = vrm
                    uids[idx] = _uid
                    if(toString(_uid)===toString(uid)){
                        my_idx=idx
                        initControl()
                    }
                    console.log("Loaded a new player",uid, idx)
                    uids_loading.splice(uids_loading.indexOf(uid),1)
                });
                
            },
    
            progress =>
                // console.log(
                //     "Loading model...",
                //     100.0 * (progress.loaded / progress.total),
                //     "%"
                // ),
    
            error => {
                console.error(error)

            }
        );
    }

    /* SHOULD DEBUG */
    // 不想思考角度换算了，谁来思考一下
    const initControl = () => {

        if(my_idx!==undefined){

            transforms[my_idx] = {x:0, z:0, r:0}

            document.addEventListener('keypress', e=>{
                if(transforms[my_idx]){
                    var e = e || window.event;
                    if(e.key == 'w'){
                        transforms[my_idx].z -= 0.1 * Math.cos(transforms[my_idx].r*theta)
                        transforms[my_idx].x -= 0.1 * Math.sin(transforms[my_idx].r*theta)
                        console.log(transforms[my_idx].x, transforms[my_idx].z)
                    }
                    if(e.key == 's'){	
                        transforms[my_idx].z += 0.1 * Math.cos(transforms[my_idx].r*theta)
                        transforms[my_idx].x += 0.1 * Math.sin(transforms[my_idx].r*theta)
                    }
                    if(e.key == 'a'){
                        transforms[my_idx].r += 0.3
                    }
                    if(e.key == 'd'){	
                        transforms[my_idx].r -= 0.3
                        console.log(transforms[my_idx].r)
                    }
                }
            }) 
        }
    }


    const rigRotation = (
        idx,
        name,
        rotation = { x: 0, y: 0, z: 0 },
        dampener = 1,
        lerpAmount = 0.3
    ) => {
        let currentVrm = VRMs[idx]
        if (!currentVrm) {return}
        const Part = currentVrm.humanoid.getBoneNode(
            VRMSchema.HumanoidBoneName[name]
        );
        if (!Part) {return}

        
        let euler = new THREE.Euler(
            rotation.x * dampener,
            rotation.y * dampener,
            rotation.z * dampener
        );
        let quaternion = new THREE.Quaternion().setFromEuler(euler);
        Part.quaternion.slerp(quaternion, lerpAmount); // interpolate
    };

    // Animate Position Helper Function
    const rigPosition = (
        idx,
        name,
        position = { x: 0, y: 0, z: 0 },
        dampener = 1,
        lerpAmount = 0.3
    ) => {
        let currentVrm = VRMs[idx]
        if (!currentVrm) {return}
        const Part = currentVrm.humanoid.getBoneNode(
        VRMSchema.HumanoidBoneName[name]
        );
        if (!Part) {return}
        let vector = new THREE.Vector3(
            position.x * dampener,
            position.y * dampener,
            position.z * dampener
        );
        Part.position.lerp(vector, lerpAmount); // interpolate
    };

    const rigFace = (idx, riggedFace) => {

        let currentVrm = VRMs[idx]

        // Renaming sime useful functions for easy use.
        const remap = Kalidokit.Utils.remap;
        const clamp = Kalidokit.Utils.clamp;
        const lerp = Kalidokit.Vector.lerp;

        

        if(!currentVrm){return}
        rigRotation(idx, "Neck", riggedFace.head, 0.7);
    
        // Blendshapes and Preset Name Schema
        const Blendshape = currentVrm.blendShapeProxy;
        const PresetName = VRMSchema.BlendShapePresetName;
      
        // Simple example without winking. Interpolate based on old blendshape, then stabilize blink with `Kalidokit` helper function.
        // for VRM, 1 is closed, 0 is open.
        riggedFace.eye.l = lerp(clamp(1 - riggedFace.eye.l, 0, 1),Blendshape.getValue(PresetName.Blink), .5)
        riggedFace.eye.r = lerp(clamp(1 - riggedFace.eye.r, 0, 1),Blendshape.getValue(PresetName.Blink), .5)
        riggedFace.eye = Kalidokit.Face.stabilizeBlink(riggedFace.eye,riggedFace.head.y)
        Blendshape.setValue(PresetName.Blink, riggedFace.eye.l);
        
        // Interpolate and set mouth blendshapes
        Blendshape.setValue(PresetName.I, lerp(riggedFace.mouth.shape.I,Blendshape.getValue(PresetName.I), .5));
        Blendshape.setValue(PresetName.A, lerp(riggedFace.mouth.shape.A,Blendshape.getValue(PresetName.A), .5));
        Blendshape.setValue(PresetName.E, lerp(riggedFace.mouth.shape.E,Blendshape.getValue(PresetName.E), .5));
        Blendshape.setValue(PresetName.O, lerp(riggedFace.mouth.shape.O,Blendshape.getValue(PresetName.O), .5));
        Blendshape.setValue(PresetName.U, lerp(riggedFace.mouth.shape.U,Blendshape.getValue(PresetName.U), .5));
    
        //PUPILS
        //interpolate pupil and keep a copy of the value
        let lookTarget =
          new THREE.Euler(
            lerp(oldLookTarget.x , riggedFace.pupil.y, .4),
            lerp(oldLookTarget.y, riggedFace.pupil.x, .4),
            0,
            "XYZ"
          )
        oldLookTarget.copy(lookTarget)
        currentVrm.lookAt.applyer.lookAt(lookTarget);
    }

    const onResults = (results) => {
        // Animate model
        if (!VRMs[my_idx]) return;

        // Take the results from `Holistic` and animate character based on its Face, Pose, and Hand Keypoints.
        let riggedPose, riggedLeftHand, riggedRightHand, riggedFace;
    
        const faceLandmarks = results.faceLandmarks;
        // Pose 3D Landmarks are with respect to Hip distance in meters
        const pose3DLandmarks = results.ea;
        // Pose 2D landmarks are with respect to videoWidth and videoHeight
        const pose2DLandmarks = results.poseLandmarks;
        // Be careful, hand landmarks may be reversed
        const leftHandLandmarks = results.rightHandLandmarks;
        const rightHandLandmarks = results.leftHandLandmarks;
        

        // Animate Face
        if (faceLandmarks) {
            riggedFace = Kalidokit.Face.solve(faceLandmarks,{
                runtime:"mediapipe",
                video:videoElement
            });
        }

        
        
        // Animate Pose
        if (pose2DLandmarks && pose3DLandmarks) {
            riggedPose = Kalidokit.Pose.solve(pose3DLandmarks, pose2DLandmarks, {
                runtime: "mediapipe",
                video:videoElement,
            });
        }
        
            // Animate Hands
        if (leftHandLandmarks) {
            riggedLeftHand = Kalidokit.Hand.solve(leftHandLandmarks, "Left");
        }
            
        if (rightHandLandmarks) {
            riggedRightHand = Kalidokit.Hand.solve(rightHandLandmarks, "Right");
        }
    
        
        // Socket send data
        let my_data = {
            uid,

            riggedPose,
            riggedLeftHand,
            riggedRightHand,
            riggedFace,

            // transform:transforms[0]
        }
        motion_socket.send(JSON.stringify(my_data))

        // applyMovements( my_data, idx )
    }

    const applyMovements = ( data, idx ) => {

        let {
            riggedPose,
            riggedLeftHand,
            riggedRightHand,
            riggedFace,
        } = data


        try{

            // console.log(riggedFace)
            rigFace(idx, riggedFace)
        }catch{}

        try{
            
            rigRotation(idx, "Hips", {...riggedPose.Hips.rotation, y: riggedPose.Hips.rotation.y + transforms[my_idx].r}, 0.7);
            rigPosition(
                "Hips",
                {
                    x: riggedPose.Hips.position.x,// Reverse direction
                    y: riggedPose.Hips.position.y + 1, // Add a bit of height
                    z: -riggedPose.Hips.position.z // Reverse direction
                },
                1,
                0.07
            );
        
            rigRotation(idx, "Chest", riggedPose.Spine, 0.25, .3);
            rigRotation(idx, "Spine", riggedPose.Spine, 0.45, .3);
        
            rigRotation(idx, "RightUpperArm", riggedPose.RightUpperArm, 1, .3);
            rigRotation(idx, "RightLowerArm", riggedPose.RightLowerArm, 1, .3);
            rigRotation(idx, "LeftUpperArm", riggedPose.LeftUpperArm, 1, .3);
            rigRotation(idx, "LeftLowerArm", riggedPose.LeftLowerArm, 1, .3);
        
            rigRotation(idx, "LeftUpperLeg", riggedPose.LeftUpperLeg, 1, .3);
            rigRotation(idx, "LeftLowerLeg", riggedPose.LeftLowerLeg, 1, .3);
            rigRotation(idx, "RightUpperLeg", riggedPose.RightUpperLeg, 1, .3);
            rigRotation(idx, "RightLowerLeg", riggedPose.RightLowerLeg, 1, .3);
        }catch{}


        try{
            rigRotation(idx, "LeftHand", {
                // Combine pose rotation Z and hand rotation X Y
                z: riggedPose.LeftHand.z,
                y: riggedLeftHand.LeftWrist.y,
                x: riggedLeftHand.LeftWrist.x
            });
            rigRotation(idx, "LeftRingProximal", riggedLeftHand.LeftRingProximal);
            rigRotation(idx, "LeftRingIntermediate", riggedLeftHand.LeftRingIntermediate);
            rigRotation(idx, "LeftRingDistal", riggedLeftHand.LeftRingDistal);
            rigRotation(idx, "LeftIndexProximal", riggedLeftHand.LeftIndexProximal);
            rigRotation(idx, "LeftIndexIntermediate", riggedLeftHand.LeftIndexIntermediate);
            rigRotation(idx, "LeftIndexDistal", riggedLeftHand.LeftIndexDistal);
            rigRotation(idx, "LeftMiddleProximal", riggedLeftHand.LeftMiddleProximal);
            rigRotation(idx, "LeftMiddleIntermediate", riggedLeftHand.LeftMiddleIntermediate);
            rigRotation(idx, "LeftMiddleDistal", riggedLeftHand.LeftMiddleDistal);
            rigRotation(idx, "LeftThumbProximal", riggedLeftHand.LeftThumbProximal);
            rigRotation(idx, "LeftThumbIntermediate", riggedLeftHand.LeftThumbIntermediate);
            rigRotation(idx, "LeftThumbDistal", riggedLeftHand.LeftThumbDistal);
            rigRotation(idx, "LeftLittleProximal", riggedLeftHand.LeftLittleProximal);
            rigRotation(idx, "LeftLittleIntermediate", riggedLeftHand.LeftLittleIntermediate);
            rigRotation(idx, "LeftLittleDistal", riggedLeftHand.LeftLittleDistal);
        }catch{}

        try{
            rigRotation(idx, "RightHand", {
                // Combine Z axis from pose hand and X/Y axis from hand wrist rotation
                z: riggedPose.RightHand.z,
                y: riggedRightHand.RightWrist.y,
                x: riggedRightHand.RightWrist.x
            });
            rigRotation(idx, "RightRingProximal", riggedRightHand.RightRingProximal);
            rigRotation(idx, "RightRingIntermediate", riggedRightHand.RightRingIntermediate);
            rigRotation(idx, "RightRingDistal", riggedRightHand.RightRingDistal);
            rigRotation(idx, "RightIndexProximal", riggedRightHand.RightIndexProximal);
            rigRotation(idx, "RightIndexIntermediate",riggedRightHand.RightIndexIntermediate);
            rigRotation(idx, "RightIndexDistal", riggedRightHand.RightIndexDistal);
            rigRotation(idx, "RightMiddleProximal", riggedRightHand.RightMiddleProximal);
            rigRotation(idx, "RightMiddleIntermediate", riggedRightHand.RightMiddleIntermediate);
            rigRotation(idx, "RightMiddleDistal", riggedRightHand.RightMiddleDistal);
            rigRotation(idx, "RightThumbProximal", riggedRightHand.RightThumbProximal);
            rigRotation(idx, "RightThumbIntermediate", riggedRightHand.RightThumbIntermediate);
            rigRotation(idx, "RightThumbDistal", riggedRightHand.RightThumbDistal);
            rigRotation(idx, "RightLittleProximal", riggedRightHand.RightLittleProximal);
            rigRotation(idx, "RightLittleIntermediate", riggedRightHand.RightLittleIntermediate);
            rigRotation(idx, "RightLittleDistal", riggedRightHand.RightLittleDistal);
        }catch{}

        // 移动角色位置
        VRMs[idx].scene.position.x = transforms[idx].x
        VRMs[idx].scene.position.z = transforms[idx].z
    }



    /* Animation Related Functions */
    function animate() {
        requestAnimationFrame(animate);
      
        VRMs.forEach(vrm=>{
            if (vrm) {
            // Update model to render physics
            vrm.update(clock.getDelta());
            }
        })

        renderer.render(scene, orbitCamera);
    }

    /* Network (Socket) */

    const initSocket = () => {
        // 从 URL Params 获取 roon name
        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
        const roomName = urlParams.get('roomname');
        const wss_protocol = (window.location.protocol == 'https:') ? 'wss://': 'ws://';
        motion_socket = new WebSocket(
            wss_protocol + window.location.host + '/ws/motion/'  + roomName + '/'
        );
        // 建立webchat_socket连接时触发此方法
        motion_socket.onopen = function(e) {
            // Do nothing
        }

        // 从后台接收到数据时触发此方法
        motion_socket.onmessage = function(e) {
            const data = JSON.parse(e.data);
            let {uid} = data;
            let idx = uids.indexOf(uid)
            if(idx>=0){
                applyMovements(data, idx)
            }else{
                if(!(uids_loading.indexOf(uid)>=0)){
                    // 收到一个未知用户的信号
                    console.log("cannot found uid", uid, uids_loading)
                    loadVRM(uid)
                }
            }
        }
        
    }
    



    /* Lifecycle Hooks */

    // Init HTML element reference and some mudules
    React.useEffect(()=>{
        getUid()
        newVideoElement()
        newHolistic()
        newScene()
        initRenderingPipeline()
    },[])

    // When videoElement is found, new "@mediapipe/camera_utils".Camera
    React.useEffect(()=>{
        if(videoElement) newCamera()
    },[videoElement])

    // When Camera is Ready, start it.
    React.useEffect(()=>{
        if(camera) camera.start();
    },[camera])


    React.useEffect(()=>{
        if(scene){
            newLight()
            animate()
            loadVRM(uid);  
            initSocket()  
        }
    },[scene])

    React.useEffect(()=>{
        if(holistic) initHolistic()
    },[holistic])

    return(
        <div className='ChatRoom'>
            <video
                className="input_video" width="300px" height="200px"  autoPlay muted
                style={{
                    position:"absolute",
                    left:10,top:10,
                }}
            ></video>  


            <ChatBar />     
        </div>
    )
}

export default ChatRoom