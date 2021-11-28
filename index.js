let img;
let imageArea;
let loader;
let title;
let viewport;
let modeCheckbox;
let mouseOnly = false;
let isDark = false;
let themeCheckbox;
let isImageLoaded = false;
let dragging = false;
let moved = false;
let x;
let y;
let moveX = 0;
let moveY = 0;
let containerRect = {};
let imgBoundRect = {};
let scale;
let zoomed = false;
let scaleDirection;
let minScale;
let previousScale;
let padX = 0;
let padY = 0;
let current= {x:0, y:0, orgX:0, orgY:0}
const angles = [1,6,3,8];
let angleIndex = 0;
const DEFAULT_SCALE = 1;
const BACKWARD = -1;
const FORWARD = 1;

window.onload = function(){

    title = document.getElementById("title");
    viewport = document.getElementById("viewport");
    img = document.getElementById("img");
    imageArea = document.getElementById("imageArea");
    loader = document.getElementById("loader");
    modeCheckbox = document.getElementById("mouseOnly");
    themeCheckbox = document.getElementById("theme");

    window.addEventListener("resize", e => {
        if(isImageLoaded){
            resetImage();
        }
    })

    document.addEventListener("keydown", (e) => {

        if(e.ctrlKey && e.key == "q"){
            rotate180();
        }

        if(e.ctrlKey && e.key == "a"){
            e.preventDefault();
            rotateRight();
        }

        if(e.ctrlKey && e.key == "s"){
            e.preventDefault();
            save();
        }

        if(e.ctrlKey && e.key == "z"){
            e.preventDefault();
            restore();
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

    modeCheckbox.addEventListener("change", e => {
        changeMode(e);
    })

    document.addEventListener("click", (e) =>{

        if(e.target.id == "minimize"){
            minimize();
        }

        if(e.target.id == "maximize"){
            maximize();
        }

        if(e.target.id == "close"){
            close();
        }

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
            reveal();
        }

        if(e.target.id == "openFile"){
            open();
        }

        if(e.target.id == "saveFile"){
            save();
        }

        if(e.target.id == "restoreFile"){
            restore();
        }

        if(e.target.classList.contains("prev")){
            startFetch(BACKWARD);
        }

        if(e.target.classList.contains("next")){
            startFetch(FORWARD);
        }
    })

    document.getElementById("imageContainer").addEventListener("dragover", (e) => {
        e.preventDefault();
    })

    document.getElementById("imageContainer").addEventListener("drop", (e) =>{

        e.preventDefault();
        if(e.dataTransfer.items[0].kind === "file" && e.dataTransfer.items[0].type.includes("image")){
            dropFile(e.dataTransfer.items[0].getAsFile());
        }
    });

    img.addEventListener("mousedown", e => {
        moved = false;
        dragging = true;
        viewport.classList.add("dragging");
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
            if(mouseOnly){

                e.preventDefault();
                if(e.button == 0){
                    startFetch(-1);
                }

                if(e.button == 2){
                    startFetch(1);
                }
            }
        }

        viewport.classList.remove("dragging")
        moved = false;
        dragging = false;
    })

    imageArea.addEventListener("wheel", e => {
        zoom(e);
    })

    themeCheckbox.addEventListener("change", e =>{
        isDark = e.target.checked;
        applyTheme();
    })

}

function onImageLoaded(data, dummy, doReset){

    isImageLoaded = true;

    minScale = DEFAULT_SCALE;
    setScale(minScale);
    previousScale = scale;

    if(data){
        const angle = data.angle? data.angle : 1;
        angleIndex = angles.indexOf(angle);
        title.textContent = `PicViewer - ${data.name} (${dummy.width} x ${dummy.height})`;
        document.getElementById("counter").textContent = data.counter;
        document.getElementById("loader").style.display = "none";
    }

    resetImage();
}

function resetPosition(){
    zoomed = false;
    moveY = 0;
    moveX = 0;
    current.x = 0;
    current.y = 0;
    current.orgX = 0;
    current.orgY = 1;
}

function resetImage(){

    containerRect = createRect(imageArea.getBoundingClientRect());

    resetPosition();

    imgBoundRect = createRect(img.getBoundingClientRect());

    padX = (containerRect.width - imgBoundRect.width) / 2;
    padY = (containerRect.height - imgBoundRect.height) / 2;

    current.orgX = imgBoundRect.width / 2;
    current.orgY = imgBoundRect.height / 2;

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
    const rect = img.getBoundingClientRect();
    let mouseX;
    let mouseY;
    let left = rect.left
    let top = rect.top

    mouseX = e.pageX - left;
    mouseY = e.pageY - top;

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
    angleIndex--;
    if(angleIndex < 0){
        angleIndex = angles.length - 1;
    }

    rotate();
}

function rotateRight(){
    angleIndex++;
    if(angleIndex > angles.length - 1){
        angleIndex = 0;
    }

    rotate();
}

function rotate180(){
    angleIndex = 3;
    rotate();
}

function rotate(){
    window.api.send("rotate", {angle:angles[angleIndex]});
}

function setScale(newScale){
    previousScale = scale;
    scale = newScale;
    changeTransform();
}

function changeTransform(){
    img.style["transform-origin"] = `${current.orgX}px ${current.orgY}px`;
    img.style.transform = `matrix(${scale},0,0,${scale}, ${current.x},${current.y})`;
}

function createRect(base){
    return {
            top: base.top,
            left: base.left,
            width: base.width,
            height: base.height,
    }
}

function isPrepared(){
    if(loader.style.display == "block"){
        return false;
    }

    lock();
    return true;
}

function dropFile(file){
    if(isPrepared()){
        window.api.send("drop", {file:file.path});
    }
}

function startFetch(index){
    if(isPrepared()){
        window.api.send("fetch", index);
    }
}

function deleteFile(){
    if(isPrepared()){
        window.api.send("delete", null);
    }
}

function save(){
    const config = {isDark:isDark, mouseOnly:mouseOnly};
    window.api.send("save", config);
}

function open(){
    window.api.send("open", null);
}

function reveal(){
    window.api.send("reveal", null);
}

function restore(){
    window.api.send("restore", null);
}

function changeMode(e){
    mouseOnly = e.target.checked;
}

function applyTheme(){
    if(isDark == false){
        viewport.classList.remove("dark");
    }else{
        viewport.classList.add("dark");
    }
}

function minimize(){
    window.api.send("minimize")
}

function maximize(){
    window.api.send("maximize")
}

function close(){
    window.api.send("close")
}

function lock(){
    loader.style.display = "block";
}

function unlock(){
    loader.style.display = "none";
}

window.api.receive("config", data => {
    mouseOnly = data.mode == "mouse";
    modeCheckbox.checked = mouseOnly;

    isDark = data.theme == "dark";
    themeCheckbox.checked = isDark;
    applyTheme();
})

window.api.receive("afterfetch", data => {
    if(data){
        const src = data.path + "?" + new Date().getTime();
        img.src = src
        const dummy = new Image();
        dummy.src = src;
        dummy.onload = function(){
            onImageLoaded(data, dummy, true);
        };
    }else{
        unlock();
    }

});

window.api.receive("onError", data => {
    alert(data);
})