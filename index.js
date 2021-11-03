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
    img.style.top = null;
    img.style.left = null;
}

function resetImage(){

    resetPosition();

    originalImgBoundRect = createRect(img.getBoundingClientRect());
    originalImgBoundRect.top = img.offsetTop;
    originalImgBoundRect.left = img.offsetLeft;

    imgBoundRect = createRect(originalImgBoundRect);
    calculateBound();
    //img.style.top =  originalImgBoundRect.top + "px";
    //img.style.left = originalImgBoundRect.left + "px";
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

let imageX;
let imageY;
let previousScale;
function afterZooom(e, scaleDirection){

    if(scale == minScale){
        calc(e)
        setScale(minScale);
        current.x = 0;
        current.y = 0;
        changeTransform();

        resetImage();
        return;
    }

    zoomed = true;

    //imgBoundRect = createRect(img.getBoundingClientRect())

    //scale = previousScale + imgBoundRect.mleft;

    calculateBound();

    calc(e);

    if(scaleDirection < 0){
        adjustCalc();
    }

    changeTransform();

    //changeTransform();
/*
    if(scaleDirection > 0) return;

    if(moveY > imgBoundRect.top){
        img.style.top = originalImgBoundRect.top + imgBoundRect.top + "px"
        moveY = imgBoundRect.top
    }

    if(moveY < imgBoundRect.top * -1){
        img.style.top = originalImgBoundRect.top - imgBoundRect.top + "px"
        moveY = imgBoundRect.top * -1
    }

    if(moveX > imgBoundRect.left){
        img.style.left = originalImgBoundRect.left + imgBoundRect.left + "px"
        moveX = imgBoundRect.left
    }

    if(moveX < imgBoundRect.left * -1){
        img.style.left = originalImgBoundRect.left - imgBoundRect.left + "px"
        moveX = imgBoundRect.left * -1
    }
*/
}

let centric = false;
let padX = 0;
let padY = 0;
let current= {x:0, y:0, orgX:0, orgY:1}
function calc(e){

        // current cursor position on image
        console.log("-----------")
        const r = img.getBoundingClientRect();
        let imageX;
        let imageY;
        let left = r.left
        let top = r.top

        imageX = e.pageX - left
        imageY = e.pageY - top

        // previous cursor position on image
        let prevOrigX = current.orgX*previousScale
        let prevOrigY = current.orgY*previousScale
        // previous zooming frame translate
        let translateX = current.x;
        let translateY = current.y;
        // set origin to current cursor position
        let newOrigX = imageX/previousScale
        let newOrigY = imageY/previousScale

        // move zooming frame to current cursor position
        if ((Math.abs(imageX-prevOrigX)>1 && Math.abs(imageY-prevOrigY)>1)) {
            translateX = translateX + (imageX-prevOrigX)*(1-1/previousScale);
            translateY = translateY + (imageY-prevOrigY)*(1-1/previousScale);
        }
        // stabilize position by zooming on previous cursor position
        else if(previousScale != 1 || (imageX != prevOrigX && imageY != prevOrigY)) {
            newOrigX = prevOrigX/previousScale;
            newOrigY = prevOrigY/previousScale;
        }


        if(previousScale == 1){
            padX = (containerRect.width - imgBoundRect.width) / 2;
            padY = (containerRect.height - imgBoundRect.height) / 2;
        }


        if(imgBoundRect.top == 0){
            translateY = 0;
            newOrigY =  (imgBoundRect.height / 2);
        }else{
            const di = imgBoundRect.top * (newOrigY+translateY) / (imgBoundRect.height / 2)

        }

        if(imgBoundRect.left == 0){
            translateX = 0;
            newOrigX = (imgBoundRect.width / 2);
        }else {


        }

        moveY = padY + (newOrigY - newOrigY*scale)+translateY ;
        moveX = padX + (newOrigX - newOrigX*scale)+translateX;

        current.x = translateX;
        current.y = translateY;
        current.orgX = newOrigX;
        current.orgY = newOrigY;

}

function adjustCalc(){

    if(current.y+current.orgY*(1-scale) >= 0){
        current.y = 0
        current.orgY = 0
    }else if(current.y+current.orgY+( containerRect.height - current.orgY)*scale <=  containerRect.height){
        current.y = 0
        current.orgY =  containerRect.height
    }

    if(current.x+current.orgX*(1-scale) >= 0){
        current.x = 0
        current.orgX = 0
    }else if(current.x+current.orgX+(containerRect.width  - current.orgX)*scale <= containerRect.width ){
        current.x = 0
        current.orgX = containerRect.width
    }

    if(moveY > 0){
        console.log(1)
        current.y = 0;
        //current.orgY = imgBoundRect.
    }

    if(moveY < imgBoundRect.top * -1){
        console.log(2)
        current.y = 0;
        //current.orgY = containerRect.height;

    }

    if(imgBoundRect.left == 0 ){
        current.x = 0;
    }else if(moveX > 0){
        if(padX > 0){
            current.x -= moveX;
        }else{
            current.x = 0
        }
    } else if(moveX < imgBoundRect.left * -1){
        if(padX > 0){
            current.x += Math.abs(moveX) - imgBoundRect.left;
        }else{
            current.x = 0
        }
    }
    /*
    if(imgBoundRect.top == 0 ){
        current.x = 0;
    }else if(moveY > 0){
        console.log(1)
        current.y += moveY;
        //current.orgY = imgBoundRect.
    }else if(moveY < imgBoundRect.top * -1){
        console.log(2)
        current.y += Math.abs(moveY) - imgBoundRect.top

    }
    */
}

function calculateBound(){
    imgBoundRect.top = Math.max((imgBoundRect.height * scale - containerRect.height),0);
    imgBoundRect.left = Math.max((imgBoundRect.width * scale - containerRect.width),0);
//    imgBoundRect.left = Math.max((imgBoundRect.width * scale - containerRect.width),(containerRect.width - imgBoundRect.width * scale));
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

    /*
    moveY = current.y + dy;
    if(imgBoundRect.top > 0 && moveY+current.orgY*(1-scale) >= 0){
        current.y = 0
        current.orgY = 0
    }else if(imgBoundRect.top > 0 && moveY+current.orgY+( containerRect.height - current.orgY)*scale <=  containerRect.height){
        current.y = 0
        current.orgY =  containerRect.height
        */
    }else{
        //img.style.top = (img.offsetTop + dy) + "px"
        moveY += dy;
        current.y += dy

    }

    if(moveX + dx > 0 || moveX + dx < imgBoundRect.left * -1){

    }else{
        //img.style.top = (img.offsetTop + dy) + "px"
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
    if((Math.abs(rotation) / 90) % 2 == 0){
        setScale(DEFAULT_SCALE);
    }else{
        setScale(ratio);
    }

    minScale = scale;
    resetImage();
}

function setScale(newScale){
    scale = newScale;
    changeTransform();
}

function changeTransform(){

    img.style["transform-origin"] = `${current.orgX}px ${current.orgY}px`;
    img.style.transform = `matrix(${scale},0,0,${scale}, ${current.x},${current.y})`;
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