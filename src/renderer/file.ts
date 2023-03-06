window.onload = () => {
    console.warn("1")
}

document.addEventListener("click", (e) =>{

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(e.target.id == "close"){
        close();
    }

})

const close = () => {
    window.api.send("close-file-dialog");
}

window.api.receive<Pic.OpenFileDialogArgs>("prepare-file-dialog", (data:Pic.OpenFileDialogArgs) => {
    console.log(data.files)
})

export {}

