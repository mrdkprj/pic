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
    img.style.top =  originalImgBoundRect.top + "px";
    img.style.left = originalImgBoundRect.left + "px";
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

    afterZooom(e);

}

let imageX;
let imageY;
let previousScale;
function afterZooom(e){

    if(scale == minScale){
        setScale(minScale);
        resetImage();
        return;
    }

    zoomed = true;

    changeTransform();

    imgBoundRect = createRect(img.getBoundingClientRect())

    calculateBound();

    if(imgBoundRect.top > 0 && imgBoundRect.left > 0){
        centric = true;
    }else{
        centric = false;
    }

    calc(e);





    //changeTransform();

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

}

let centric = false;
let current= {x:0, y:0, orgX:0, orgY:1}
function calc(e){

        // current cursor position on image
        console.log("-----------")
        const r = img.getBoundingClientRect();
           let imageX;
        let imageY;

        if(centric){
            imageX = (e.pageX - r.left).toFixed(2)//(mouseX - offsetLeft)
            imageY = (e.pageY - r.top).toFixed(2)//(mouseY - offsetTop)
        }else{
            imageX = ((containerRect.width / 2)  - r.left).toFixed(2)//(mouseX - offsetLeft)
            imageY = ((containerRect.height / 2) - r.top).toFixed(2)//(mouseY - offsetTop)
            imageX = (e.pageX - r.left).toFixed(2)//(mouseX - offsetLeft)
            imageY = (e.pageY - r.top).toFixed(2)//(mouseY - offsetTop)
        }

        //imageX = (e.clientX - r.left)
        //imageX = (e.clientY - r.top)
        // previous cursor position on image
        let prevOrigX = (current.orgX*previousScale).toFixed(2)
        let prevOrigY = (current.orgY*previousScale).toFixed(2)
        // previous zooming frame translate
        let translateX = current.x;
        let translateY = current.y;
        // set origin to current cursor position
        let newOrigX = imageX/previousScale;
        let newOrigY = imageY/previousScale;
        // move zooming frame to current cursor position
        if ((Math.abs(imageX-prevOrigX)>1 || Math.abs(imageY-prevOrigY)>1) && previousScale < 4) {
            translateX = translateX + (imageX-prevOrigX)*(1-1/previousScale);
            translateY = translateY + (imageY-prevOrigY)*(1-1/previousScale);
        }

        // stabilize position by zooming on previous cursor position
        else if(previousScale != 1 || (imageX != prevOrigX && imageY != prevOrigY)) {
            newOrigX = prevOrigX/previousScale;
            newOrigY = prevOrigY/previousScale;

        }

        if(centric == false){

            translateX = 0//(imgBoundRect.width - (imgBoundRect.width / scale)) / 2
            translateY = 0
        }
        current.x = translateX;
        current.y = translateY;
        current.orgX = newOrigX;
        current.orgY = newOrigY;


        console.log(imgBoundRect.width)
        console.log((imgBoundRect.width / scale))

        //img.style.transform = `matrix(${scale},0,0,${scale}, ${current.x},${current.y})`;


}

function calculateBound(){
    imgBoundRect.top = Math.max((imgBoundRect.height - containerRect.height) / 2,0);
    imgBoundRect.left = Math.max((imgBoundRect.width - containerRect.width) / 2,0);
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

    if(moveY + dy >= imgBoundRect.top || moveY + dy <= imgBoundRect.top * -1){

    }else{
        img.style.top = (img.offsetTop + dy) + "px"
        moveY += dy;
    }

    if(moveX + dx >= imgBoundRect.left || moveX + dx <= imgBoundRect.left * -1){

    }else{
        img.style.left = (img.offsetLeft + dx) + "px"
        moveX += dx;
    }

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

    if(centric){
        img.style["transform-origin"] = `${current.orgX}px ${current.orgY}px`;
        img.style.transform = `matrix(${scale},0,0,${scale}, ${current.x},${current.y})`;
    }else{
        img.style["transform-origin"] = "50% 50%"
        //img.style.transform = `matrix(${scale},0,0,${scale},0,0`;
        img.style.transform = `matrix(${scale},0,0,${scale}, ${current.x},${current.y})`;
    }
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