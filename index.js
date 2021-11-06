let img;
let imageArea;
let loader;
let moveByClick = false;
let ready = false;
let dragging = false;
let moved = false;
let x;
let y;
let moveX = 0;
let moveY = 0;
let containerRect = {};
let originalImgBoundRect = {};
let imgBoundRect = {};
let scale;
let zoomed = false;
let scaleDirection;
let rotation = 0;
let minScale;
let ratio;
const rotationBasis = 90;
const DEFAULT_SCALE = 1;
const BACKWARD = -1;
const FORWARD = 1;

window.onload = function(){

    img = document.getElementById("img");
    imageArea = document.getElementById("imageArea");
    loader = document.getElementById("loader");

    window.addEventListener("resize", e => {
        if(ready){
            resetImage();
        }
    })

    document.addEventListener("keydown", (e) => {

        if(e.ctrlKey && e.key == "q"){
            rotate180();
        }

        if(e.key === "Delete"){
            deleteFile();
        }

        if(e.key === "ArrowRight"){
            startFetch(FORWARD);
        }

        if(e.key === "ArrowLeft"){
            startFetch(BACKWARD);
        }

    })

    document.getElementById("mouseOnly").addEventListener("change", e => {
        moveByClick = e.target.checked
    })

    document.addEventListener("click", (e) =>{

        if(e.target.id == "deleteBtn"){
            deleteFile();
        }

        if(e.target.id == "rotateLeft"){
            rotateLeft();
        }

        if(e.target.id == "rotateRight"){
            rotateRight();
        }

        if(e.target.id == "reveal"){
            window.api.send("reveal", null);
        }

        if(e.target.id == "openFile"){
            window.api.send("open", null);
        }

        if(e.target.id == "saveFile"){
            window.api.send("save", null);
        }

        if(e.target.id == "restoreFile"){
            window.api.send("restore", null);
        }

        if(e.target.classList.contains("prev")){
            startFetch(BACKWARD);
        }

        if(e.target.classList.contains("next")){
            startFetch(FORWARD);
        }
    })

    document.getElementById("container").addEventListener("dragover", (e) => {
        e.preventDefault();
    })

    document.getElementById("container").addEventListener("drop", (e) =>{

        e.preventDefault();
        if(e.dataTransfer.items[0].kind === "file" && e.dataTransfer.items[0].type.includes("image")){
            dropFile(e.dataTransfer.items[0].getAsFile());
        }
    });

    img.addEventListener("mousedown", e => {
        moved = false;
        dragging = true;
        resetMousePosition(e);
    })

    document.addEventListener("mousemove", e => {
        if(dragging){
            moved = true;
            e.preventDefault();
            moveImage(e);
        }
    })

    document.addEventListener("mouseup", e => {

        if(!moved && e.target.classList.contains("clickable")){
            if(moveByClick){

                e.preventDefault();
                if(e.button == 0){
                    startFetch(-1);
                }

                if(e.button == 2){
                    startFetch(1);
                }
            }
        }
        moved = false;
        dragging = false;
    })

    imageArea.addEventListener("wheel", e => {
        zoom(e);
    })

    init();

}

let previousScale;
let padX = 0;
let padY = 0;
let current= {x:0, y:0, orgX:0, orgY:0}
function onImageLoaded(data, dummy, doReset){

    ready = true;

    rotation = 0;
    minScale = DEFAULT_SCALE;
    setScale(minScale);
    previousScale = scale;

    containerRect = createRect(imageArea.getBoundingClientRect());

    resetImage();

    if(data){
        ratio = Math.max(dummy.width / dummy.height, dummy.height / dummy.width)
        document.title = `PicViewer - ${data.name} (${dummy.width} x ${dummy.height})`;
        document.getElementById("counter").textContent = data.counter;
        document.getElementById("loader").style.display = "none";
    }
}

function resetPosition(){
    zoomed = false;
    moveY = 0;
    moveX = 0;
    current.x = 0;
    current.y = 0;
    current.orgX = 0;
    current.orgY = 0;
}

function resetImage(){

    containerRect = createRect(imageArea.getBoundingClientRect());

    resetPosition();

    imgBoundRect = createRect(img.getBoundingClientRect());

    padX = (containerRect.width - imgBoundRect.width) / 2;
    padY = (containerRect.height - imgBoundRect.height) / 2;

    current.orgX = imgBoundRect.width / 2;
    current.orgY = imgBoundRect.height / 2;

    if((Math.abs(rotation) / 90) % 2 != 0){
        current.orgX = (imgBoundRect.height/scale) / 2;
        current.orgY = (imgBoundRect.width/scale) / 2;
    }

    calculateBound();

    changeTransform();
}

function zoom(e) {

    e.preventDefault();

    previousScale = scale;
    scale += e.deltaY * -0.001;

    if(e.deltaY < 0){
        scale = Math.min(Math.max(.125, scale), 4);
        scaleDirection = 1;
    }else{
        scale = Math.max(Math.max(.125, scale), minScale);
        scaleDirection = -1;
    }

    afterZooom(e, scaleDirection);

}

function afterZooom(e, scaleDirection){

    if(scale == minScale){
        setScale(minScale);
        resetImage();
        return;
    }

    zoomed = true;

    calculateBound(scale);

    calc(e);

    if(scaleDirection < 0){
        adjustCalc();
    }

    changeTransform();
}

function calc(e){

        // current cursor position on image
        console.log("-----------")
        const r = img.getBoundingClientRect();
        let mouseX;
        let mouseY;
        let left = r.left
        let top = r.top

        mouseX = e.pageX - left
        mouseY = e.pageY - top

        mouseX = e.pageY - top
        mouseY = e.pageX - left
        const ox = current.orgX
        const oy =current.orgY
        current.orgY = ox;
        current.orgX = oy;
        const cx = current.x;
        const cy = current.y;
        current.x = cy;
        current.y = cx;


        // previous cursor position on image
        let prevOrigX = current.orgX*previousScale
        let prevOrigY = current.orgY*previousScale
        // previous zooming frame translate
        let translateX = current.x;
        let translateY = current.y;
        // set origin to current cursor position
        let newOrigX = mouseX/previousScale
        let newOrigY = mouseY/previousScale

        // move zooming frame to current cursor position
        if ((Math.abs(mouseX-prevOrigX)>1 && Math.abs(mouseY-prevOrigY)>1)) {
            translateX = translateX + (mouseX-prevOrigX)*(1-1/previousScale);
            translateY = translateY + (mouseY-prevOrigY)*(1-1/previousScale);
        }
        // stabilize position by zooming on previous cursor position
        else if(previousScale != 1 || (mouseX != prevOrigX && mouseY != prevOrigY)) {
            newOrigX = prevOrigX/previousScale;
            newOrigY = prevOrigY/previousScale;
        }

        if(imgBoundRect.top == 0){
            translateY = 0;
            newOrigY =  (imgBoundRect.height / 2);
        }

        if(imgBoundRect.left == 0){
            translateX = 0;
            newOrigX = (imgBoundRect.width / 2);
        }

        current.x = translateX;
        current.y = translateY;
        current.orgX = newOrigX;
        current.orgY = newOrigY;

        moveY = padY + (newOrigY - newOrigY*scale)+translateY ;
        moveX = padX + (newOrigX - newOrigX*scale)+translateX;

}

function adjustCalc(){

    if(imgBoundRect.top == 0){
        current.y = 0;
    } else if(moveY > 0){
        current.y -= moveY;
    } else if(moveY < imgBoundRect.top * -1){
        current.y += Math.abs(moveY) - imgBoundRect.top;
    }

    if(imgBoundRect.left == 0 ){
        current.x = 0;
    }else if(moveX > 0){
        current.x -= moveX;
    } else if(moveX < imgBoundRect.left * -1){
        current.x += Math.abs(moveX) - imgBoundRect.left;
    }

}

function calculateBound(applicableScale){
    const newScale = applicableScale ? applicableScale : 1;
    imgBoundRect.top = Math.max((imgBoundRect.height * newScale - containerRect.height),0);
    imgBoundRect.left = Math.max((imgBoundRect.width * newScale - containerRect.width),0);
}

function resetMousePosition(e){
    x = e.x;
    y = e.y;
}

function moveImage(e){

    const dx = e.x - x;
    x = e.x;

    const dy = e.y - y;
    y = e.y;

    if(moveY + dy > 0 || moveY + dy < imgBoundRect.top * -1){

    }else{
        moveY += dy;
        current.y += dy
    }

    if(moveX + dx > 0 || moveX + dx < imgBoundRect.left * -1){

    }else{
        moveX += dx;
        current.x += dx
    }

    changeTransform();

}

function rotateLeft(){
    rotation += rotationBasis * -1
    if(rotation <= -360){
        rotation = 0;
    }
    rotate();
}

function rotateRight(){
    rotation += rotationBasis
    if(rotation >= 360){
        rotation = 0;
    }
    rotate();
}

function rotate180(){
    rotation = 180;
    rotate();
}

function rotate(){
    current.orgX = 0;
    current.orgY = 0;

    if((Math.abs(rotation) / 90) % 2 == 0){
        setScale(DEFAULT_SCALE);
    }else{
        setScale(ratio);
    }

    minScale = scale;

    resetImage();
}

function setScale(newScale){
    previousScale = scale;
    scale = newScale;
    changeTransform();
}

function changeTransform(){

    img.style["transform-origin"] = `${current.orgX}px ${current.orgY}px`;
    //img.style.transform = `matrix(${scale},0,0,${scale}, ${current.x},${current.y})`;
    img.style.transform = `rotate(${rotation}deg) translate(${current.x}px, ${current.y}px) scale(${scale})`;
    //img.style.transform = `scale(${scale}) rotate(${rotation}deg) `;
}

function openSetting(){
    settingDialog.style.display = "block";
}

function prepare(){
    if(loader.style.display == "block"){
        return false;
    }

    loader.style.display = "block";
    return true;
}

function init(){
    if(prepare()){
        window.api.send("domready", null);
    }
}

function dropFile(file){
    if(prepare()){
        window.api.send("drop", {name:file.name,path:file.path});
    }
}

function startFetch(index){
    if(prepare()){
        window.api.send("fetch", index);
    }
}

function deleteFile(){
    if(prepare()){
        window.api.send("delete", null);
    }
}

function createRect(base){
    return {
            top: base.top,
            left: base.left,
            width: base.width,
            height: base.height,
    }
}

window.api.receive("afterfetch", data => {
    if(data){
        img.src = data.path;
        const dummy = new Image();
        dummy.src = data.path;
        dummy.onload = function(){
            onImageLoaded(data, dummy, true);
        };
    }else{
        document.getElementById("loader").style.display = "none";
    }

});

window.api.receive("onError", data => {
    alert(data);
})