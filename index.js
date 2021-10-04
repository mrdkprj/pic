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
let containerRect = {};
let originalimgBoundRect = {};
let imgBoundRect = {};
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
        scaleDirection = -1;
    }

    // Apply scale transform
    const img = document.getElementById("img");
    img.style.transform = `scale(${scale})`;

    createRect(prevRect , imgBoundRect)
    onScaleChanged(scaleDirection);

  }

function initScale(){
    const area = document.getElementById("imageArea");

    area.classList.add("org");

}

let prevRect = {};
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
    moveY = 0;
    moveX = 0;
    createRect(prevRect , imgBoundRect)
    img.style.transform = `scale(${scale})`;
}

function onScaleChanged(scaleDirection){
    const img = document.getElementById("img");
    createRect( imgBoundRect, img.getBoundingClientRect())
/*
    const img = document.getElementById("img");
    let rect = img.getBoundingClientRect();
    createRect(imgBoundRect, rect);

    calculateBound();

    if(scaleDirection > 0) return;
    if(img.offsetTop > imgBoundRect.top ){
        img.style.top = imgBoundRect.top + "px";
    }

    if(img.offsetTop < imgBoundRect.top * -1){
        img.style.top = imgBoundRect.top * -1 + "px";
    }

    if(img.offsetLeft > imgBoundRect.left){
        img.style.left = imgBoundRect.left + "px";
    }

    if(img.offsetLeft < imgBoundRect.left * -1){
        img.style.left = imgBoundRect.left * -1 + "px";
    }
*/

    calculateBound();

    const dmoveY = (imgBoundRect.height - prevRect.height) / 2;
    const dmoveX = (imgBoundRect.width - prevRect.width) / 2;

    if(moveY > 0 && dmoveY >= imgBoundRect.top){
        img.style.top = imgBoundRect.top + "px"
        moveY = imgBoundRect.top
    }

    if(moveY < 0 && dmoveY <= imgBoundRect.top * -1){
        console.log(imgBoundRect.top)
        img.style.top = imgBoundRect.top * -1 + "px"
        moveY = imgBoundRect.top * -1
    }

    if(moveX > 0 && dmoveX >= imgBoundRect.left){
    }

    if(moveX < 0 && dmoveX <= imgBoundRect.left * -1){

    }

}

function calculateBound(){

    const relTop = Math.max((imgBoundRect.height - containerRect.height) / 2, 0);
    const scTop = Math.min((imgBoundRect.height - originalimgBoundRect.height) / 2, relTop)

    const scLeft = (containerRect.width - imgBoundRect.width) / 2//Math.max((imgBoundRect.width - originalimgBoundRect.width) / 2, (containerRect.width - imgBoundRect.width) / 2)

    //imgBoundRect.top = (imgBoundRect.height - originalimgBoundRect.height) / 2;
    //imgBoundRect.left = (imgBoundRect.width - originalimgBoundRect.width) / 2
    imgBoundRect.top = Math.max((imgBoundRect.height - containerRect.height) / 2,0);
    imgBoundRect.left = Math.max((imgBoundRect.width - containerRect.width) / 2,0);

}

let moveX = 0;
let moveY = 0;

function setPos(e){
    x = e.x;
    y = e.y;
}

let t = 0;
function moveImage(e){
    const img = document.getElementById("img");
    //imgBoundRect = img.getBoundingClientRect();

    let right = false;
    const dx = e ? e.x - x : 0;
    if(dx > 0){
        right = true;
    }

    if(e){
        x = e.x;
    }

    let down = false;
    const dy = e ? e.y - y : 0;
    if(dy > 0){
        down = true;
    }

    if(e){
        y = e.y;
    }

    if(t > 10){
        //return;
    }

//console.log(imgBoundRect.top)
//console.log(moveY)
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
            const cont = document.getElementById("imageArea")
            createRect(containerRect, cont.getBoundingClientRect());
            scale = 1//Math.min(containerRect.width / dummy.width, containerRect.height / dummy.height);
            minScale = scale;
            resetScale();

            //const imgArea = document.getElementById("imageArea");
            createRect(originalimgBoundRect, img.getBoundingClientRect());

            originalimgBoundRect.top = img.offsetTop;
            originalimgBoundRect.left = img.offsetLeft;

            createRect(imgBoundRect, originalimgBoundRect);
            calculateBound();
            //imgBoundRect = img.getBoundingClientRect()
            img.style.top = img.offsetTop + "px";
            img.style.left = img.offsetLeft + "px"
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