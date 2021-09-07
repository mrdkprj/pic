window.onload = function(){

    let moveByClick = false;

    document.addEventListener("keydown", (e) => {

        if(e.ctrlKey && e.key == "q"){
            rotate();
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
    })

    init();

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

window.api.receive("afterfetch", data => {
    if(data){
        const img = document.getElementById("img");
        img.src = data.path;
        const dummy = new Image();
        dummy.src = data.path;
        dummy.onload = function(){
            document.title = "PicViewer - " + data.name + "(" + dummy.width + " x " + dummy.height + ")";
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