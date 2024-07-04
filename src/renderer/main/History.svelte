<script lang="ts">
    export let onClose:() => void;
    export let history:{[key:string]:string};

    let _history:string[] = [];

    $:{
        _history = Object.keys(history).map(key => `${key}\\${history[key]}`)
    }

    const onHistoryItemClick = (e:MouseEvent) => {
        const fullPath = (e.target as HTMLElement).textContent ?? ""
        window.api.send("restore", {fullPath});
    }

    const removeHistory = (e:MouseEvent) => {
        const fullPath = (e.target as HTMLElement).nextElementSibling?.textContent ?? ""
        window.api.send("remove-history", {fullPath});
    }

    const handelKeydown = () => {}

</script>

<div class="history-container can-focus" tabindex="-1">
    <div class="history-title">
        <div id="closeHistoryBtn" class="close-history-btn" on:click={onClose} on:keydown={handelKeydown} role="button" tabindex="-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
                <path fill-rule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"/>
            </svg>
        </div>
    </div>
    <ul id="history" class="history">
        {#each _history as fullPath}
            <li>
                <div class="remove-history-btn" on:click={removeHistory} on:keydown={handelKeydown} role="button" tabindex="-1">&times;</div>
                <div class="history-item" title={fullPath} on:dblclick={onHistoryItemClick} on:keydown={handelKeydown} role="button" tabindex="-1">{fullPath}</div>
            </li>
        {/each}
    </ul>
</div>