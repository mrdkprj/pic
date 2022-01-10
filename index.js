let title;
let resizeBtn;
let img;
let imageArea;
let loader;
let viewport;
let fileList;

let isMaximized = false;
let isImageLoaded = false;
let isSaved = false;
let mouseOnly = false;
let flip = false;
let isDark = false;
let themeCheckbox;
let isZoomed = false;

let isDragging = false;
let isImageMoved = false;
let mousePosition = {x:0, y:0};
let imagePosition = {x:0, y:0};
let containerRect = {};
let imgBoundRect = {};
let scale;
let scaleDirection;
let minScale;
let previousScale;
let imagePadding = {x:0, y:0};
let current= {x:0, y:0, orgX:0, orgY:0}
let angleIndex = 0;
const angles = [1,6,3,8];
const DEFAULT_SCALE = 1;
const BACKWARD = -1;
const FORWARD = 1;

window.onload = function(){

    title = document.getElementById("title");
    resizeBtn = document.getElementById("resizeBtn");
    viewport = document.getElementById("viewport");
    img = document.getElementById("img");
    imageArea = document.getElementById("imageArea");
    loader = document.getElementById("loader");
    themeCheckbox = document.getElementById("theme");
    fileList = document.getElementById("fileList")

    window.addEventListener("resize", e => {
        if(isImageLoaded){
            onImageLoaded();
        }
    })

    document.addEventListener("keydown", (e) => {

        if(e.ctrlKey){

            if(e.key == "ArrowRight"){
                rotateRight();
                return;
            }

            if(e.key == "ArrowLeft"){
                rotateLeft();
                return;
            }

            if(e.key == "ArrowUp"){
                angleIndex = 0;
                rotate();
                return;
            }

            if(e.key == "ArrowDown"){
                angleIndex = 2;
                rotate();
                return;
            }

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

        if(e.target.id == "fileListBtn"){
            toggleFileList();
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

        if(e.target.id == "mode"){
            mouseOnly = !mouseOnly;
            changeMode();
        }

        if(e.target.id == "orientation"){
            flip = !flip;
            changeOrientation();
        }

        if(e.target.id == "previous"){
            startFetch(BACKWARD);
        }

        if(e.target.id == "next"){
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
        isImageMoved = false;
        isDragging = true;
        if(scale != minScale){
            viewport.classList.add("isDragging");
        }
        resetMousePosition(e);
    })

    document.addEventListener("mousemove", e => {
        if(isDragging){
            isImageMoved = true;
            e.preventDefault();
            moveImage(e);
        }
    })

    document.addEventListener("mouseup", e => {

        if(!isImageMoved && e.target.classList.contains("clickable")){

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

        viewport.classList.remove("isDragging")
        isImageMoved = false;
        isDragging = false;
    })

    imageArea.addEventListener("wheel", e => {
        zoom(e);
    })

    themeCheckbox.addEventListener("change", e =>{
        isDark = e.target.checked;
        applyTheme();
    })

}

function onImageLoaded(data, dummy){

    isImageLoaded = true;

    minScale = DEFAULT_SCALE;
    setScale(minScale);
    previousScale = scale;

    if(data){
        const angle = data.angle? data.angle : 1;
        angleIndex = angles.indexOf(angle);
        isSaved = data.saved;
        changeSaveStatus();
        title.textContent = `PicViewer - ${data.name} (${dummy.width} x ${dummy.height})`;
        document.getElementById("counter").textContent = data.counter;
        document.getElementById("loader").style.display = "none";
    }

    resetImage();
}

function resetPosition(){
    isZoomed = false;
    imagePosition.y = 0;
    imagePosition.x = 0;
    current.x = 0;
    current.y = 0;
    current.orgX = 0;
    current.orgY = 1;
}

function resetImage(){

    containerRect = createRect(imageArea.getBoundingClientRect());

    resetPosition();

    imgBoundRect = createRect(img.getBoundingClientRect());

    imagePadding.x = (containerRect.width - imgBoundRect.width) / 2;
    imagePadding.y = (containerRect.height - imgBoundRect.height) / 2;

    current.orgX = imgBoundRect.width / 2;
    current.orgY = imgBoundRect.height / 2;

    calculateBound();

    changeTransform();
}

function zoom(e) {

    e.preventDefault();

    previousScale = scale;
    scale += e.deltaY * -0.002;

    if(e.deltaY < 0){
        scale = Math.max(.125, scale);
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

    isZoomed = true;

    calculateBound(scale);

    calc(e);

    if(scaleDirection < 0){
        adjustCalc();
    }

    changeTransform();
}

function calc(e){

    const rect = img.getBoundingClientRect();

    const left = rect.left
    const top = rect.top
    const mouseX = e.pageX - left;
    const mouseY = e.pageY - top;

    let prevOrigX = current.orgX*previousScale
    let prevOrigY = current.orgY*previousScale

    let translateX = current.x;
    let translateY = current.y;

    let newOrigX = mouseX/previousScale
    let newOrigY = mouseY/previousScale

    if ((Math.abs(mouseX-prevOrigX)>1 || Math.abs(mouseY-prevOrigY)>1)) {
        translateX = translateX + (mouseX-prevOrigX)*(1-1/previousScale);
        translateY = translateY + (mouseY-prevOrigY)*(1-1/previousScale);
    }else if(previousScale != 1 || (mouseX != prevOrigX && mouseY != prevOrigY)) {
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

    imagePosition.y = imagePadding.y + (newOrigY - newOrigY*scale)+translateY ;
    imagePosition.x = imagePadding.x + (newOrigX - newOrigX*scale)+translateX;

}

function adjustCalc(){

    if(imgBoundRect.top == 0){
        current.y = 0;
    } else if(imagePosition.y > 0){
        current.y -= imagePosition.y;
    } else if(imagePosition.y < imgBoundRect.top * -1){
        current.y += Math.abs(imagePosition.y) - imgBoundRect.top;
    }

    if(imgBoundRect.left == 0 ){
        current.x = 0;
    }else if(imagePosition.x > 0){
        current.x -= imagePosition.x;
    } else if(imagePosition.x < imgBoundRect.left * -1){
        current.x += Math.abs(imagePosition.x) - imgBoundRect.left;
    }

}

function calculateBound(applicableScale){
    const newScale = applicableScale ? applicableScale : 1;
    imgBoundRect.top = Math.max((imgBoundRect.height * newScale - containerRect.height),0);
    imgBoundRect.left = Math.max((imgBoundRect.width * newScale - containerRect.width),0);
}

function resetMousePosition(e){
    mousePosition.x = e.x;
    mousePosition.y = e.y;
}

function moveImage(e){

    const dx = e.x - mousePosition.x;
    mousePosition.x = e.x;

    const dy = e.y - mousePosition.y;
    mousePosition.y = e.y;

    if(imagePosition.y + dy > 0 || imagePosition.y + dy < imgBoundRect.top * -1){

    }else{
        imagePosition.y += dy;
        current.y += dy
    }

    if(imagePosition.x + dx > 0 || imagePosition.x + dx < imgBoundRect.left * -1){

    }else{
        imagePosition.x += dx;
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
    if(img.src){
        if(isPrepared()){
            window.api.send("fetch", index);
        }
    }
}

function deleteFile(){
    if(isPrepared()){
        window.api.send("delete", null);
    }
}

function save(){
    const config = {isDark:isDark, mouseOnly:mouseOnly, flip:flip};
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

function applyConfig(data){
    isMaximized = data.bounds.isMaximized;
    changeMaximizeIcon();

    mouseOnly = data.mode == "mouse";
    changeMode();

    isDark = data.theme == "dark";
    themeCheckbox.checked = isDark;
    applyTheme();

    changeFileList(data.history);
}

function changeSaveStatus(){
    if(isSaved){
        viewport.classList.add("saved");
    }else{
        viewport.classList.remove("saved");
    }
}

function changeMaximizeIcon(){
    if(isMaximized){
        resizeBtn.classList.remove("minbtn");
        resizeBtn.classList.add("maxbtn");
    }else{
        resizeBtn.classList.remove("maxbtn");
        resizeBtn.classList.add("minbtn");
    }
}

function changeMode(){
    if(mouseOnly){
        viewport.classList.add("mouse");
    }else{
        viewport.classList.remove("mouse");
    }
}

async function changeOrientation(){
    if(flip){
        viewport.classList.add("flip");
    }else{
        viewport.classList.remove("flip");
    }

    if(isPrepared()){
        window.api.send("chgConfigFlip", {flip:flip});
    }

}

function changeFileList(history){

    fileList.innerHTML = null;
    const fragment = document.createDocumentFragment();

    Object.keys(history).forEach(key => {
        const item = document.createElement("li");
        item.textContent = key + "\\" + history[key];
        item.addEventListener("dblclick", onFileListItemClicked);
        fragment.appendChild(item);
    });

    fileList.appendChild(fragment)
}

function onFileListItemClicked(e){
    window.api.send("restore", {target: e.target.textContent});
}

function applyTheme(){
    if(isDark == false){
        viewport.classList.remove("dark");
    }else{
        viewport.classList.add("dark");
    }
}

function toggleFileList(){

    if(viewport.classList.contains("file-list-open")){
        viewport.classList.remove("file-list-open");
    }else{
        viewport.classList.add("file-list-open");
    }
}

function minimize(){
    window.api.send("minimize")
}

function maximize(){
    window.api.send("maximize")
}

function close(){
    window.api.send("close");
}

function lock(){
    loader.style.display = "block";
}

function unlock(){
    loader.style.display = "none";
}

window.api.receive("config", data => {
    applyConfig(data);
})

window.api.receive("afterfetch", data => {
    if(data){
        const src = data.path + "?" + new Date().getTime();
        img.src = src
        const dummy = new Image();
        dummy.src = src;
        dummy.onload = function(){
            onImageLoaded(data, dummy);
        };
    }else{
        unlock();
    }

});

window.api.receive("afterSave", data => {
    isSaved = true;
    changeSaveStatus();
    changeFileList(data.history);
});

window.api.receive("afterToggleMaximize", data => {
    isMaximized = data.isMaximized;
    changeMaximizeIcon()
})

window.api.receive("onError", data => {
    alert(data);
    unlock();
})