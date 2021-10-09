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
let scale = 1;
let zoomed = false;
let scaleDirection;
const MIN_SCALE = 1;
const BACKWARD = -1;
const FORWARD = 1;

window.onload = function(){

    img = document.getElementById("img");
    imageArea = document.getElementById("imageArea");
    loader = document.getElementById("loader");

    window.addEventListener("resize", e => {
        if(ready){
            onImageLoaded();
        }
    })

    document.addEventListener("keydown", (e) => {

        if(e.ctrlKey && e.key == "q"){
            rotate();
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


function onImageLoaded(data, dummy){

    ready = true;

    containerRect = createRect(imageArea.getBoundingClientRect());

    resetScale();

    originalImgBoundRect = createRect(img.getBoundingClientRect());
    originalImgBoundRect.top = img.offsetTop;
    originalImgBoundRect.left = img.offsetLeft;

    imgBoundRect = createRect(originalImgBoundRect);
    calculateBound();
    img.style.top =  originalImgBoundRect.top + "px";
    img.style.left = originalImgBoundRect.left + "px";

    if(data){
        document.title = `PicViewer - ${data.name} (${dummy.width} x ${dummy.height})`;
        document.getElementById("counter").textContent = data.counter;
        document.getElementById("loader").style.display = "none";
    }
}

function resetScale(){
    scale = MIN_SCALE;
    zoomed = false;
    moveY = 0;
    moveX = 0;
    img.style.top = null;
    img.style.left = null;

    img.style.transform = `scale(${scale})`;
}

function zoom(e) {

    e.preventDefault();

    scale += e.deltaY * -0.001;

    if(e.deltaY < 0){
        scale = Math.min(Math.max(.125, scale), 4);
        scaleDirection = 1;
    }else{
        scale = Math.max(Math.max(.125, scale), MIN_SCALE);
        scaleDirection = -1;
    }

    img.style.transform = `scale(${scale})`;

    onScaleChanged(scaleDirection);

}

function onScaleChanged(scaleDirection){

    if(scale == MIN_SCALE){
        resetScale();
        img.style.top =  originalImgBoundRect.top + "px";
        img.style.left = originalImgBoundRect.left + "px";
        return;
    }

    zoomed = true;

    imgBoundRect = createRect(img.getBoundingClientRect())

    calculateBound();

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

function rotate(){
    if(img.classList.contains("rotate")){
        img.classList.remove("rotate");
    }else{
        img.classList.add("rotate");
    }
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
            onImageLoaded(data, dummy);
        };
    }else{
        document.getElementById("loader").style.display = "none";
    }

});

window.api.receive("onError", data => {
    alert(data);
})