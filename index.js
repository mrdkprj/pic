window.onload = function(){

    let moveByClick = false;

    document.addEventListener("keydown", (e) => {

        if(e.ctrlKey && e.key == "q"){
            //rotate();
            max();
        }

        if(e.key === "Delete"){
            deleteFile();
        }

        if(e.key === "ArrowRight"){
            startFetch(1);
        }

        if(e.key === "ArrowLeft"){
            startFetch(-1);
        }

    })

    document.getElementById("mouseMove").addEventListener("change", e => {
        moveByClick = e.target.checked
    })

    document.getElementById("imageArea").addEventListener("mouseup", e => {
        if(moveByClick){
            e.preventDefault();
            if(e.button == 0){
                startFetch(-1);
            }

            if(e.button == 2){
                startFetch(1);
            }
        }
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
            startFetch(-1);
        }

        if(e.target.classList.contains("next")){
            startFetch(1);
        }
    })

    document.getElementById("pic").addEventListener("dragover", (e) => {
        e.preventDefault();
    })

    document.getElementById("pic").addEventListener("drop", (e) =>{

        e.preventDefault();
        if(e.dataTransfer.items[0].kind === "file" && e.dataTransfer.items[0].type.includes("image")){
            dropFile(e.dataTransfer.items[0].getAsFile());
        }
    });

    let moving = false;
    document.getElementById("img").addEventListener("mousedown", e => {
        moving = true;
        setPos(e);
    })

    document.addEventListener("mousemove", e => {
        if(moving){
            e.preventDefault();
            moveImage(e);
        }
    })

    document.addEventListener("mouseup", e => {
        moving = false;
    })

    document.getElementById("imageArea").addEventListener("wheel", e => {
        zoom(e);
    })

    init();

}

let x;
let y;
let containerRect;
let originalImgRect = {top:0, left:0, width:0, height:0};
let imgRect = {top:0, left:0, width:0, height:0};
let scale = 1;
let minScale;
let zoomed = false;

function zoom(event) {

    let scaleDirection;

    if(!zoomed){
        initScale();
    }

    event.preventDefault();

    scale += event.deltaY * -0.001;

    // Restrict scale
    if(event.deltaY < 0){
        scale = Math.min(Math.max(.125, scale), 4);
        scaleDirection = 1;
    }else{
        scale = Math.max(Math.max(.125, scale), minScale);
        scaleDirection = 0;
    }

    // Apply scale transform
    const img = document.getElementById("img");
    img.style.transform = `scale(${scale})`;

    onScaleChanged(scaleDirection);

  }

function initScale(){
    const area = document.getElementById("imageArea");

    area.classList.add("org");

}

function resetScale(){
    const area = document.getElementById("imageArea");

    if(area.classList.contains("org")){
        area.classList.remove("org");
    }

    const img = document.getElementById("img");
    img.style.top = null;
    img.style.left = null;
    scale = minScale;
    zoomed = false;
    img.style.transform = `scale(${scale})`;
}

function onScaleChanged(scaleDirection){
    const img = document.getElementById("img");
    let rect = img.getBoundingClientRect();
    createRect(imgRect, rect);

    if(scale >= minScale){
        imgRect.top = (imgRect.height - originalImgRect.height) / 2;
        imgRect.left = (imgRect.width - originalImgRect.width) / 2;
        console.log(imgRect.width)
        console.log(originalImgRect.width)
    }

    if(img.offsetTop > imgRect.top ){
        img.style.top = imgRect.top + "px";
    }

    if(img.offsetTop < imgRect.top * -1){
        img.style.top = imgRect.top * -1 + "px";
    }

    if(img.offsetLeft > imgRect.left){
        img.style.left = imgRect.left + "px";
    }

    if(img.offsetLeft < imgRect.left * -1){
        img.style.left = imgRect.left * -1 + "px";
    }

}

function setPos(e){
    x = e.x;
    y = e.y;

    containerRect = document.getElementById("imageArea").getBoundingClientRect();
}

let t = 0;
function moveImage(e){
    const img = document.getElementById("img");
    const cont = document.getElementById("imageArea")

    let right = false;
    const dx = e.x - x;
    if(dx > 0){
        right = true;
    }
    x = e.x;

    let down = false;
    const dy = e.y - y;
    if(dy > 0){
        down = true;
    }
    y = e.y;

    if(t > 10){
        //return;
    }


    if(down){
        if(img.offsetTop + dy > imgRect.top){

        }else{
            img.style.top = (img.offsetTop + dy) + "px"
        }
    }

    if(!down){
        if(img.offsetTop + dy < imgRect.top * -1){

        }else{
            img.style.top = (img.offsetTop - Math.abs(dy)) + "px"
        }
    }

    if(right){
        if(img.offsetLeft + dx > imgRect.left){

        }else{
            img.style.left = (img.offsetLeft + dx) + "px"
        }
    }

    if(!right){
        if(img.offsetLeft + dx < imgRect.left * -1){

        }else{
            img.style.left = (img.offsetLeft - Math.abs(dx)) + "px"
        }
    }
t++
}

function rotate(){
    const img = document.getElementById("img");
    if(img.classList.contains("rotate")){
        img.classList.remove("rotate");
    }else{
        img.classList.add("rotate");
    }
}

function prepare(){
    const loader = document.getElementById("loader");

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

function createRect(target, base){
    target.top = base.top;
    target.left = base.left;
    target.width = base.width;
    target.height = base.height;
}

window.api.receive("afterfetch", data => {
    if(data){

        const img = document.getElementById("img");
        img.src = data.path;
        const dummy = new Image();
        dummy.src = data.path;
        dummy.onload = function(){
            document.title = "PicViewer - " + data.name + "(" + dummy.width + " x " + dummy.height + ")";
            const imgArea = document.getElementById("imageArea");
            createRect(originalImgRect, img.getBoundingClientRect());
            console.log(img.getBoundingClientRect())
            scale = Math.min(originalImgRect.width / dummy.width, originalImgRect.height / dummy.height);
            minScale = scale;
            resetScale();
            //const imgArea = document.getElementById("imageArea");

            originalImgRect.top = img.offsetTop;
            originalImgRect.left = img.offsetLeft;

            document.getElementById("counter").textContent = data.counter;
            document.getElementById("loader").style.display = "none";
        }
    }else{
        document.getElementById("loader").style.display = "none";
    }

});

window.api.receive("onError", data => {
    alert(data);
})