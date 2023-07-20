import { ImageTransform } from "./imageTransform";
import { OrientationName } from "../constants"

const State = {
    isMaximized:false,
    editMode: "Resize" as Pic.EditMode,
    isClipping:false,
}
const clipState = {
    startX:0,
    startY:0,
}
const undoStack:Pic.ImageFile[] = []
const redoStack:Pic.ImageFile[] = []

const Dom = {
    title: null as HTMLElement,
    resizeBtn:null as HTMLElement,
    img:null as HTMLImageElement,
    imageArea:null as HTMLElement,
    loader:null as HTMLElement,
    viewport:null as HTMLElement,
    titleBar:null as HTMLElement,
    scaleText:null as HTMLElement,
    clipArea:null as HTMLElement,
    canvas:null as HTMLElement,
}

const imageTransform = new ImageTransform
let currentImageFile:Pic.ImageFile;

window.onload = () => {

    Dom.title = document.getElementById("title");
    Dom.resizeBtn = document.getElementById("resizeBtn")
    Dom.viewport = document.getElementById("viewport");
    Dom.titleBar = document.getElementById("titleBar")
    Dom.img = (document.getElementById("img") as HTMLImageElement);
    Dom.imageArea = document.getElementById("imageArea");
    Dom.loader = document.getElementById("loader");
    Dom.scaleText = document.getElementById("scaleText")
    Dom.clipArea = document.getElementById("clipArea")
    Dom.canvas = document.getElementById("clipCanvas")

    Dom.img.addEventListener("mousedown", e => onImageMousedown(e))
    Dom.img.addEventListener("load", onImageLoaded)

    Dom.imageArea.addEventListener("wheel", imageTransform.onWheel)

    imageTransform.init(Dom.imageArea, Dom.img)
    imageTransform.on("transformchange", onTransformChange)
    imageTransform.on("dragstart", onImageDragStart)
    imageTransform.on("dragend", onImageDragEnd)
}

window.addEventListener("resize", _e => onResize())

document.addEventListener("keydown", e => onKeydown(e))
document.addEventListener("click", e => onClick(e))
document.addEventListener("mousedown", e => onmousedown(e))
document.addEventListener("mousemove", e => onMousemove(e))
document.addEventListener("mouseup", e => onMouseup(e))

const onKeydown = (e:KeyboardEvent) => {

    if(e.key == "Escape"){
        close();
    }

    if(e.key == "F5"){
        window.api.send("restart")
    }

    if(e.ctrlKey && e.key == "r"){
        e.preventDefault();
    }

    if(e.ctrlKey && e.key == "z"){
        undo();
    }

    if(e.ctrlKey && e.key == "y"){
        redo();
    }

    if(e.ctrlKey && e.key == "s"){
        saveImage(false);
    }

}

const onClick = (e:MouseEvent) =>{

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(e.target.id == "minimize"){
        minimize();
    }

    if(e.target.id == "maximize"){
        toggleMaximize();
    }

    if(e.target.id == "close"){
        close();
    }

    if(e.target.id == "clip"){
        changeEditMode("Clip");
    }

    if(e.target.id == "resize"){
        resizeImage();
    }

    if(e.target.id == "shrink"){
        changeResizeMode(!imageTransform.isShrinkable());
    }

    if(e.target.id == "undo"){
        undo()
    }

    if(e.target.id == "redo"){
        redo();
    }

    if(e.target.id == "apply"){
        requestEdit();
    }

    if(e.target.id == "saveCopy"){
        saveImage(true);
    }

    if(e.target.id == "save"){
        saveImage(false);
    }

}

const onImageMousedown = (e:MouseEvent) => {

    if(State.editMode == "Clip") return;

    imageTransform.onMousedown(e)
}

const onmousedown  = (e:MouseEvent) => {

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(!e.target.classList.contains("clickable")) return;

    if(State.editMode == "Clip"){
        prepareClip();
        Dom.clipArea.style.transform = ""
        Dom.clipArea.style.width = "0px"
        Dom.clipArea.style.height = "0px"
        clipState.startX = e.clientX
        clipState.startY = e.clientY
        Dom.clipArea.style.top = clipState.startY + "px"
        Dom.clipArea.style.left = clipState.startX + "px"
        State.isClipping = true;
        Dom.canvas.style.display = "block"
    }
}

const onMousemove = (e:MouseEvent) => {

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(e.button != 0) return;

    if(State.isClipping){
        const moveX = e.clientX - clipState.startX;
        const moveY = e.clientY - clipState.startY
        const scaleX = moveX >= 0 ? 1 : -1
        const scaleY = moveY >=0 ? 1 : -1

        Dom.clipArea.style.transform = `scale(${scaleX}, ${scaleY})`
        Dom.clipArea.style.width = Math.abs(moveX) + "px"
        Dom.clipArea.style.height = Math.abs(moveY) + "px"
    }

    imageTransform.onMousemove(e);
}

const onMouseup = (e:MouseEvent) => {

    if(!e.target || !(e.target instanceof HTMLElement)) return;

    if(State.isClipping){
        State.isClipping = false;
        requestEdit();
        return;
    }

    Dom.viewport.classList.remove("dragging")
    imageTransform.onMouseup(e);
}

const onImageDragStart = () => {
    Dom.viewport.classList.add("dragging");
}

const onImageDragEnd = () => {
    Dom.viewport.classList.remove("dragging");
}

const loadImage = (data:Pic.ImageFile) => {

    currentImageFile = data;

    const src = currentImageFile.type === "path" ? `app://${data.fullPath}?${new Date().getTime()}` : `data:image/jpeg;base64,${data.fullPath}`;
    Dom.img.src = src

}

const onImageLoaded = () => {

    imageTransform.setImage(currentImageFile)

}

const changeTitle = () => {

    const size = {
        width: Math.floor(currentImageFile.detail.renderedWidth * imageTransform.getScale()),
        height: Math.floor(currentImageFile.detail.renderedHeight * imageTransform.getScale()),
    }
    Dom.title.textContent = `${currentImageFile.fileName} (${size.width} x ${size.height})`;

    Dom.scaleText.textContent = `${Math.floor(imageTransform.getImageRatio() * 100)}%`

}

const changeEditMode = (mode:Pic.EditMode) => {

    if(State.editMode == mode){
        State.editMode = "Resize"
    }else{
        State.editMode = mode
    }

    afterToggleMode();
}

const afterToggleMode = () => {

    celarClip();
    Dom.titleBar.classList.remove("clipping")

    if(State.editMode == "Clip"){
        Dom.titleBar.classList.add("clipping")
    }

}

const changeResizeMode = (shrinkable:boolean) => {

    imageTransform.enableShrink(shrinkable);
    if(shrinkable){
        Dom.titleBar.classList.add("shrink")
    }else{
        Dom.titleBar.classList.remove("shrink")
    }
}

const prepareClip = () => {
    const padding = 15;
    const titlebarHeight = 30 + padding;
    const rect = Dom.img.getBoundingClientRect();
    Dom.canvas.style.width = rect.width + "px"
    Dom.canvas.style.height = rect.height + "px"
    Dom.canvas.style.top = (rect.top - titlebarHeight) + "px"
    Dom.canvas.style.left = (rect.left - padding) + "px"
}

const celarClip = () => {
    Dom.canvas.style.display = "none"
}

const resizeImage = () => {
    changeEditMode("Resize")
    requestEdit();
}

const changeButtonState = () =>{
    Dom.titleBar.classList.remove("can-undo", "can-redo", "resized", "edited");

    if(undoStack.length){
        Dom.titleBar.classList.add("can-undo");
    }

    if(redoStack.length){
        Dom.titleBar.classList.add("can-redo");
    }

    if(imageTransform.isResized()){
        Dom.titleBar.classList.add("resized");
    }

    if(currentImageFile.type === "buffer"){
        Dom.titleBar.classList.add("edited");
    }
}

const undo = () => {
    if(undoStack.length){
        const stack = undoStack.pop()
        redoStack.push(currentImageFile);
        loadImage(stack);
    }
    changeButtonState();
}

const redo = () => {
    if(redoStack.length){
        const stack = redoStack.pop()
        undoStack.push(currentImageFile);
        loadImage(stack);
    }
    changeButtonState();
}

const getActualRect = (rect:Pic.ImageRectangle) => {

    const orientation = currentImageFile.detail.orientation;
    const rotated = orientation % 2 == 0;

    const width = rotated ? rect.height : rect.width
    const height = rotated ? rect.width : rect.height

    let top = rect.top;
    let left = rect.left;

    if(orientation === OrientationName.Clock90deg){
        top = rect.right
        left = rect.top
    }

    if(orientation == OrientationName.Clock180deg){
        top = rect.bottom
        left = rect.right;
    }

    if(orientation == OrientationName.Clock270deg){
        top = rect.left
        left = rect.bottom
    }

    return {
        top,
        left,
        width,
        height,
    }
}

const getClipInfo = () => {

    const clip = Dom.clipArea.getBoundingClientRect()

    if(clip.width < 5 || clip.height < 5) return null;

    const imageRect = Dom.img.getBoundingClientRect()

    if(clip.left > imageRect.right || clip.right < imageRect.left) return null

    if(clip.top > imageRect.bottom || clip.bottom < imageRect.top) return null

    const rate = Math.max(imageRect.width / currentImageFile.detail.renderedWidth, imageRect.height / currentImageFile.detail.renderedHeight);

    const clipLeft = Math.floor((clip.left - imageRect.left) / rate);
    const clipRight = Math.floor((imageRect.right - clip.right) / rate);
    const clipTop = Math.floor((clip.top - imageRect.top) / rate);
    const clipBottom = Math.floor((imageRect.bottom - clip.bottom) / rate);

    const clipWidth = Math.floor(clip.width / rate);
    const clipHeight = Math.floor(clip.height / rate);

    const left = clipLeft < 0 ? 0 : clipLeft;
    const top = clipTop < 0 ? 0 : clipTop;
    const right = clipRight < 0 ? 0 : clipRight;
    const bottom = clipBottom < 0 ? 0 : clipBottom

    let width = clipLeft < 0 ? Math.floor(clipWidth + clipLeft) : clipWidth
    width = clipRight < 0 ? Math.floor(width + clipRight) : width

    let height = clipTop < 0 ? Math.floor(clipHeight + clipTop) : clipHeight
    height = clipBottom < 0 ? Math.floor(height + clipBottom) : height

    const rect = getActualRect({
            top,
            left,
            right,
            bottom,
            width,
            height
    })

    return {
        image:currentImageFile,
        rect
    }
}

const requestEdit = () => {

    if(State.editMode === "Clip"){

        const clipInfo = getClipInfo();

        if(!clipInfo) return celarClip();

        request<Pic.ClipRequest>("clip",  clipInfo)
    }

    if(State.editMode === "Resize" && imageTransform.isResized()){

        const scale = imageTransform.getScale();

        const size = {
            width: Math.floor(currentImageFile.detail.width * scale),
            height: Math.floor(currentImageFile.detail.height * scale),
        }

        request<Pic.ResizeRequest>("resize", {image:currentImageFile, size} )
    }

}

const showEditResult = (data:Pic.EditResult) => {

    if(redoStack.length){
        redoStack.length = 0;
    }

    undoStack.push(currentImageFile);

    changeButtonState();

    if(State.editMode == "Clip"){
        celarClip();
    }

    changeResizeMode(false)

    loadImage(data.image)

}

const onResize = () => {
    imageTransform.onWindowResize();
    if(Dom.img.src){
        celarClip();
    }
}

const minimize = () => {
    window.api.send("minimize")
}

const toggleMaximize = () => {
    window.api.send("toggle-maximize")
}

const onTransformChange = () => {

    if(imageTransform.isResized() && State.editMode == "Clip"){
        changeEditMode("Resize")
    }

    changeButtonState();

    changeTitle();
}

const prepare = () => {

    if(Dom.loader.style.display == "block"){
        return false;
    }
    lock();
    return true;
}

const saveImage = (saveCopy:boolean) => {

    if(!undoStack.length) return;

    const executeSave = saveCopy ? true : window.confirm("Overwrite image?")
    if(executeSave){
        request<Pic.SaveImageRequest>("save-image", {image:currentImageFile, saveCopy})
    }

}

const afterSaveImage = (data:Pic.SaveImageResult) => {
    if(data.message){
        alert(data.message)
    }else{
        close();
    }

}
const applyConfig = (data:Pic.Config) => {

    State.isMaximized = data.isMaximized;
    changeMaximizeIcon();

    applyTheme(data.preference.theme);

    undoStack.length = 0;
    redoStack.length = 0;
}

const applyTheme = (theme:Pic.Theme) => {
    if(theme === "Light"){
        Dom.viewport.classList.remove("dark");
    }else{
        Dom.viewport.classList.add("dark");
    }
}

const changeMaximizeIcon = () => {
    if(State.isMaximized){
        Dom.resizeBtn.classList.remove("minbtn");
        Dom.resizeBtn.classList.add("maxbtn");
    }else{
        Dom.resizeBtn.classList.remove("maxbtn");
        Dom.resizeBtn.classList.add("minbtn");
    }
}

const clear = () => {
    unlock();
    Dom.img.src = "";
    changeEditMode(State.editMode)
}

const close = () => {
    clear();
    window.api.send("close-edit-dialog");
}

const lock = () => {
    Dom.loader.style.display = "block";
}

const unlock = () => {
    Dom.loader.style.display = "none";
}

const onOpen = (data:Pic.OpenEditArg) => {
    applyConfig(data.config);
    loadImage(data.file)
}

const onAfterEdit = (data:Pic.EditResult) => {
    if(data.message){
        alert(data.message);
    }else{
        showEditResult(data);
    }
}

const onAfterToggleMaximize = (data:Pic.Config) => {
    State.isMaximized = data.isMaximized;
    changeMaximizeIcon()
}

const request = <T extends Pic.Args>(channel:MainChannel, data:T) => {
    if(prepare()){
        window.api.send(channel, data);
    }
}

const onResponse = (callback:() => void) => {
    unlock();
    callback();
}

window.api.receive<Pic.OpenEditArg>("edit-dialog-opened", data => onResponse(() => onOpen(data)))

window.api.receive<Pic.EditResult>("after-edit", data => onResponse(() => onAfterEdit(data)))

window.api.receive<Pic.SaveImageResult>("after-save-image", data => onResponse(() => afterSaveImage(data)))

window.api.receive<Pic.Config>("after-toggle-maximize", data => onResponse(() => onAfterToggleMaximize(data)))

export {}