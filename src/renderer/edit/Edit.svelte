<script lang="ts">
    import { onMount } from "svelte";
    import Loader from "../Loader.svelte"
    import icon from "../../assets/icon.ico"
    import { reducer, initialAppState } from "./appStateReducer";
    import { ImageTransform } from "../imageTransform";
    import { OrientationName } from "../../constants"

    const { appState, dispatch } = reducer(initialAppState);
    const imageTransform = new ImageTransform();

    let imageArea:HTMLDivElement;
    let img:HTMLImageElement;
    let clipArea:HTMLDivElement;

    const undoStack:Pic.ImageFile[] = []
    const redoStack:Pic.ImageFile[] = []

    const onKeydown = (e:KeyboardEvent) => {

        if(e.key == "Escape"){
            close();
        }

        if(e.key == "F5"){
            window.api.send("restart", {})
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

    const onImageMousedown = (e:MouseEvent) => {

        if($appState.editMode == "Clip") return;

        imageTransform.onMousedown(e)
    }

    const onMouseDown  = (e:MouseEvent) => {

        if(!e.target || !(e.target instanceof HTMLElement)) return;

        if(!e.target.classList.contains("clickable")) return;

        if($appState.editMode == "Clip"){
            prepareClip(e);
        }
    }

    const onMousemove = (e:MouseEvent) => {

        if(!e.target || !(e.target instanceof HTMLElement)) return;

        if(e.button != 0) return;

        if($appState.clipping){
            clip(e);
        }

        imageTransform.onMousemove(e);
    }

    const onMouseup = (e:MouseEvent) => {

        if(!e.target || !(e.target instanceof HTMLElement)) return;

        if($appState.clipping){
            dispatch({type:"clipping", value:false})
            requestEdit();
            return;
        }

        dispatch({type:"dragging", value:false})

        imageTransform.onMouseup(e);
    }

    const onImageDragStart = () => {
        dispatch({type:"dragging", value:true})
    }

    const onImageDragEnd = () => {
        dispatch({type:"dragging", value:false})
    }

    const loadImage = (data:Pic.ImageFile) => {
        dispatch({type:"loadImage", value:data})
    }

    const onImageLoaded = () => {

        if($appState.imageSrc){
            imageTransform.setImage($appState.currentImageFile)
            dispatch({type:"imageScale", value:imageTransform.getImageRatio()})
        }

    }

    const changeEditMode = (mode:Pic.EditMode) => {

        if($appState.editMode == mode){
            dispatch({type:"editMode", value:"Resize"})
        }else{
            dispatch({type:"editMode", value:mode})
        }

        clearClip();
    }

    const changeResizeMode = (shrinkable:boolean) => {
        imageTransform.enableShrink(shrinkable);
        dispatch({type:"allowShrink", value:shrinkable})
    }

    const prepareClip = (e:MouseEvent) => {
        dispatch({type:"startClip", value:{rect:img.getBoundingClientRect(), position:{startX:e.clientX, startY:e.clientY}}})
    }

    const clip = (e:MouseEvent) => {
          dispatch({type:"moveClip", value:{x:e.clientX, y:e.clientY}})
    }

    const clearClip = () => {
        dispatch({type:"clipping", value:false})
    }

    const resizeImage = () => {
        changeEditMode("Resize")
        requestEdit();
    }

    const changeButtonState = () =>{
        dispatch({type:"buttonState", value:{
            canUndo:!!undoStack.length,
            canRedo:!!redoStack.length,
            isResized:imageTransform.isResized()
        }})
    }

    const undo = () => {

        const stack = undoStack.pop()

        if(stack){
            redoStack.push($appState.currentImageFile);
            loadImage(stack);
        }

        changeButtonState();
    }

    const redo = () => {

        const stack = redoStack.pop()

        if(stack){
            undoStack.push($appState.currentImageFile);
            loadImage(stack);
        }

        changeButtonState();
    }

    const getActualRect = (rect:Pic.ImageRectangle) => {

        const orientation = $appState.currentImageFile.detail.orientation;
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

        const clip = clipArea.getBoundingClientRect()

        if(clip.width < 5 || clip.height < 5) return null;

        const imageRect = img.getBoundingClientRect()

        if(clip.left > imageRect.right || clip.right < imageRect.left) return null

        if(clip.top > imageRect.bottom || clip.bottom < imageRect.top) return null

        const rate = Math.max(imageRect.width / $appState.currentImageFile.detail.renderedWidth, imageRect.height / $appState.currentImageFile.detail.renderedHeight);

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
            image:$appState.currentImageFile,
            rect
        }
    }

    const requestEdit = () => {

        if($appState.editMode === "Clip"){

            const clipInfo = getClipInfo();

            if(!clipInfo) return clearClip();

            request("clip",  clipInfo)
        }

        if($appState.editMode === "Resize" && imageTransform.isResized()){

            const scale = imageTransform.getScale();

            const size = {
                width: Math.floor($appState.currentImageFile.detail.width * scale),
                height: Math.floor($appState.currentImageFile.detail.height * scale),
            }

            request("resize", {image:$appState.currentImageFile, size} )
        }

    }

    const showEditResult = (data:Pic.EditResult) => {

        if(redoStack.length){
            redoStack.length = 0;
        }

        undoStack.push($appState.currentImageFile);

        changeButtonState();

        if($appState.editMode == "Clip"){
            clearClip();
        }

        changeResizeMode(false)

        loadImage(data.image)

    }

    const onWindowResize = () => {
        if(img.src){
            imageTransform.onWindowResize();
            clearClip();
        }
    }

    const minimize = () => {
        window.api.send("minimize", {})
    }

    const toggleMaximize = () => {
        window.api.send("toggle-maximize", {})
    }

    const onTransformChange = () => {

        if(imageTransform.isResized() && $appState.editMode == "Clip"){
            changeEditMode("Resize")
        }

        changeButtonState();

        dispatch({type:"title", value:imageTransform.getScale()})
        dispatch({type:"imageScale", value:imageTransform.getImageRatio()})
    }

    const prepare = () => {

        if($appState.loading){
            return false;
        }
        lock();
        return true;
    }

    const saveImage = (saveCopy:boolean) => {
        request("save-image", {image:$appState.currentImageFile, saveCopy})
    }

    const afterSaveImage = (data:Pic.SaveImageResult) => {

        if(data.status == "Error"){
            window.api.send("error", {renderer:"Edit", message:data.message ?? ""})
        }

        if(data.status == "Done"){
            close();
        }

    }

    const applyConfig = (data:Pic.Config) => {
        dispatch({type:"isMaximized", value:data.isMaximized})
        undoStack.length = 0;
        redoStack.length = 0;
    }

    const clear = () => {
        unlock();
        dispatch({type:"clearImage"})
        changeEditMode($appState.editMode)
        changeResizeMode(false)
    }

    const close = () => {
        clear();
        window.api.send("close-edit-dialog", {});
    }

    const lock = () => {
        dispatch({type:"loading", value:true})
    }

    const unlock = () => {
        dispatch({type:"loading", value:false})
    }

    const onOpen = (data:Pic.OpenEditEvent) => {
        applyConfig(data.config);
        loadImage(data.file)
    }

    const onAfterEdit = (data:Pic.EditResult) => {
        if(data.message){
            window.api.send("error", {renderer:"Edit", message:data.message})
        }else{
            showEditResult(data);
        }
    }

    const onAfterToggleMaximize = (data:Pic.Config) => {
        dispatch({type:"isMaximized", value:data.isMaximized})
    }

    const request = <K extends keyof MainChannelEventMap>(channel:K, data:MainChannelEventMap[K]) => {
        if(prepare()){
            window.api.send(channel, data);
        }
    }

    const onResponse = (callback:() => void) => {
        unlock();
        callback();
    }

    onMount(() => {
        imageTransform.init(imageArea, img)
        imageTransform.on("transformchange", onTransformChange)
        imageTransform.on("dragstart", onImageDragStart)
        imageTransform.on("dragend", onImageDragEnd)

        window.api.receive("edit-dialog-opened", data => onResponse(() => onOpen(data)))
        window.api.receive("after-edit", data => onResponse(() => onAfterEdit(data)))
        window.api.receive("after-save-image", data => onResponse(() => afterSaveImage(data)))
        window.api.receive("after-toggle-maximize", data => onResponse(() => onAfterToggleMaximize(data)))
        window.api.receive("after-confirm", data => {
            if(data.result){
                saveImage(true)
            }
        })

        return () => {
            window.api.removeAllListeners("edit-dialog-opened")
            window.api.removeAllListeners("after-edit")
            window.api.removeAllListeners("after-save-image")
            window.api.removeAllListeners("after-toggle-maximize")
            window.api.removeAllListeners("after-confirm")
        }
    });

    const handelKeydown = () => {}

</script>

<svelte:window on:resize={onWindowResize} />
<svelte:document on:keydown={onKeydown} on:mousedown={onMouseDown} on:mousemove={onMousemove} on:mouseup={onMouseup} />

<div class="viewport" class:dragging={$appState.dragging}>

    <div class="title-bar"
            class:can-undo={$appState.canUndo} class:can-redo={$appState.canRedo} class:resized={$appState.isResized}
            class:edited={$appState.isEdited} class:clipping={$appState.editMode == "Clip"} class:shrinkable={$appState.allowShrink}>
        <div class="icon-area">
            <img class="ico" src={icon} alt=""/>
            <span id="title">{$appState.title}</span>
        </div>
        <div class="menu header">
            <div class="btn-area">
                <div class="btn clip" title="clip" on:click={() => changeEditMode("Clip")} on:keydown={handelKeydown} role="button" tabindex="-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M5 2V0H0v5h2v6H0v5h5v-2h6v2h5v-5h-2V5h2V0h-5v2H5zm6 1v2h2v6h-2v2H5v-2H3V5h2V3h6zm1-2h3v3h-3V1zm3 11v3h-3v-3h3zM4 15H1v-3h3v3zM1 4V1h3v3H1z"/>
                    </svg>
                </div>
                <div class="btn resize" title="resize" on:click={resizeImage} on:keydown={handelKeydown} role="button" tabindex="-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
                        <path fill-rule="evenodd" d="M5.828 10.172a.5.5 0 0 0-.707 0l-4.096 4.096V11.5a.5.5 0 0 0-1 0v3.975a.5.5 0 0 0 .5.5H4.5a.5.5 0 0 0 0-1H1.732l4.096-4.096a.5.5 0 0 0 0-.707zm4.344 0a.5.5 0 0 1 .707 0l4.096 4.096V11.5a.5.5 0 1 1 1 0v3.975a.5.5 0 0 1-.5.5H11.5a.5.5 0 0 1 0-1h2.768l-4.096-4.096a.5.5 0 0 1 0-.707zm0-4.344a.5.5 0 0 0 .707 0l4.096-4.096V4.5a.5.5 0 1 0 1 0V.525a.5.5 0 0 0-.5-.5H11.5a.5.5 0 0 0 0 1h2.768l-4.096 4.096a.5.5 0 0 0 0 .707zm-4.344 0a.5.5 0 0 1-.707 0L1.025 1.732V4.5a.5.5 0 0 1-1 0V.525a.5.5 0 0 1 .5-.5H4.5a.5.5 0 0 1 0 1H1.732l4.096 4.096a.5.5 0 0 1 0 .707z"/>
                    </svg>
                </div>
                <div class="separator btn"></div>
                <div class="btn undo" title="Undo" on:click={undo} on:keydown={handelKeydown} role="button" tabindex="-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
                        <path fill-rule="evenodd" d="M1 8a7 7 0 1 0 14 0A7 7 0 0 0 1 8zm15 0A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-4.5-.5a.5.5 0 0 1 0 1H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5H11.5z"/>
                    </svg>
                </div>
                <div class="btn redo" title="Redo" on:click={redo} on:keydown={handelKeydown} role="button" tabindex="-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
                        <path fill-rule="evenodd" d="M1 8a7 7 0 1 0 14 0A7 7 0 0 0 1 8zm15 0A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM4.5 7.5a.5.5 0 0 0 0 1h5.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3a.5.5 0 0 0 0-.708l-3-3a.5.5 0 1 0-.708.708L10.293 7.5H4.5z"/>
                    </svg>
                </div>
                <div class="btn shrink" title="Enable Shrink" on:click={() => changeResizeMode(!imageTransform.isShrinkable())} on:keydown={handelKeydown} role="button" tabindex="-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
                        <path fill-rule="evenodd" d="M.172 15.828a.5.5 0 0 0 .707 0l4.096-4.096V14.5a.5.5 0 1 0 1 0v-3.975a.5.5 0 0 0-.5-.5H1.5a.5.5 0 0 0 0 1h2.768L.172 15.121a.5.5 0 0 0 0 .707zM15.828.172a.5.5 0 0 0-.707 0l-4.096 4.096V1.5a.5.5 0 1 0-1 0v3.975a.5.5 0 0 0 .5.5H14.5a.5.5 0 0 0 0-1h-2.768L15.828.879a.5.5 0 0 0 0-.707z"/>
                    </svg>
                </div>
                <div class="separator btn"></div>
                <div class="btn save-copy" title="Save Copy" on:click={() => saveImage(true)} on:keydown={handelKeydown} role="button" tabindex="-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M13 0H6a2 2 0 0 0-2 2 2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2 2 2 0 0 0 2-2V2a2 2 0 0 0-2-2zm0 13V4a2 2 0 0 0-2-2H5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1zM3 4a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4z"/>
                    </svg>
                </div>
                <div class="btn save" title="Save" on:click={() => saveImage(false)} on:keydown={handelKeydown} role="button" tabindex="-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M10.854 6.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7.5 8.793l2.646-2.647a.5.5 0 0 1 .708 0z"/>
                        <path d="M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H4zm0 1h8a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z"/>
                    </svg>
                </div>
            </div>
        </div>
        <div class="window-area">
            <div class="scale-text">{$appState.scaleText}</div>
            <div class="minimize" on:click={minimize} on:keydown={handelKeydown} role="button" tabindex="-1">&minus;</div>
            <div class="maximize" on:click={toggleMaximize} on:keydown={handelKeydown} role="button" tabindex="-1">
                <div class:maxbtn={$appState.isMaximized} class:minbtn={!$appState.isMaximized}></div>
            </div>
            <div class="close" on:click={close} on:keydown={handelKeydown} role="button" tabindex="-1">&larr;</div>
        </div>
    </div>

    <div class="container clickable">
        <Loader show={$appState.loading}/>
        <div class="image-container clickable">
            <div bind:this={imageArea} class="image-area clickable" on:wheel={imageTransform.onWheel}>
                {#if $appState.clipping}
                <div class="clip-canvas clickable" style={$appState.clipCanvasStyle}>
                    <div bind:this={clipArea} class="clip-area" style={$appState.clipAreaStyle}></div>
                </div>
                {/if}
                <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
                <img src={$appState.imageSrc} bind:this={img} class="pic clickable" alt="" on:mousedown={onImageMousedown} on:load={onImageLoaded}/>
            </div>
        </div>

    </div>
</div>